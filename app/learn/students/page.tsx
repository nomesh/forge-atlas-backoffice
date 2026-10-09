'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Search,
  RefreshCw,
  ChevronRight,
  Smartphone,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SidebarNav } from '@/components/SidebarNav';
import {
  backofficeApi,
  type LearnStudentSummaryDto,
} from '@/lib/atlas-api';

export default function LearnStudentsPage() {
  const [students, setStudents] = useState<LearnStudentSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const fetchStudents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await backofficeApi.searchLearnStudents(query || undefined);
      setStudents(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[248px_1fr]">
        <SidebarNav active="/learn/students" />
        <section className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b bg-card/80 px-5 backdrop-blur md:px-8">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-5 text-primary" />
              <div>
                <h1 className="text-lg font-semibold">ATLAS Learn Student Operations</h1>
                <p className="text-xs text-muted-foreground">
                  Authoritative student enrollment directory and account lifecycle
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStudents}
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

            <div className="flex items-center justify-between gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by Student ID, name, username, or mobile..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <Card>
              <CardHeader className="border-b px-5 py-4">
                <CardTitle className="text-base font-medium">
                  Enrolled Students ({students.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {students.map((st) => (
                    <Link
                      key={st.studentId}
                      href={`/learn/students/${encodeURIComponent(st.studentId)}`}
                      className="flex flex-col gap-4 p-4 text-left transition-colors hover:bg-muted/40 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">
                            {st.fullName}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            ({st.studentId})
                          </span>
                          <StatusBadge status={st.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Username: <code className="text-xs font-semibold">{st.username}</code> · Grade:{' '}
                          <span className="font-medium text-foreground">{st.grade}</span> · Phone:{' '}
                          <span>{st.mobileNumber}</span> · Language: <span>{st.preferredLanguage}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground self-start md:self-center">
                        <span className="flex items-center gap-1">
                          <Smartphone className="size-3.5" />
                          {st.activeDevicesCount} / 2 devices
                        </span>
                        <ChevronRight className="size-4" />
                      </div>
                    </Link>
                  ))}

                  {!loading && students.length === 0 && (
                    <div className="py-12 text-center text-sm text-muted-foreground">
                      No ATLAS Learn students found.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-500/10 text-emerald-700'
      : status === 'PENDING_PAYMENT'
      ? 'bg-amber-500/10 text-amber-700'
      : status === 'SUSPENDED'
      ? 'bg-rose-500/10 text-rose-700'
      : 'bg-gray-500/10 text-gray-700';

  return (
    <Badge variant="outline" className={`border-0 font-medium ${style}`}>
      {status.toLowerCase()}
    </Badge>
  );
}
