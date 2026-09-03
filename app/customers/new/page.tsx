'use client';
import { ArrowLeft, CheckCircle2, LoaderCircle } from 'lucide-react';
import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  backofficeApi,
  type ProfessionalOnboardingResponse,
  AtlasApiError,
} from '@/lib/atlas-api';

function RegisterForm({
  onCreated,
}: {
  onCreated: (r: ProfessionalOnboardingResponse) => void;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [issuer, setIssuer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pendingKey, setPendingKey] = useState<string | undefined>(undefined);
  // oxlint-disable-next-line typescript/no-deprecated
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const key = pendingKey ?? crypto.randomUUID();
    if (!pendingKey) setPendingKey(key);
    try {
      const customer = await backofficeApi.createCustomer(
        { email, displayName, issuer },
        key,
      );
      onCreated(customer);
    } catch (cause) {
      if (cause instanceof AtlasApiError && cause.status === 409) {
        setError('A customer with this email already exists.');
      } else {
        setError(
          cause instanceof Error ? cause.message : 'Registration failed.',
        );
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer and identity</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="displayName">Customer display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (pendingKey) setPendingKey(undefined);
              }}
              placeholder="Northstar Legal"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Owner email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (pendingKey) setPendingKey(undefined);
              }}
              placeholder="maya@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="issuer">OIDC issuer</Label>
            <Input
              id="issuer"
              value={issuer}
              onChange={(e) => {
                setIssuer(e.target.value);
                if (pendingKey) setPendingKey(undefined);
              }}
              placeholder="http://localhost:8081/realms/forge-atlas"
              required
            />
          </div>
          <div className="md:col-span-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            The owner must already exist in the configured identity provider.
            Payment collection is intentionally outside this local-first phase.
          </div>
          <div className="md:col-span-2">
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => history.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <LoaderCircle className="animate-spin" />}
                Register and provision
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
function SuccessCard({
  response,
  onReset,
}: {
  response: ProfessionalOnboardingResponse;
  onReset: () => void;
}) {
  return (
    <Card className="border-emerald-500/30">
      <CardContent className="flex gap-3 pt-6">
        <CheckCircle2 className="text-emerald-600" />
        <div>
          <h2 className="font-semibold">Customer registered</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer {response.customerId} is active and provisioning has been
            queued.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Subscription: {response.subscriptionId}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Status: {response.customerStatus}
          </p>
          <Button className="mt-5" variant="outline" onClick={onReset}>
            Register another customer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
export default function RegisterCustomer() {
  const [response, setResponse] =
    useState<ProfessionalOnboardingResponse | null>(null);
  function handleReset() {
    setResponse(null);
  }
  return (
    <main className="min-h-screen bg-background p-5 md:p-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to overview
        </Link>
        <div className="mb-7 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <CheckCircle2 />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">
              Register professional customer
            </h1>
            <p className="text-sm text-muted-foreground">
              Create the customer workspace, owner membership, and provisioning
              job.
            </p>
          </div>
        </div>
        {response ? (
          <SuccessCard response={response} onReset={handleReset} />
        ) : (
          <RegisterForm onCreated={setResponse} />
        )}
      </div>
    </main>
  );
}
