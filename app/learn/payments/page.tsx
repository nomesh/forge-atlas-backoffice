'use client';
import { useState, useEffect } from 'react';
import {
  CreditCard,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
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
import { SidebarNav } from '@/components/SidebarNav';
import {
  backofficeApi,
  type LearnPaymentSlipDto,
  type LearnPaymentPageDto,
} from '@/lib/atlas-api';

export default function LearnPaymentsQueuePage() {
  const [data, setData] = useState<LearnPaymentPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [page, setPage] = useState(0);

  // Evidence preview modal
  const [previewPayment, setPreviewPayment] = useState<LearnPaymentSlipDto | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // Reject modal
  const [rejectPayment, setRejectPayment] = useState<LearnPaymentSlipDto | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await backofficeApi.listLearnPayments({
        status: statusFilter || undefined,
        page,
        size: 20,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, page]);

  const handleOpenPreview = async (payment: LearnPaymentSlipDto) => {
    setPreviewPayment(payment);
    setPreviewLoading(true);
    setPreviewUrl('');
    try {
      const res = await backofficeApi.getLearnPaymentPreviewUrl(payment.id);
      setPreviewUrl(res.previewUrl);
    } catch {
      // Fallback to direct evidence download link
      setPreviewUrl(`/api/backoffice/v1/learn/payments/${payment.id}/evidence`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApprove = async (paymentId: string) => {
    setActionBusy(paymentId);
    setActionError('');
    try {
      await backofficeApi.approveLearnPayment(paymentId);
      await fetchPayments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionBusy(null);
    }
  };

  const handleRejectConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectPayment || !rejectionReason.trim()) return;
    setActionBusy(rejectPayment.id);
    setActionError('');
    try {
      await backofficeApi.rejectLearnPayment(rejectPayment.id, rejectionReason.trim());
      setRejectPayment(null);
      setRejectionReason('');
      await fetchPayments();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setActionBusy(null);
    }
  };

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <SidebarNav active="/learn/payments" />
        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b bg-card/80 px-5 backdrop-blur md:px-8">
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              <div>
                <h1 className="text-lg font-semibold">ATLAS Learn Payment Slip Review Queue</h1>
                <p className="text-xs text-muted-foreground">
                  Manual slip verification, secure evidence review, and account activation
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchPayments}
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
              {[
                { id: 'PENDING_REVIEW', label: 'Pending Review' },
                { id: 'APPROVED', label: 'Approved' },
                { id: 'REJECTED', label: 'Rejected' },
                { id: '', label: 'All Submissions' },
              ].map((filter) => (
                <button
                  key={filter.id}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    statusFilter === filter.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => {
                    setStatusFilter(filter.id);
                    setPage(0);
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* List */}
            <Card>
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-base font-medium">
                  Payment Slips ({data?.totalItems ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {items.map((slip) => (
                    <div
                      key={slip.id}
                      className="flex flex-col gap-4 p-5 hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {slip.studentName || slip.studentId}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            ({slip.studentId})
                          </span>
                          <StatusBadge status={slip.status} />
                          <Badge variant="outline" className="text-xs">
                            {slip.currency} {slip.amount.toLocaleString()}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {slip.billingPeriod}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          File: <span className="font-medium text-foreground">{slip.originalFilename}</span>{' '}
                          ({(slip.fileSizeBytes / 1024).toFixed(1)} KB) · Submitted:{' '}
                          <span>{new Date(slip.submittedAt).toLocaleString()}</span>
                          {slip.reviewedBy && ` · Reviewed by: ${slip.reviewedBy}`}
                        </p>
                        {slip.rejectionReason && (
                          <p className="text-xs text-destructive font-medium">
                            Rejection Reason: {slip.rejectionReason}
                          </p>
                        )}
                        {slip.notes && (
                          <p className="text-xs text-muted-foreground">Notes: {slip.notes}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 self-start md:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => handleOpenPreview(slip)}
                        >
                          <Eye className="size-3.5" />
                          View Slip
                        </Button>

                        {slip.status === 'PENDING_REVIEW' && (
                          <>
                            <Button
                              size="sm"
                              disabled={actionBusy === slip.id}
                              onClick={() => handleApprove(slip.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={actionBusy === slip.id}
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setRejectPayment(slip)}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {!loading && items.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No payment slip submissions found in this state.
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

      {/* Evidence Preview Modal */}
      <Dialog open={!!previewPayment} onOpenChange={() => setPreviewPayment(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Payment Slip Evidence: {previewPayment?.studentName} ({previewPayment?.studentId})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Amount: {previewPayment?.currency} {previewPayment?.amount.toLocaleString()}</span>
              <span>Billing Period: {previewPayment?.billingPeriod}</span>
            </div>

            {previewLoading ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <LoaderCircle className="mx-auto size-6 animate-spin mb-2" />
                Loading secure evidence preview…
              </div>
            ) : previewPayment?.contentType === 'application/pdf' ? (
              <div className="rounded border p-4 text-center">
                <FileText className="mx-auto size-12 text-primary mb-2" />
                <p className="text-sm font-medium">{previewPayment.originalFilename}</p>
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-block text-xs font-semibold text-primary underline"
                >
                  Open PDF in Secure Viewer
                </a>
              </div>
            ) : (
              <div className="flex justify-center overflow-hidden rounded-lg border bg-muted/20 p-2">
                <img
                  src={previewUrl}
                  alt="Payment Evidence Slip"
                  className="max-h-[500px] object-contain rounded"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Modal */}
      <Dialog open={!!rejectPayment} onOpenChange={() => setRejectPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Payment Slip</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRejectConfirm} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium">Rejection Reason (Mandatory)</label>
              <textarea
                required
                className="w-full mt-1 rounded-md border border-input bg-background p-2 text-sm"
                rows={3}
                placeholder="e.g. Incomplete transaction reference, incorrect bank account, or blurry receipt"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRejectPayment(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="destructive"
                disabled={actionBusy === rejectPayment?.id || !rejectionReason.trim()}
              >
                Confirm Rejection
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
    status === 'APPROVED'
      ? 'bg-emerald-500/10 text-emerald-700'
      : status === 'PENDING_REVIEW'
      ? 'bg-amber-500/10 text-amber-700'
      : status === 'REJECTED'
      ? 'bg-rose-500/10 text-rose-700'
      : 'bg-gray-500/10 text-gray-700';

  return (
    <Badge variant="outline" className={`border-0 font-medium ${style}`}>
      {status.toLowerCase()}
    </Badge>
  );
}
