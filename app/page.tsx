'use client';
import {
  Bell,
  Building2,
  ChevronRight,
  CircleCheck,
  Clock3,
  Plus,
  Search,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';
import { backofficeApi, type ProfessionalOnboardingPage } from '@/lib/atlas-api';
import { SidebarNav } from '@/components/SidebarNav';

export default function Home() {
  const [pageData, setPageData] = useState<ProfessionalOnboardingPage | null>(
    null,
  );
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setError('');
      backofficeApi
        .listCustomers({
          q: query,
          status: statusFilter,
          page: currentPage,
          size: 20,
        })
        .then((data) => setPageData(data))
        .catch((cause) =>
          setError(
            cause instanceof Error
              ? cause.message
              : 'Unable to load customers.',
          ),
        );
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, statusFilter, currentPage]);
  const customers = pageData?.items ?? [];
  const totalPages = pageData?.totalPages ?? 0;
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <SidebarNav />
        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b bg-card/80 px-5 backdrop-blur md:px-8">
            <div>
              <p className="text-sm font-medium lg:hidden">ATLAS Backoffice</p>
              <p className="hidden text-sm text-muted-foreground lg:block">
                Professional customer operations
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell />
              </Button>
              <div className="ml-1 grid size-9 place-items-center rounded-full bg-secondary text-xs font-semibold">
                NP
              </div>
            </div>
          </header>
          <div className="mx-auto max-w-[1440px] space-y-7 p-5 md:p-8">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="mb-1 text-sm font-medium text-primary">
                  Sunday, 30 August
                </p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  Good morning, Nimesh
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Here&apos;s what needs the operations team&apos;s attention today.
                </p>
              </div>
              <Button
                className="gap-2 self-start"
                onClick={() => location.assign('/customers/new')}
              >
                <Plus className="size-4" />
                Register professional customer
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Metric
                title="Professional customers"
                value={String(pageData?.totalItems ?? 0)}
                note="Registered accounts"
                tone="calm"
              />
              <Metric
                title="Suspended customers"
                value={String(
                  customers.filter((c) => c.customerStatus === 'SUSPENDED')
                    .length,
                )}
                note="Needs staff review"
                tone="warn"
              />
              <Metric
                title="Provisioning issues"
                value={String(
                  customers.filter((c) => c.provisioningStatus === 'FAILED')
                    .length,
                )}
                note="Requires attention"
                tone="alert"
              />
            </div>
            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <Card className="overflow-hidden py-0">
                <CardHeader className="flex-row items-center justify-between border-b px-5 py-5">
                  <div>
                    <CardTitle>Professional customers</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Recent accounts and subscription health
                    </p>
                  </div>
                  <div className="relative hidden sm:block">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="w-60 pl-9"
                      placeholder="Search customers"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setCurrentPage(0);
                      }}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex flex-wrap gap-2 px-5 pt-3">
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === '' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
                      onClick={() => {
                        setStatusFilter('');
                        setCurrentPage(0);
                      }}
                    >
                      All
                    </button>
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === 'ACTIVE' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
                      onClick={() => {
                        setStatusFilter(
                          statusFilter === 'ACTIVE' ? '' : 'ACTIVE',
                        );
                        setCurrentPage(0);
                      }}
                    >
                      Active
                    </button>
                    <button
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${statusFilter === 'SUSPENDED' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary/80'}`}
                      onClick={() => {
                        setStatusFilter(
                          statusFilter === 'SUSPENDED' ? '' : 'SUSPENDED',
                        );
                        setCurrentPage(0);
                      }}
                    >
                      Suspended
                    </button>
                  </div>
                  <div className="divide-y">
                    {customers.map((customer) => (
                      <button
                        key={customer.customerId}
                        className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/55 md:grid-cols-[1.35fr_1fr_150px_80px]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-semibold text-primary">
                            {customer.displayName[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {customer.displayName}
                            </p>
                            <p className="truncate text-sm text-muted-foreground">
                              {customer.email}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={customer.customerStatus} />
                        <div className="hidden md:block">
                          <div className="mb-2 flex justify-between text-xs">
                            <span>
                              {customer.planCode} v{customer.planVersion}
                            </span>
                            <span className="font-medium">
                              {customer.customerStatus}
                            </span>
                          </div>
                        </div>
                        <div className="hidden items-center justify-end gap-2 text-sm text-muted-foreground md:flex">
                          <span>
                            {customer.createdAt
                              ? new Date(customer.createdAt).toLocaleDateString(
                                  undefined,
                                  { month: 'short', day: 'numeric' },
                                )
                              : '—'}
                          </span>
                          <ChevronRight className="size-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                  {!error && !customers.length && (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No Professional customers registered yet.
                    </p>
                  )}
                  <div className="border-t bg-muted/30 px-5 py-3 flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 0}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage + 1} of {totalPages || 1}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock3 className="size-5 text-primary" />
                      Provisioning queue
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <QueueItem
                      name="Verde Advisory"
                      detail="Identity setup · Attempt 2"
                    />
                    <QueueItem
                      name="Oriel Partners"
                      detail="Workspace allocation · 7 min"
                    />
                    <Button variant="outline" className="w-full">
                      Open operations queue
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-primary/20 bg-primary/[0.045]">
                  <CardContent className="flex gap-3 pt-6">
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Systems operational</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Usage reconciliation and notification delivery completed
                        successfully.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone: 'calm' | 'warn' | 'alert';
}) {
  const colors = {
    calm: 'bg-primary/10 text-primary',
    warn: 'bg-amber-500/10 text-amber-700',
    alert: 'bg-rose-500/10 text-rose-700',
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <span className={`size-2.5 rounded-full ${colors[tone]}`} />
        </div>
        <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        <p
          className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-medium ${colors[tone]}`}
        >
          {note}
        </p>
      </CardContent>
    </Card>
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
          : 'bg-gray-500/10 text-gray-700';
  return (
    <Badge
      variant="outline"
      className={`justify-self-end border-0 md:justify-self-start ${style}`}
    >
      {status.toLowerCase()}
    </Badge>
  );
}
function QueueItem({ name, detail }: { name: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-9 place-items-center rounded-lg bg-secondary">
        <Building2 className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
    </div>
  );
}
