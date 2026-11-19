import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EVENT_HISTORY_URL, parseEventHistory, useEventHistory } from './useEventHistory';
import { jsonResponse, makeHistoryFixture } from '../components/vault/history/historyFixture';

function wrapper() {
  const client = new QueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useEventHistory', () => {
  it('returns the parsed v1 document on success', async () => {
    const fixture = makeHistoryFixture();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(fixture));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useEventHistory(), { wrapper: wrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.history).toBeNull();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.history).toEqual(fixture);
    expect(result.current.isUnavailable).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(EVENT_HISTORY_URL, expect.anything());
  });

  it('shares one fetch between every consumer of the query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(makeHistoryFixture()));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => [useEventHistory(), useEventHistory(), useEventHistory()], {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.every((r) => r.history !== null)).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves to null on an HTTP error (after one retry)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useEventHistory(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 4000 });
    expect(result.current.history).toBeNull();
    expect(result.current.isUnavailable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resolves to null on invalid JSON', async () => {
    const response = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON');
      },
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    const { result } = renderHook(() => useEventHistory(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.history).toBeNull();
    expect(result.current.isUnavailable).toBe(true);
  });

  it('resolves to null on a wrong schema version', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ ...makeHistoryFixture(), version: 2 })));

    const { result } = renderHook(() => useEventHistory(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.history).toBeNull();
  });
});

describe('parseEventHistory', () => {
  it('rejects malformed shapes', () => {
    const good = makeHistoryFixture();
    expect(parseEventHistory(good)).toBe(good);
    expect(parseEventHistory(null)).toBeNull();
    expect(parseEventHistory([])).toBeNull();
    expect(parseEventHistory({ ...good, bonfireBurns: undefined })).toBeNull();
    expect(parseEventHistory({ ...good, tokens: [] })).toBeNull();
    expect(parseEventHistory({ ...good, generatedAt: 5 })).toBeNull();
  });
});
