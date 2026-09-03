'use client';
import { ArrowLeft, CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  backofficeApi,
  type ProfessionalOnboardingResponse,
  AtlasApiError,
} from '@/lib/atlas-api';

export default function CustomerDetailPage() {
  const customerId =
    typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('customerId') ??
        window.location.pathname.split('/').pop() ??
        '')
      : '';
  const [customer, setCustomer] =
    useState<ProfessionalOnboardingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  useEffect(() => {
    if (!customerId) return;
    queueMicrotask(() => {
      setLoading(true);
      setError('');
    });
    backofficeApi
      .getCustomer(customerId)
      .then((data) => setCustomer(data))
      .catch((cause) =>
        setError(
          cause instanceof Error ? cause.message : 'Unable to load customer.',
        ),
      )
      .finally(() => setLoading(false));
  }, [customerId]);
  async function transitionStatus(newStatus: string) {
    if (!customerId) return;
    setActionBusy(true);
    setActionError('');
    try {
      const updated = await backofficeApi.updateCustomerStatus(
        customerId,
        newStatus,
      );
      setCustomer(updated);
      setConfirmAction(null);
    } catch (cause) {
      if (cause instanceof AtlasApiError && cause.status === 409) {
        setActionError('A conflicting operation is in progress.');
      } else {
        setActionError(
          cause instanceof Error ? cause.message : 'Status update failed.',
        );
      }
    } finally {
      setActionBusy(false);
    }
  }
  return (
    <main className="min-h-screen bg-background p-5 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/customers"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to customers
        </Link>
        {loading && (
          <p className="text-sm text-muted-foreground">Loading customer…</p>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {customer && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{customer.tenantId}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {customer.customerId}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Subscription
                    </p>
                    <p className="truncate text-sm">
                      {customer.subscriptionId}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Tenant
                    </p>
                    <p className="truncate text-sm">{customer.tenantId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      User
                    </p>
                    <p className="truncate text-sm">{customer.userId}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Provisioning Job
                    </p>
                    <p className="truncate text-sm">
                      {customer.provisioningJobId}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Customer Status
                    </p>
                    <p className="truncate text-sm">
                      {customer.customerStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Provisioning
                    </p>
                    <p className="truncate text-sm">
                      {customer.provisioningStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Identity
                    </p>
                    <p className="truncate text-sm">
                      {customer.identityStatus}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Plan
                    </p>
                    <p className="truncate text-sm">
                      {customer.planCode} v{customer.planVersion}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Storage Quota
                    </p>
                    <p className="truncate text-sm">
                      {customer.storageQuotaBytes} bytes
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Max Devices
                    </p>
                    <p className="truncate text-sm">
                      {customer.maxRegisteredDevices}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Lifecycle actions</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage this customer status. Destructive actions require
                  confirmation.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={
                      actionBusy || customer.customerStatus === 'SUSPENDED'
                    }
                    onClick={() => setConfirmAction('SUSPENDED')}
                  >
                    Suspend
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      actionBusy || customer.customerStatus === 'ACTIVE'
                    }
                    onClick={() => setConfirmAction('ACTIVE')}
                  >
                    Reactivate
                  </Button>
                  <Button
                    variant="outline"
                    disabled={
                      actionBusy || customer.customerStatus === 'CLOSED'
                    }
                    className="border-rose-500/30 text-rose-700 hover:bg-rose-500/10"
                    onClick={() => setConfirmAction('CLOSED')}
                  >
                    Close
                  </Button>
                </div>
                {confirmAction && (
                  <Card className="border-rose-500/30">
                    <CardContent className="flex gap-3 pt-6">
                      <CheckCircle2 className="text-rose-600 shrink-0" />
                      <div>
                        <p className="font-semibold">Confirm {confirmAction}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Are you sure you want to set status to{' '}
                          {confirmAction.toLowerCase()}?
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => transitionStatus(confirmAction)}
                            disabled={actionBusy}
                          >
                            {actionBusy && (
                              <LoaderCircle className="animate-spin" />
                            )}
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmAction(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {actionError && (
                  <p
                    role="alert"
                    className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {actionError}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
