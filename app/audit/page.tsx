'use client';
import { useState, useEffect } from 'react';
import { RefreshCw, Search, Shield, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SidebarNav } from '@/components/SidebarNav';
import {
  backofficeApi,
  type AuditEventDto,
  type AuditPageDto,
} from '@/lib/atlas-api';

export default function AuditPage() {
  const [data, setData] = useState<AuditPageDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);

  const fetchAudit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await backofficeApi.listAuditEvents({
        action: actionFilter || undefined,
        page,
        size: 25,
      });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, [actionFilter, page]);

  const events = data?.items ?? [];
  const totalPages = data?.totalPages ?? 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <SidebarNav active="/audit" />
        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b bg-card/80 px-5 backdrop-blur md:px-8">
            <div className="flex items-center gap-2">
              <Shield className="size-5 text-primary" />
              <div>
                <h1 className="text-lg font-semibold">Security & Operations Audit Trail</h1>
                <p className="text-xs text-muted-foreground">
                  Immutable record of privileged operations and lifecycle mutations
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAudit}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </header>

          <div className="mx-auto max-w-[1440px] space-y-6 p-5 md:p-8">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Action Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                '',
                'PROVISIONING_JOB_CREATED',
                'PROVISIONING_JOB_APPROVED',
                'PROVISIONING_JOB_REJECTED',
                'PROVISIONING_JOB_RETRIED',
                'USER_INVITED',
                'USER_ACTIVATED',
                'USER_DEACTIVATED',
                'DEVICE_REVOKED',
                'CUSTOMER_STATUS_CHANGED',
              ].map((act) => (
                <button
                  key={act}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    actionFilter === act
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => {
                    setActionFilter(act);
                    setPage(0);
                  }}
                >
                  {act || 'All Actions'}
                </button>
              ))}
            </div>

            <Card>
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-base font-medium">
                  Audit Events ({data?.totalItems ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {events.map((ev) => (
                    <div
                      key={ev.eventId}
                      className="flex flex-col gap-2 p-4 text-xs hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-[11px]">
                            {ev.action}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {ev.resourceType} · {ev.resourceId}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          Operator: <span className="text-foreground">{ev.operatorId}</span>
                          {ev.customerId && ` · Customer: ${ev.customerId}`}
                          {ev.tenantId && ` · Tenant: ${ev.tenantId}`}
                          {ev.ipAddress && ` · IP: ${ev.ipAddress}`}
                        </p>
                        {ev.detailsJson && (
                          <pre className="mt-1 max-w-2xl overflow-x-auto rounded bg-muted/40 p-1.5 font-mono text-[10px] text-muted-foreground">
                            {ev.detailsJson}
                          </pre>
                        )}
                      </div>
                      <div className="shrink-0 text-right text-muted-foreground">
                        {new Date(ev.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))}

                  {!loading && events.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No audit events found.
                    </div>
                  )}
                </div>

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
    </main>
  );
}
