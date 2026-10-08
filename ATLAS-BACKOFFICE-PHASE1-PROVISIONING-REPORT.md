# ATLAS BACKOFFICE PHASE 1 — CUSTOMER & PROFESSIONAL PROVISIONING REPORT

**Document ID:** `ATLAS-BACKOFFICE-PHASE1-PROVISIONING-REPORT.md`  
**Execution Agent:** Antigravity  
**Authorizing Gate:** Phase 1 Delivery (Customer + ATLAS Professional Provisioning)  
**Date:** 2026-10-08  
**Backend Commit SHA:** `87ecc0ed3cfbb491c66271e3e7b8b82de5f1cf48` (branch: `feature/backoffice-production-ops` in `forge-atlas-api-backoffice-ops`)  
**Backoffice Commit SHA:** `e202070f7b49ba6695afcda80456d32be938f8ce` (branch: `feature/backoffice-production-ops` in `forge-atlas-backoffice`)  

---

## 1. Executive Summary

Phase 1 establishes the production-grade provisioning and operational baseline for **ATLAS Professional** customers, tenants, identities, subscriptions, devices, and operational audits.

In strict compliance with the **Architect Authorization Instructions**:
- Work was conducted entirely inside isolated branches (`feature/backoffice-production-ops`) and backend worktrees.
- Claude's DO-NOT-TOUCH register was preserved with zero collisions.
- No merges to `master`/`main` or deployments to production have been executed.
- The existing architectural foundation (`atlas.customer`, `atlas.atlas_tenant`, `atlas.atlas_user`, `atlas.tenant_membership`, `atlas.user_subscription`, `atlas.provisioning_job`, `atlas.saas_audit_event`, `ProfessionalOnboardingService`, `ProvisioningJobWorker`) was reused and extended without parallel architecture.
- All automated unit, security, and integration tests are passing green (44/44 backend tests, 20/20 frontend vitest, clean Next.js/vinext build with localhost leak guards passing).

---

## 2. Architecture & State Machine

```
[ BACKOFFICE OPERATOR ]
          |
          v
[ ProfessionalOnboardingController / ProvisioningBackofficeController ]
          |
          +---> ProfessionalOnboardingService
                     |
                     +---> ProvisioningOrchestrator
                                |
                                +-- Step 1: TENANT_ALLOCATION
                                |     Allocates / verifies tenant row in atlas.atlas_tenant
                                |
                                +-- Step 2: KEYCLOAK_IDENTITY
                                |     Invokes Keycloak confidential client adapter
                                |     Creates/updates user & assigns roles ('TENANT_ADMIN' / 'TENANT_MEMBER')
                                |
                                +-- Step 3: MEMBERSHIP_AND_SUBSCRIPTION
                                |     Syncs atlas.atlas_user & atlas.tenant_membership
                                |     Activates atlas.user_subscription with seats (max_seats = 1 default)
                                |
                                +-- Step 4: COMPLETED / SUCCEEDED
                                      Logs immutable atlas.saas_audit_event
```

### Provisioning Job Lifecycle & State Machine
1. **PENDING:** Job queued upon customer registration or onboarding request.
2. **PROVISIONING / RUNNING:** Claimed by `ProvisioningJobWorker` using row-level locking (`FOR UPDATE SKIP LOCKED`) or triggered via backoffice operator action (`POST /api/backoffice/v1/provisioning/jobs/{id}/approve`).
3. **SUCCEEDED:** All steps (`TENANT_ALLOCATION`, `KEYCLOAK_IDENTITY`, `MEMBERSHIP_AND_SUBSCRIPTION`) completed successfully. Recorded in step audit log table.
4. **RETRY / FAILED:** Upon transient failure (e.g., network timeout), job increments `retry_count` up to `max_retries` (default 5). If retries exhausted or terminal error occurs, transitions to `FAILED`.
5. **REJECTED:** Operator override rejecting a pending job (`POST /api/backoffice/v1/provisioning/jobs/{id}/reject`).

### Idempotency & Database Locks
- Every step records state in `atlas.provisioning_step` with attempt counts, status, and JSON diagnostics.
- Retries do not recreate existing rows; queries resolve existing tenants by `atlas_tenant.code` (`customer.tenant_code`), existing users by `atlas_user.email`, and existing subscriptions by `user_subscription.customer_id`.
- Multi-user invitations drop duplicate restrictions on customer ID while enforcing unique `(customer_id, email)` and enforcing seat limits.

---

## 3. Database Migrations

### Flyway Migration: `V18__enhance_provisioning_and_customer_operations.sql`
- **Location:** `src/main/resources/db/migration/V18__enhance_provisioning_and_customer_operations.sql`
- **Verification:** Remote branch checked prior to naming. Production baseline was at `V17`. No other branch had claimed `V18`.

```sql
-- 1. Step diagnostics table for tracking provisioning progress
CREATE TABLE IF NOT EXISTS atlas.provisioning_step (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES atlas.provisioning_job(id) ON DELETE CASCADE,
    step_name VARCHAR(64) NOT NULL,
    step_order INT NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    attempt_count INT NOT NULL DEFAULT 0,
    error_message TEXT,
    diagnostics_json JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_provisioning_job_step UNIQUE (job_id, step_name)
);

-- 2. Drop single-user constraint on pending_identity to allow multi-user invites
ALTER TABLE atlas.pending_identity
    DROP CONSTRAINT IF EXISTS pending_identity_customer_id_key;

-- 3. Seats abstraction: add seat tracking columns to user_subscription
ALTER TABLE atlas.user_subscription
    ADD COLUMN IF NOT EXISTS seat_count INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS max_seats INT NOT NULL DEFAULT 1;

-- 4. Customer metadata & support fields
ALTER TABLE atlas.customer
    ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(64),
    ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- 5. Audit query performance index
CREATE INDEX IF NOT EXISTS idx_saas_audit_customer_timestamp
    ON atlas.saas_audit_event(customer_id, timestamp DESC);
```

---

## 4. Keycloak Confidential Service Account Provisioning

### Architecture & Separation of Concerns
- **Identity & Authentication:** Handled exclusively by Keycloak (`forge-atlas` realm).
- **Tenancy, Entitlements & Authoritative State:** Handled exclusively by the ATLAS database (`atlas.customer`, `atlas.atlas_tenant`, `atlas.tenant_membership`).
- **No Client Secrets in Frontend:** The Backoffice frontend (`forge-atlas-backoffice`) only handles the operator's OIDC session. Zero Keycloak service-account or master credentials exist in frontend code or bundles.

### Service Account Client:
- **Client ID:** `atlas-provisioning-service`
- **Grant Type:** `client_credentials`
- **Realm:** `forge-atlas`
- **Least-Privilege Roles:**
  - `manage-users` (realm-management)
  - `view-users` (realm-management)
- **Local Dev / CI Fallback:** If `atlas.provisioning.keycloak.client-secret` is unset or blank, `HttpKeycloakProvisioningClient` falls back cleanly to the local master admin (`admin-cli` / dev password) or mock in unit tests, ensuring dev environments continue running effortlessly.

### User Provisioning Logic:
- `HttpKeycloakProvisioningClient.provisionUser(...)`: Checks if user exists by email. If absent, creates user via Keycloak Admin REST API (`POST /admin/realms/{realm}/users`) with `enabled: true`, `emailVerified: true`, and triggers `UPDATE_PASSWORD` required action so users set their own permanent password without operators ever handling credentials.
- `setUserEnabled(userId, enabled)`: Enables or disables Keycloak user synchronously when Backoffice suspends or activates an account.

---

## 5. Backend Endpoints Implemented

### 1. Provisioning Queue & Operations
- `GET /api/backoffice/v1/provisioning/jobs` — Paginated list of provisioning jobs with status filters.
- `GET /api/backoffice/v1/provisioning/jobs/{id}` — Job details and current execution status.
- `GET /api/backoffice/v1/provisioning/jobs/{id}/steps` — Step-by-step diagnostic breakdown.
- `POST /api/backoffice/v1/provisioning/jobs/{id}/approve` — Approves a `PENDING` job and runs orchestration immediately.
- `POST /api/backoffice/v1/provisioning/jobs/{id}/reject` — Rejects a `PENDING` job with reason.
- `POST /api/backoffice/v1/provisioning/jobs/{id}/retry` — Retries a `FAILED` or `RETRY` job idempotently.

### 2. Customer Management
- `GET /api/backoffice/v1/customers/{id}` — Detailed customer profile with authoritative tenants, subscription details, seat allocation, user counts, and device counts.
- `PATCH /api/backoffice/v1/customers/{id}` — Updates customer metadata (`companyName`, `contactPhone`, `billingEmail`) and status (`ACTIVE`, `SUSPENDED`, `CLOSED`). Cascades status to user identities in Keycloak.

### 3. Professional Users & Seats
- `GET /api/backoffice/v1/customers/{id}/users` — Lists all users belonging to this customer and their Keycloak sync status.
- `POST /api/backoffice/v1/customers/{id}/users` — Invites a new user (`TENANT_MEMBER` or `TENANT_ADMIN`). Enforces seat limits (`max_seats`); rejects with HTTP 409 (`SEAT_LIMIT_EXCEEDED`) if capacity is reached.
- `PATCH /api/backoffice/v1/customers/{id}/users/{userId}` — Activates, suspends, or modifies user roles. Updates Keycloak account status in real time.

### 4. Device Management
- `GET /api/backoffice/v1/customers/{id}/devices` — Lists registered devices for all customer users.
- `DELETE /api/backoffice/v1/customers/{id}/devices/{deviceId}` — Revokes device access.

### 5. Audit Trail
- `GET /api/backoffice/v1/audit-events` — Paginated immutable log of privileged platform actions (`PROVISIONING_JOB_APPROVED`, `USER_INVITED`, `USER_ACTIVATED`, `USER_DEACTIVATED`, `DEVICE_REVOKED`, `CUSTOMER_STATUS_CHANGED`).

---

## 6. Backoffice Screens Implemented

1. **Overview Dashboard (`/`):**
   - Mock provisioning cards removed.
   - Connected `ProvisioningPreviewCard` pulling live jobs from the API.
   - Live metrics for customer count, suspended accounts, and provisioning issues.
2. **Operations Queue (`/provisioning`):**
   - Filter jobs by status (`PENDING`, `PROVISIONING`, `SUCCEEDED`, `FAILED`, `REJECTED`).
   - Actions to **Approve**, **Reject**, or **Retry**.
   - **Diagnostic Modal:** Inspects individual job execution steps (`atlas.provisioning_step`), error messages, and timing.
3. **Customer Detail (`/customers/[customerId]`):**
   - **Overview Tab:** Shows authoritative tenant mappings (`atlas.atlas_tenant`), subscription plan, seat usage, and customer metadata.
   - **Users Tab:** Lists users, allows inviting new team members with seat validation, and toggle user active/suspended state.
   - **Devices Tab:** Lists registered devices with fingerprint, platform, and last-seen timestamp; provides **Revoke** action.
   - **Audit Tab:** Scoped audit history showing operator actions specifically affecting this customer.
4. **Audit Trail (`/audit`):**
   - Platform-wide searchable audit event viewer with filters for actions and operators.

---

## 7. Verification & Automated Test Results

### Backend Test Suite
Executed command:
```powershell
.\mvnw.cmd test -Dtest="BackofficeOperationsPhase1Test,CurriculumBackofficeSecurityTest,ProfessionalOnboardingSecurityTest,ProfessionalOnboardingServiceTest,ProfessionalDeviceFilterTest,ProfessionalDeviceServiceTest"
```
**Results:** `Tests run: 44, Failures: 0, Errors: 0, Skipped: 0` (BUILD SUCCESS).
- `BackofficeOperationsPhase1Test`: 12/12 passed (Lifecycle orchestration, idempotency retries, terminal failure handling, queue approve/reject/retry, seat limits, status cascading to Keycloak, customer suspension cascading).
- `ProfessionalOnboardingSecurityTest`: 15/15 passed (Role-based authorization guards on backoffice endpoints).
- `CurriculumBackofficeSecurityTest`: 8/8 passed.
- `ProfessionalDeviceFilterTest`: 3/3 passed.
- `ProfessionalDeviceServiceTest`: 4/4 passed.
- `ProfessionalOnboardingServiceTest`: 2/2 passed.

### Frontend Test Suite & Build
Executed commands:
```powershell
npm.cmd test
npm.cmd run build
```
**Results:**
- `Vitest`: 20/20 passed (`atlas-api.test.ts`).
- `Vinext Build`: All 8 routes built cleanly.
- `Localhost Leak Guard`: `[GUARD PASSED] Scanned 43 client bundle files: No localhost/dev URLs found.`

---

## 8. Claude Collision Check

A git comparison was performed against remote tracking branches (`origin/master` and `origin/main`):
- **Backend HEAD (`origin/master`):** `31bacfd` (unchanged since Phase 0).
- **Backend Files Touched by Antigravity:**
  - `src/main/java/com/nomesh/rag/onboarding/*`
  - `src/main/resources/db/migration/V18__enhance_provisioning_and_customer_operations.sql`
  - `src/test/java/com/nomesh/rag/onboarding/BackofficeOperationsPhase1Test.java`
- **Claude DO-NOT-TOUCH Register Verification:**
  - Zero modifications to `com.nomesh.rag.learn.tutor.*`
  - Zero modifications to `com.nomesh.rag.learn.controller.LearnAuthController.java`
  - Zero modifications to `com.nomesh.rag.learn.security.LearnLoginThrottle.java`
  - Zero modifications to `com.nomesh.rag.learn.service.LearnBffService.java`
  - Zero modifications to `com.nomesh.rag.learn.service.LearnCurriculumService.java`
  - Zero modifications to `src/main/resources/learn/glossary/science-si.json`
  - Zero modifications to `scripts/deploy-*` or GitHub actions.
  - Zero modifications to `atlas-learn-ui`.
- **Frontend HEAD (`origin/main`):** `87987bd` (unchanged since Phase 0).
- **Collisions Detected:** **None.**

---

## 9. Known Limitations & Phase 2 Recommendations

1. **Seats:** Phase 1 introduced a minimal clean seat abstraction (`seat_count`, `max_seats` in `user_subscription` with default `1`). Advanced commercial seat expansion, tier quotas, and plan upgrades are recommended for Phase 3.
2. **Multi-Tenant Organizations:** The schema and services now support multiple tenants per customer, but current onboarding UI defaults to 1 primary tenant per customer.
3. **Phase 2 Target:** Device fleet visibility, device entitlement enforcement policies, and telemetry health.

---

## 10. Architect Gate Status

> [!IMPORTANT]
> **MANDATORY ARCHITECT GATE REACHED**
> Phase 1 implementation is complete, tested, and committed to isolated feature branches.
> In accordance with program instructions, **execution is STOPPED**.
> No merges, production deployments, or Phase 2 tasks will proceed without explicit authorization.
