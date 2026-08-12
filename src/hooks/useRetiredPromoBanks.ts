import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { erc20Abi, getAbiItem } from 'viem';
import { depositPageViewV3Abi, phlimboV3Abi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { log } from '../utils/logger';

export interface RetiredPromoBank {
  token: `0x${string}`;
  symbol: string;
  decimals: number;
  /** Banked amount in the token's native decimals. Always > 0 — empty banks are dropped. */
  amountRaw: bigint;
}

export interface UseRetiredPromoBanksReturn {
  banks: RetiredPromoBank[];
  isLoading: boolean;
  /** True when the log scan failed (e.g. an RPC that refuses wide ranges). */
  isUnavailable: boolean;
  refresh: () => void;
}

const PROMOTION_STARTED = getAbiItem({ abi: phlimboV3Abi, name: 'PromotionStarted' });

/**
 * Banked promo rewards for promo tokens that are no longer the active one.
 *
 * `unclaimablePromoOf` is keyed by token because the promo slot rotates: after
 * `finalizePromotion` the slot is zeroed but a user's bank for the *retired*
 * token survives and stays pullable. There is no on-chain enumeration of
 * historical promo tokens, so the candidate list is recovered from
 * `PromotionStarted` logs and handed to `getRetiredPromoBanks`.
 *
 * Two constraints this hook works within:
 * - `getRetiredPromoBanks` is not part of `IPageView`, so ViewRouter will not
 *   proxy it. It must be called on the resolved implementation directly, which
 *   is why `depositPageViewAddress` is a required argument.
 * - The scan runs from the earliest block. That is fine on Anvil; a mainnet RPC
 *   may refuse the range, in which case `isUnavailable` goes true and the
 *   surface says so rather than silently claiming there is nothing banked.
 *
 * @param depositPageViewAddress Implementation resolved from ViewRouter.
 * @param activePromoToken The currently-active promo token, excluded from the
 *        result because the page view already reports it as `unclaimablePromo`.
 */
export function useRetiredPromoBanks(
  depositPageViewAddress: `0x${string}` | undefined,
  activePromoToken: `0x${string}` | undefined,
  enabled: boolean = true,
): UseRetiredPromoBanksReturn {
  const { address: walletAddress } = useAccount();
  const { addresses } = useContractAddresses();
  const publicClient = usePublicClient();

  const [banks, setBanks] = useState<RetiredPromoBank[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [nonce, setNonce] = useState(0);

  const phlimboV3 = addresses?.PhlimboV3 as `0x${string}` | undefined;

  useEffect(() => {
    if (!enabled || !publicClient || !walletAddress || !phlimboV3 || !depositPageViewAddress) {
      setBanks([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setIsUnavailable(false);
      try {
        const logs = await publicClient.getLogs({
          address: phlimboV3,
          event: PROMOTION_STARTED,
          fromBlock: 'earliest',
          toBlock: 'latest',
        });

        const active = activePromoToken?.toLowerCase();
        const candidates = [
          ...new Set(
            logs
              .map((entry) => entry.args?.token as `0x${string}` | undefined)
              .filter((token): token is `0x${string}` => !!token)
              .filter((token) => token.toLowerCase() !== active),
          ),
        ];

        if (candidates.length === 0) {
          if (!cancelled) setBanks([]);
          return;
        }

        const amounts = (await publicClient.readContract({
          address: depositPageViewAddress,
          abi: depositPageViewV3Abi,
          functionName: 'getRetiredPromoBanks',
          args: [walletAddress, candidates],
        })) as readonly bigint[];

        const funded = candidates
          .map((token, index) => ({ token, amountRaw: amounts[index] ?? 0n }))
          .filter((entry) => entry.amountRaw > 0n);

        if (funded.length === 0) {
          if (!cancelled) setBanks([]);
          return;
        }

        const metadata = await Promise.all(
          funded.map(async ({ token }) => {
            try {
              const [symbol, decimals] = await Promise.all([
                publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'symbol' }),
                publicClient.readContract({ address: token, abi: erc20Abi, functionName: 'decimals' }),
              ]);
              return { symbol: symbol as string, decimals: Number(decimals) };
            } catch {
              // `symbol`/`decimals` are optional ERC20 extensions and the promo
              // token is an arbitrary partner token — mirror the contract's own
              // fallback rather than dropping the bank.
              return { symbol: `${token.slice(0, 6)}…${token.slice(-4)}`, decimals: 18 };
            }
          }),
        );

        if (!cancelled) {
          setBanks(funded.map((entry, index) => ({ ...entry, ...metadata[index] })));
        }
      } catch (error) {
        log.error('Retired promo bank scan failed:', error);
        if (!cancelled) {
          setBanks([]);
          setIsUnavailable(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [enabled, publicClient, walletAddress, phlimboV3, depositPageViewAddress, activePromoToken, nonce]);

  return {
    banks,
    isLoading,
    isUnavailable,
    refresh: () => setNonce((n) => n + 1),
  };
}
