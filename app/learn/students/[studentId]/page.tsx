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

  const loadStudent = async () => {
    if (!studentId) return;
    setLoading(true);
    setError('');
    try {
      const data = await backofficeApi.getLearnStudentDetail(studentId);
      setStudent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudent();
  }, [studentId]);

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
