'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GraduationCap,
  Smartphone,
  CreditCard,
  Trash2,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  backofficeApi,
  type LearnStudentBackofficeDetailDto,
  AtlasApiError,
} from '@/lib/atlas-api';

export default function LearnStudentDetailPage() {
  const studentId =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('studentId') ??
        window.location.pathname.split('/').pop() ??
        '')
      : '';

  const [student, setStudent] = useState<LearnStudentBackofficeDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'devices' | 'payments'>('overview');

  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Entitlement management state
  const [accountType, setAccountType] = useState<'STUDENT' | 'DEMO' | 'QA'>('STUDENT');
  const [defaultGrade, setDefaultGrade] = useState('grade-10');
  const [allowedGrades, setAllowedGrades] = useState<string[]>(['grade-10']);

  const loadStudent = async () => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    try {
      const data = await backofficeApi.getLearnStudentDetail(studentId);
      setStudent(data);
      if (data.accountType) {
        setAccountType(data.accountType);
      }
      if (data.grade) {
        setDefaultGrade(data.grade);
      }
      if (data.allowedGrades && data.allowedGrades.length > 0) {
        setAllowedGrades(data.allowedGrades);
      } else if (data.grade) {
        setAllowedGrades([data.grade]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudent();
  }, [studentId]);

  const handleUpdateEntitlements = async () => {
    if (!studentId) return;
    setActionBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      const updated = await backofficeApi.updateLearnStudentEntitlements(studentId, {
        accountType,
        defaultGrade,
        allowedGrades: accountType === 'STUDENT' ? [defaultGrade] : allowedGrades,
      });
      setActionSuccess('Entitlements updated successfully.');
      await loadStudent();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update entitlements');
    } finally {
      setActionBusy(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!studentId) return;
    setActionBusy(true);
    setActionError('');
    try {
      const updated = await backofficeApi.updateLearnStudentStatus(studentId, newStatus);
      setStudent(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Status change failed');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!studentId) return;
    setActionBusy(true);
    setActionError('');
    try {
      await backofficeApi.revokeLearnStudentDevice(studentId, deviceId);
      await loadStudent();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Device revocation failed');
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-5 md:p-10 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link
          href="/learn/students"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to students
        </Link>

        {loading && <p className="text-sm text-muted-foreground">Loading student…</p>}
        {error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {student && (
          <>
            <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold">{student.fullName}</h1>
                  <StatusBadge status={student.status} />
                </div>
                <p className="text-sm text-muted-foreground">
                  Student ID: <code className="font-semibold">{student.studentId}</code> · Username: <code>{student.username}</code>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Keycloak Subject: <code>{student.keycloakUserId}</code>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {student.status !== 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionBusy}
                    onClick={() => handleStatusChange('ACTIVE')}
                  >
                    Activate
                  </Button>
                )}
                {student.status === 'ACTIVE' && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actionBusy}
                    className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                    onClick={() => handleStatusChange('SUSPENDED')}
                  >
                    Suspend
                  </Button>
                )}
              </div>
            </div>

            {actionError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {actionError}
              </div>
            )}

            {/* Tab navigation */}
            <div className="flex gap-2 border-b pb-1">
              {[
                { id: 'overview', label: 'Overview & Profile', icon: GraduationCap },
                { id: 'devices', label: `Devices (${student.activeDevicesCount}/2)`, icon: Smartphone },
                { id: 'payments', label: `Payment Slips (${student.payments.length})`, icon: CreditCard },
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

            {/* TAB: Overview */}
            {activeTab === 'overview' && (
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Curriculum & Student Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registered Grade:</span>
                      <span className="font-medium">{student.grade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Language Medium:</span>
                      <span className="font-medium">{student.preferredLanguage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mobile Contact:</span>
                      <span>{student.mobileNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account Status:</span>
                      <StatusBadge status={student.status} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Account Foundation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account ID:</span>
                      <code className="text-xs">{student.accountId}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">User ID:</span>
                      <code className="text-xs">{student.userId}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Enrolled At:</span>
                      <span>{student.createdAt ? new Date(student.createdAt).toLocaleDateString() : '—'}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Controlled Entitlements & Multi-Grade Access Card */}
                <Card className="md:col-span-2 border-primary/20">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="size-4 text-primary" />
                        Account Type & Authoritative Grade Entitlements
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Configure controlled multi-grade access for internal DEMO and QA profiles. Normal students remain strictly single-grade.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={actionBusy}
                      onClick={handleUpdateEntitlements}
                    >
                      {actionBusy ? 'Saving…' : 'Save Entitlements'}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-2 text-sm">
                    {actionSuccess && (
                      <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-700 font-medium">
                        {actionSuccess}
                      </div>
                    )}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Account Classification</label>
                        <select
                          value={accountType}
                          onChange={(e) => {
                            const val = e.target.value as 'STUDENT' | 'DEMO' | 'QA';
                            setAccountType(val);
                            if (val === 'STUDENT') {
                              setAllowedGrades([defaultGrade]);
                            }
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="STUDENT">STUDENT (Single registered grade)</option>
                          <option value="DEMO">DEMO (Controlled multi-grade showcase)</option>
                          <option value="QA">QA (Multi-grade test & validation)</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">Default / Registered Grade</label>
                        <select
                          value={defaultGrade}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDefaultGrade(val);
                            if (accountType === 'STUDENT') {
                              setAllowedGrades([val]);
                            } else if (!allowedGrades.includes(val)) {
                              setAllowedGrades([...allowedGrades, val]);
                            }
                          }}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {[6, 7, 8, 9, 10, 11].map((g) => (
                            <option key={g} value={`grade-${g}`}>
                              Grade {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold uppercase text-muted-foreground">
                          Authorized Grade Entitlements
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {accountType === 'STUDENT'
                            ? 'Locked to default grade for STUDENT'
                            : `Selected: ${allowedGrades.join(', ')}`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {[6, 7, 8, 9, 10, 11].map((g) => {
                          const gradeKey = `grade-${g}`;
                          const isChecked = allowedGrades.includes(gradeKey);
                          const isDefault = defaultGrade === gradeKey;
                          const disabled = accountType === 'STUDENT';

                          return (
                            <label
                              key={g}
                              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                                isChecked
                                  ? 'border-primary/50 bg-primary/10 text-primary'
                                  : 'border-input hover:bg-muted/40 text-muted-foreground'
                              } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={disabled}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setAllowedGrades([...allowedGrades, gradeKey]);
                                  } else {
                                    // Prevent deselecting default grade
                                    if (isDefault) {
                                      return;
                                    }
                                    setAllowedGrades(allowedGrades.filter((x) => x !== gradeKey));
                                  }
                                }}
                                className="rounded border-input text-primary focus:ring-primary size-3.5"
                              />
                              Grade {g} {isDefault ? '(Default)' : ''}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: Devices */}
            {activeTab === 'devices' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Registered Devices</h2>
                  <span className="text-xs text-muted-foreground">
                    Policy limit: Maximum 2 devices
                  </span>
                </div>

                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {student.registeredDevices.map((d) => (
                        <div key={d.id} className="flex items-center justify-between p-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{d.deviceName}</span>
                              <StatusBadge status={d.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">{d.userAgentSummary}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Registered: {new Date(d.registeredAt).toLocaleString()} · Last Seen:{' '}
                              {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : 'Never'}
                            </p>
                          </div>
                          {d.status === 'ACTIVE' && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionBusy}
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleRevokeDevice(d.id)}
                            >
                              Revoke
                            </Button>
                          )}
                        </div>
                      ))}

                      {student.registeredDevices.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No devices registered for this student.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB: Payments */}
            {activeTab === 'payments' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Payment Slip Submissions</h2>
                <Card>
                  <CardContent className="p-0">
                    <div className="divide-y">
                      {student.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {p.currency} {p.amount.toLocaleString()}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {p.billingPeriod}
                              </Badge>
                              <StatusBadge status={p.status} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              File: {p.originalFilename} ({(p.fileSizeBytes / 1024).toFixed(1)} KB)
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Submitted: {new Date(p.submittedAt).toLocaleString()}
                              {p.reviewedBy && ` · Reviewed by: ${p.reviewedBy}`}
                            </p>
                            {p.rejectionReason && (
                              <p className="text-xs text-destructive">Reason: {p.rejectionReason}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => location.assign('/learn/payments')}
                            >
                              Review in Queue
                            </Button>
                          </div>
                        </div>
                      ))}

                      {student.payments.length === 0 && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                          No payment slips submitted by this student.
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
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-700'
      : status === 'PENDING_PAYMENT' || status === 'PENDING_REVIEW'
      ? 'bg-amber-500/10 text-amber-700'
      : status === 'SUSPENDED' || status === 'REJECTED'
      ? 'bg-rose-500/10 text-rose-700'
      : 'bg-gray-500/10 text-gray-700';

  return (
    <Badge variant="outline" className={`border-0 font-medium ${style}`}>
      {status.toLowerCase()}
    </Badge>
  );
}
