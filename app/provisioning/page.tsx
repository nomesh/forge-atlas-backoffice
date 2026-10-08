'use client';
import { useState, useEffect } from 'react';
import {
  Clock3,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  ArrowRight,
  Search,
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
import { SidebarNav } from '@/components/SidebarNav';
import {
  backofficeApi,
  type ProvisioningJobDto,
  type ProvisioningStepDto,
  type ProvisioningPageDto,
  AtlasApiError,
} from '@/lib/atlas-api';

export default function ProvisioningPage() {
  const [data, setData] = useState<ProvisioningPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);

  // Detail / Step inspector dialog
  const [selectedJob, setSelectedJob] = useState<ProvisioningJobDto | null>(null);
  const [steps, setSteps] = useState<ProvisioningStepDto[]>([]);
  const [stepsLoading, setStepsLoading] = useState(false);

  // Action states
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const fetchJobs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await backofficeApi.listJobs({
        status: statusFilter || undefined,
        page,
        size: 20,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [statusFilter, page]);

  const openStepsModal = async (job: ProvisioningJobDto) => {
    setSelectedJob(job);
    setStepsLoading(true);
    try {
      const jobSteps = await backofficeApi.getJobSteps(job.jobId);
      setSteps(jobSteps);
    } catch {
      setSteps([]);
    } finally {
      setStepsLoading(false);
    }
  };

  const handleApprove = async (jobId: string) => {
    setActionBusy(jobId);
    setActionError('');
    try {
      await backofficeApi.approveJob(jobId);
      await fetchJobs();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approve failed');
    } finally {
      setActionBusy(null);
    }
  };

  const handleReject = async (jobId: string) => {
    setActionBusy(jobId);
    setActionError('');
    try {
      await backofficeApi.rejectJob(jobId);
      await fetchJobs();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Reject failed');
    } finally {
      setActionBusy(null);
    }
  };

  const handleRetry = async (jobId: string) => {
    setActionBusy(jobId);
    setActionError('');
    try {
      await backofficeApi.retryJob(jobId);
      await fetchJobs();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setActionBusy(null);
    }
  };

  const jobs = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <SidebarNav active="/provisioning" />
        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b bg-card/80 px-5 backdrop-blur md:px-8">
            <div>
              <h1 className="text-lg font-semibold">Provisioning Operations Queue</h1>
              <p className="text-xs text-muted-foreground">
                Authoritative pipeline tracking and operator overrides
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchJobs}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </header>

          <div className="mx-auto max-w-[1440px] space-y-6 p-5 md:p-8">
            {actionError && (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {actionError}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {['', 'PENDING', 'PROVISIONING', 'SUCCEEDED', 'FAILED', 'REJECTED'].map((st) => (
                <button
                  key={st}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(0);
                  }}
                >
                  {st || 'All Statuses'}
                </button>
              ))}
            </div>

            {/* Table / List */}
            <Card>
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-base font-medium">
                  Provisioning Jobs ({data?.totalItems ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {jobs.map((job) => (
                    <div
                      key={job.jobId}
                      className="flex flex-col gap-4 p-5 hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {job.customerName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({job.customerEmail})
                          </span>
                          <StatusBadge status={job.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Job: <code className="text-xs">{job.jobId}</code> · Plan:{' '}
                          <span className="font-medium text-foreground">{job.planCode}</span>
                          {job.tenantId && ` · Tenant: ${job.tenantId}`}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          Step: <span className="font-medium text-foreground">{job.currentStep ?? 'N/A'}</span>
                          {job.errorMessage && (
                            <span className="ml-2 font-medium text-destructive">
                              Error: {job.errorMessage}
                            </span>
                          )}
                          <span className="ml-2">
                            Retries: {job.retryCount}/{job.maxRetries}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-start md:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStepsModal(job)}
                        >
                          View Steps
                        </Button>
                        {job.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              disabled={actionBusy === job.jobId}
                              onClick={() => handleApprove(job.jobId)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionBusy === job.jobId}
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleReject(job.jobId)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                        {(job.status === 'FAILED' || job.status === 'RETRY') && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={actionBusy === job.jobId || !job.eligibleForRetry}
                            onClick={() => handleRetry(job.jobId)}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {!loading && jobs.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No provisioning jobs found matching this criteria.
                    </div>
                  )}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between border-t bg-muted/20 px-5 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page + 1} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>

      {/* Step Inspector Modal */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Provisioning Diagnostics: {selectedJob?.customerName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-xs text-muted-foreground">
              Job ID: <code>{selectedJob?.jobId}</code> · Status: {selectedJob?.status}
            </div>
            {stepsLoading ? (
              <p className="text-sm text-muted-foreground">Loading steps…</p>
            ) : steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No step records created yet.</p>
            ) : (
              <div className="space-y-3">
                {steps.map((st) => (
                  <div
                    key={st.stepId}
                    className="rounded-lg border p-3 text-xs space-y-1 bg-card"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        {st.stepOrder}. {st.stepName}
                      </span>
                      <StatusBadge status={st.status} />
                    </div>
                    {st.errorMessage && (
                      <p className="text-destructive font-mono mt-1">
                        {st.errorMessage}
                      </p>
                    )}
                    {st.diagnosticsJson && (
                      <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">
                        {st.diagnosticsJson}
                      </pre>
                    )}
                    <div className="text-[11px] text-muted-foreground pt-1">
                      Started: {st.startedAt ? new Date(st.startedAt).toLocaleTimeString() : '—'}
                      {' · '}
                      Completed: {st.completedAt ? new Date(st.completedAt).toLocaleTimeString() : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'SUCCEEDED'
      ? 'bg-emerald-500/10 text-emerald-700'
      : status === 'PROVISIONING' || status === 'RUNNING'
      ? 'bg-blue-500/10 text-blue-700'
      : status === 'PENDING'
      ? 'bg-amber-500/10 text-amber-700'
      : status === 'FAILED'
      ? 'bg-rose-500/10 text-rose-700'
      : 'bg-gray-500/10 text-gray-700';

  return (
    <Badge variant="outline" className={`border-0 font-medium ${style}`}>
      {status.toLowerCase()}
    </Badge>
  );
}
