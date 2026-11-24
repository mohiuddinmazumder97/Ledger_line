import { getApiHealth } from '@/lib/api-health';

// Always render at request time so the status reflects the live API.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const health = await getApiHealth();
  return (
    <main className="mx-auto max-w-xl p-10 font-sans">
      <h1 className="text-2xl font-semibold">Ledgerline</h1>
      <p className="mt-4">
        API status: <strong data-testid="api-status">{health.status}</strong>
      </p>
      {health.status !== 'ok' && <p className="mt-2 text-sm opacity-70">{health.error}</p>}
    </main>
  );
}
