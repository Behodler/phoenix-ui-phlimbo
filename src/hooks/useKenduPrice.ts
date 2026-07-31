import { useQuery } from '@tanstack/react-query';

/**
 * CoinGecko simple-price endpoint. `kendu-inu` is the CoinGecko id behind
 * https://www.coingecko.com/en/coins/kendu (the link the reward chip carries).
 * The public API sends `access-control-allow-origin: *`, so this works straight
 * from the browser with no proxy and no API key.
 */
const COINGECKO_KENDU_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=kendu-inu&vs_currencies=usd';

const COINGECKO_KENDU_ID = 'kendu-inu';

export interface UseKenduPriceResult {
  /** KENDU spot in USD, or `null` while loading / on failure. */
  price: number | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * KENDU/USD spot from CoinGecko, fetched once per page load.
 *
 * Deliberately chain-independent: there is one KENDU market and CoinGecko
 * quotes it, so the same figure is used on mainnet and on Anvil (where the
 * whitelisted token is the `mKENDU` mock and has no market of its own).
 *
 * `staleTime: Infinity` + no window-focus refetch means exactly one request per
 * page load, which keeps us comfortably inside CoinGecko's unauthenticated rate
 * limit. Failures are swallowed into `price: null`; callers must treat a null
 * price as "this leg has no USD value" rather than as zero.
 */
export function useKenduPrice(): UseKenduPriceResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['kendu-usd-price'],
    queryFn: async () => {
      const response = await fetch(COINGECKO_KENDU_URL, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(
          `CoinGecko returned ${response.status}: ${response.statusText}`
        );
      }
      const json = (await response.json()) as Record<
        string,
        { usd?: number } | undefined
      >;
      const price = json?.[COINGECKO_KENDU_ID]?.usd;
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        throw new Error('CoinGecko response did not contain a KENDU price');
      }
      return price;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  return { price: data ?? null, isLoading, isError };
}

export default useKenduPrice;
