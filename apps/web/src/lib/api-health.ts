export type ApiHealth = { status: 'ok' } | { status: 'unreachable'; error: string };

/**
 * Server-side only: calls Nest directly via API_URL. (Browser code goes through the /api rewrite.)
 * Phase 0 scaffolding — replaced by the generated api-client from phase 4.
 */
export async function getApiHealth(
  apiUrl: string = process.env.API_URL ?? 'http://localhost:4000',
  fetchImpl: typeof fetch = fetch,
): Promise<ApiHealth> {
  try {
    const res = await fetchImpl(`${apiUrl}/api/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { status: 'unreachable', error: `HTTP ${res.status}` };
    const body = (await res.json()) as { status?: unknown };
    return body.status === 'ok' ? { status: 'ok' } : { status: 'unreachable', error: 'Unexpected response' };
  } catch (err) {
    return { status: 'unreachable', error: err instanceof Error ? err.message : String(err) };
  }
}
