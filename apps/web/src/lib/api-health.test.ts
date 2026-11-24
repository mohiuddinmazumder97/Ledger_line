import { getApiHealth } from './api-health';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('getApiHealth', () => {
  it('returns ok when the API answers { status: "ok" }', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    await expect(getApiHealth('http://api', fetchMock)).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/api/health',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('reports HTTP errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 503));
    await expect(getApiHealth('http://api', fetchMock)).resolves.toEqual({
      status: 'unreachable',
      error: 'HTTP 503',
    });
  });

  it('reports network failures', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(getApiHealth('http://api', fetchMock)).resolves.toEqual({
      status: 'unreachable',
      error: 'fetch failed',
    });
  });
});
