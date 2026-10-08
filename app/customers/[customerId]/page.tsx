'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Users,
  Smartphone,
  Shield,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  backofficeApi,
  type CustomerDetailDto,
  type ProfessionalUserDto,
  type DeviceDto,
  type AuditEventDto,
  AtlasApiError,
} from '@/lib/atlas-api';

export default function CustomerDetailPage() {
  const customerId =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('customerId') ??
        window.location.pathname.split('/').pop() ??
        '')
      : '';

  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'devices' | 'audit'>('overview');
  const [customer, setCustomer] = useState<CustomerDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Tab data
  const [users, setUsers] = useState<ProfessionalUserDto[]>([]);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventDto[]>([]);
  const [subLoading, setSubLoading] = useState(false);

  // Actions
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);

  // User Invite Modal
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviteRole, setInviteRole] = useState('TENANT_MEMBER');
  const [inviteError, setInviteError] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  const loadCustomer = async () => {
    if (!customerId) return;
    setLoading(true);
    setError('');
    try {
      const data = await backofficeApi.getCustomerDetail(customerId);
      setCustomer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load customer.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomer();
  }, [customerId]);

  const loadTabData = async () => {
    if (!customerId) return;
    setSubLoading(true);
    try {
      if (activeTab === 'users') {
        const u = await backofficeApi.listUsers(customerId);
        setUsers(u);
      } else if (activeTab === 'devices') {
        const d = await backofficeApi.listDevices(customerId);
        setDevices(d);
      } else if (activeTab === 'audit') {
        const a = await backofficeApi.listAuditEvents({ customerId, page: 0, size: 50 });
        setAuditEvents(a.items);
      }
    } catch (err) {
      // Tab data load errors handled inline
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => {
    loadTabData();
  }, [customerId, activeTab]);

  const handleStatusChange = async (newStatus: string) => {
    if (!customerId) return;
    setActionBusy(true);
    setActionError('');
    try {
      const updated = await backofficeApi.updateCustomer(customerId, { status: newStatus });
      setCustomer(updated);
      setConfirmStatus(null);
    } catch (cause) {
      if (cause instanceof AtlasApiError && cause.status === 409) {
        setActionError('A conflicting operation is in progress.');
      } else {
        setActionError(cause instanceof Error ? cause.message : 'Status update failed.');
      }
    } finally {
      setActionBusy(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return;
    setInviteBusy(true);
    setInviteError('');
    try {
      await backofficeApi.inviteUser(customerId, {
        email: inviteEmail,
        displayName: inviteDisplayName,
        role: inviteRole,
      });
      setInviteModalOpen(false);
      setInviteEmail('');
      setInviteDisplayName('');
      await loadTabData();
      await loadCustomer();
    } catch (err) {
      if (err instanceof AtlasApiError && err.status === 409) {
        setInviteError('Seat limit reached or user email already registered.');
      } else {
        setInviteError(err instanceof Error ? err.message : 'Failed to invite user.');
      }
    } finally {
      setInviteBusy(false);
    }
  };

  const handleToggleUserStatus = async (user: ProfessionalUserDto) => {
    if (!customerId) return;
    const targetStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await backofficeApi.updateUser(customerId, user.userId, { status: targetStatus });
      await loadTabData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'User status change failed.');
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!customerId) return;
    try {
      await backofficeApi.revokeDevice(customerId, deviceId);
      await loadTabData();
      await loadCustomer();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke device.');
    }
  };

  return (
    <main className="min-h-screen bg-background p-5 md:p-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/customers"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to customers
        </Link>

        {loading && <p className="text-sm text-muted-foreground">Loading customer…</p>}
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {customer && (
          <>
            {/* Header Card */}
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{customer.displayName}</h1>
                  <StatusBadge status={customer.status} />
                </div>
                <p className="text-sm text-muted-foreground">{customer.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Customer ID: <code className="text-xs">{customer.customerId}</code>
                </p>
              </div>

              {/* Status Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {customer.status !== 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionBusy}
                    onClick={() => setConfirmStatus('ACTIVE')}
                  >
                    Activate
                  </Button>
                )}
                {customer.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionBusy}
                    className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                    onClick={() => setConfirmStatus('SUSPENDED')}
                  >
                    Suspend
                  </Button>
                )}
                {customer.status !== 'CLOSED' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionBusy}
                    className="border-rose-500/30 text-rose-700 hover:bg-rose-500/10"
                    onClick={() => setConfirmStatus('CLOSED')}
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>

            {confirmStatus && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-semibold text-sm">
                      Confirm status change to {confirmStatus}?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This will cascade to user identity status and platform access.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleStatusChange(confirmStatus)}
                      disabled={actionBusy}
                    >
                      {actionBusy && <LoaderCircle className="size-3 animate-spin mr-1" />}
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmStatus(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {actionError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {actionError}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b pb-1">
              {[
                { id: 'overview', label: 'Overview & Tenants', icon: Building2 },
                { id: 'users', label: `Users (${customer.userCount})`, icon: Users },
                { id: 'devices', label: `Devices (${customer.deviceCount})`, icon: Smartphone },
                { id: 'audit', label: 'Audit Trail', icon: Shield },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-secondary text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted/60'
                    }`}
                  >
                    <Icon className="size-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB: Overview & Tenants */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Subscription info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Subscription & Seats</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {customer.subscription ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Plan:</span>
                            <span className="font-medium">
                              {customer.subscription.planCode} v{customer.subscription.planVersion}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Status:</span>
                            <StatusBadge status={customer.subscription.status} />
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Seat Allocation:</span>
                            <span className="font-semibold">
                              {customer.subscription.seatCount} / {customer.subscription.maxSeats} allocated
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Started:</span>
                            <span>{new Date(customer.subscription.startsAt).toLocaleDateString()}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted-foreground">No active subscription found.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Metadata */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Account Metadata</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Company:</span>
                        <span>{customer.companyName || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone:</span>
                        <span>{customer.contactPhone || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Billing Email:</span>
                        <span>{customer.billingEmail || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Registered:</span>
                        <span>{new Date(customer.createdAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Authoritative Tenants Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Authoritative Tenants ({customer.tenants.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {customer.tenants.map((t) => (
                        <div key={t.tenantId} className="flex items-center justify-between p-4">
                          <div>
                            <p className="font-semibold text-sm">{t.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Code: <code>{t.tenantCode}</code> · ID: <code>{t.tenantId}</code>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground">Region: {t.region}</span>
                            <StatusBadge status={t.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: Users */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Professional Users</h2>
                    <p className="text-xs text-muted-foreground">
                      Seats used: {customer.userCount} of {customer.subscription?.maxSeats ?? 1}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setInviteModalOpen(true)}
                    disabled={
                      (customer.subscription?.maxSeats !== undefined &&
                        customer.userCount >= customer.subscription.maxSeats)
                    }
                  >
                    <Plus className="size-4" />
                    Invite User
                  </Button>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {users.map((u) => (
                        <div key={u.userId} className="flex items-center justify-between p-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{u.displayName}</span>
                              <Badge variant="secondary" className="text-xs">
                                {u.role}
                              </Badge>
                              <StatusBadge status={u.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Keycloak ID: <code>{u.keycloakUserId ?? 'PENDING'}</code>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleUserStatus(u)}
                            >
                              {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                            </Button>
                          </div>
                        </div>
                      ))}

                      {users.length === 0 && !subLoading && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No users provisioned for this customer yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: Devices */}
            {activeTab === 'devices' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Registered Devices</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {devices.map((d) => (
                        <div key={d.deviceId} className="flex items-center justify-between p-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {d.platform} ({d.deviceFingerprint})
                              </span>
                              <StatusBadge status={d.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Assigned User: {d.userEmail ?? d.userId}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Registered: {new Date(d.registeredAt).toLocaleString()} · Last Seen:{' '}
                              {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'Never'}
                            </p>
                          </div>
                          {d.status === 'ACTIVE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleRevokeDevice(d.deviceId)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}

                      {devices.length === 0 && !subLoading && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No devices registered.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: Audit */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Customer Audit History</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {auditEvents.map((a) => (
                        <div key={a.eventId} className="p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {a.action}
                              </Badge>
                              <span className="font-medium text-foreground">
                                {a.resourceType} · {a.resourceId}
                              </span>
                            </div>
                            <span className="text-muted-foreground text-[11px]">
                              {new Date(a.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-muted-foreground">
                            Operator: {a.operatorId}
                          </p>
                          {a.detailsJson && (
                            <pre className="mt-1 overflow-x-auto rounded bg-muted/40 p-1 font-mono text-[10px] text-muted-foreground">
                              {a.detailsJson}
                            </pre>
                          )}
                        </div>
                      ))}

                      {auditEvents.length === 0 && !subLoading && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No audit entries recorded for this customer.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </div>

      {/* Invite User Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Professional User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInviteUser} className="space-y-4 pt-2">
            {inviteError && (
              <div className="rounded bg-destructive/10 p-2 text-xs text-destructive">
                {inviteError}
              </div>
            )}
            <div>
              <label className="text-xs font-medium">Full Name</label>
              <Input
                required
                value={inviteDisplayName}
                onChange={(e) => setInviteDisplayName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Email Address</label>
              <Input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Role</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="TENANT_MEMBER">Tenant Member</option>
                <option value="TENANT_ADMIN">Tenant Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setInviteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={inviteBusy}>
                {inviteBusy && <LoaderCircle className="size-3 animate-spin mr-1" />}
                Send Invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-700'
      : status === 'PROVISIONING'
      ? 'bg-blue-500/10 text-blue-700'
      : status === 'SUSPENDED'
      ? 'bg-amber-500/10 text-amber-700'
      : 'bg-rose-500/10 text-rose-700';

  return (
    <Badge variant="outline" className={`border-0 font-medium ${style}`}>
      {status.toLowerCase()}
    </Badge>
  );
}
