import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { uniboostAbi } from '@behodler/phase2-wagmi-hooks';
import {
  computeStep1,
  computeStep2,
  uniV2PairAbi,
  uniV2RouterAbi,
} from '../lib/uniboostPoolMath';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// One MEV-safe suggestion for a Uniboost row. All fields are decimal strings
// encoded with formatUnits(_, 18) so the raw on-chain value round-trips through
// the submit path's parseUnits(_, 18) exactly, regardless of token decimals.
export interface UniboostSuggestion {
  amountIn: string;
  minPairOut: string;
  minTargetOut: string;
  minLP: string;
}

// Native ERC20 decimals for each field's token, so the UI can format the raw
// values readably AND the submit path can re-parse them back to the exact raw
// amount. primeToken can be non-18 (e.g. USDC = 6); a UniswapV2 LP token is
// always 18.
export interface UniboostFieldDecimals {
  amountIn: number; // primeToken decimals
  minPairOut: number; // pairToken decimals
  minTargetOut: number; // targetToken decimals
  minLP: number; // LP token decimals (UniV2 pair = 18)
}

export interface UseUniboostAutofillResult {
  suggestion: UniboostSuggestion | null;
  decimals: UniboostFieldDecimals;
  /**
   * Raw balance of the target UniV2 pair (LP) token held by the dispatcher —
   * the protocol-owned liquidity that accrues on each pool(). undefined until
   * loaded. Always 18 decimals (UniV2 pair). See Uniboost.pool()'s addLiquidity
   * to `address(this)`.
   */
  lpOwned: bigint | undefined;
  /** Refetch the balance/quote/reserve reads (e.g. after a fresh NFT mint). */
  refetch: () => void;
}

// UniswapV2 pair (LP) tokens are always 18 decimals.
const LP_DECIMALS = 18;

const asBig = (v: unknown): bigint | undefined => (typeof v === 'bigint' ? v : undefined);

// Reads a Uniboost dispatcher's config, prime balance, UniV2 quotes and target
// pool reserves, then derives {amountIn, minPairOut, minTargetOut, minLP} such
// that MultiPooler.pool() can execute without exposing the deposit to an MEV
// sandwich. `amountIn` defaults to the dispatcher's full prime balance — the
// donation is already carved out at dispatch time, so no set-aside is needed
// (contrast BalancerPoolerV2's batchDonationSize scaling).
export function useUniboostAutofill(
  dispatcher: `0x${string}` | undefined,
): UseUniboostAutofillResult {
  const enabled = !!dispatcher && dispatcher.toLowerCase() !== ZERO_ADDRESS;

  const primeTokenRead = useReadContract({
    address: dispatcher,
    abi: uniboostAbi,
    functionName: 'primeToken',
    query: { enabled },
  });
  const pairTokenRead = useReadContract({
    address: dispatcher,
    abi: uniboostAbi,
    functionName: 'pairToken',
    query: { enabled },
  });
  const targetTokenRead = useReadContract({
    address: dispatcher,
    abi: uniboostAbi,
    functionName: 'targetToken',
    query: { enabled },
  });
  const targetPoolRead = useReadContract({
    address: dispatcher,
    abi: uniboostAbi,
    functionName: 'targetPool',
    query: { enabled },
  });
  const routerRead = useReadContract({
    address: dispatcher,
    abi: uniboostAbi,
    functionName: 'router',
    query: { enabled },
  });
  const pathRead = useReadContract({
    address: dispatcher,
    abi: uniboostAbi,
    functionName: 'primeToPairPath',
    query: { enabled },
  });

  const primeToken = typeof primeTokenRead.data === 'string' ? (primeTokenRead.data as `0x${string}`) : undefined;
  const pairToken = typeof pairTokenRead.data === 'string' ? (pairTokenRead.data as `0x${string}`) : undefined;
  const targetToken = typeof targetTokenRead.data === 'string' ? (targetTokenRead.data as `0x${string}`) : undefined;
  const targetPool = typeof targetPoolRead.data === 'string' ? (targetPoolRead.data as `0x${string}`) : undefined;
  const router = typeof routerRead.data === 'string' ? (routerRead.data as `0x${string}`) : undefined;
  const path = Array.isArray(pathRead.data) ? (pathRead.data as readonly `0x${string}`[]) : undefined;

  // amountIn = full prime balance retained on the dispatcher.
  const primeBalRead = useReadContract({
    address: primeToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: dispatcher ? [dispatcher] : undefined,
    query: { enabled: enabled && !!primeToken },
  });
  const pairPreRead = useReadContract({
    address: pairToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: dispatcher ? [dispatcher] : undefined,
    query: { enabled: enabled && !!pairToken },
  });
  const targetPreRead = useReadContract({
    address: targetToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: dispatcher ? [dispatcher] : undefined,
    query: { enabled: enabled && !!targetToken },
  });

  // Protocol-owned LP: the target UniV2 pair token IS the LP token, and pool()
  // mints it to the dispatcher itself, so its balance here is the liquidity the
  // protocol currently owns via this dispatcher.
  const lpOwnedRead = useReadContract({
    address: targetPool,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: dispatcher ? [dispatcher] : undefined,
    query: { enabled: enabled && !!targetPool },
  });

  const primeBal = asBig(primeBalRead.data);
  const pairPre = asBig(pairPreRead.data);
  const targetPre = asBig(targetPreRead.data);
  const lpOwned = asBig(lpOwnedRead.data);

  // Native decimals of each token, used only for display/parse encoding — the
  // pool math itself works entirely in raw units.
  const primeDecimalsRead = useReadContract({
    address: primeToken,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: enabled && !!primeToken },
  });
  const pairDecimalsRead = useReadContract({
    address: pairToken,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: enabled && !!pairToken },
  });
  const targetDecimalsRead = useReadContract({
    address: targetToken,
    abi: erc20Abi,
    functionName: 'decimals',
    query: { enabled: enabled && !!targetToken },
  });
  const primeDecimals = typeof primeDecimalsRead.data === 'number' ? primeDecimalsRead.data : undefined;
  const pairDecimals = typeof pairDecimalsRead.data === 'number' ? pairDecimalsRead.data : undefined;
  const targetDecimals = typeof targetDecimalsRead.data === 'number' ? targetDecimalsRead.data : undefined;

  const decimals = useMemo<UniboostFieldDecimals>(
    () => ({
      amountIn: primeDecimals ?? 18,
      minPairOut: pairDecimals ?? 18,
      minTargetOut: targetDecimals ?? 18,
      minLP: LP_DECIMALS,
    }),
    [primeDecimals, pairDecimals, targetDecimals],
  );

  // Step 1 quote: prime -> pair along primeToPairPath.
  const step1QuoteEnabled = enabled && !!router && !!path && path.length >= 2 && typeof primeBal === 'bigint' && primeBal > 0n;
  const step1Quote = useReadContract({
    address: router,
    abi: uniV2RouterAbi,
    functionName: 'getAmountsOut',
    args: primeBal !== undefined && path ? [primeBal, path as `0x${string}`[]] : undefined,
    query: { enabled: step1QuoteEnabled },
  });
  const pairOutExp = useMemo<bigint | undefined>(() => {
    const amounts = step1Quote.data as readonly bigint[] | undefined;
    if (!amounts || amounts.length === 0) return undefined;
    return amounts[amounts.length - 1];
  }, [step1Quote.data]);

  const step1 = useMemo(() => {
    if (typeof pairPre !== 'bigint' || pairOutExp === undefined) return null;
    return computeStep1({ pairPre, pairOutExp });
  }, [pairPre, pairOutExp]);

  // Step 2 quote: pair -> target, sized off the worst-case `half`.
  const step2Path = pairToken && targetToken ? ([pairToken, targetToken] as `0x${string}`[]) : undefined;
  const step2QuoteEnabled = enabled && !!router && !!step2Path && !!step1 && step1.halfWorst > 0n;
  const step2Quote = useReadContract({
    address: router,
    abi: uniV2RouterAbi,
    functionName: 'getAmountsOut',
    args: step1 && step2Path ? [step1.halfWorst, step2Path] : undefined,
    query: { enabled: step2QuoteEnabled },
  });
  const targetOutExp = useMemo<bigint | undefined>(() => {
    const amounts = step2Quote.data as readonly bigint[] | undefined;
    if (!amounts || amounts.length === 0) return undefined;
    return amounts[amounts.length - 1];
  }, [step2Quote.data]);

  // Target pool reserves + totalSupply for the LP estimate.
  const reservesRead = useReadContract({
    address: targetPool,
    abi: uniV2PairAbi,
    functionName: 'getReserves',
    query: { enabled: enabled && !!targetPool },
  });
  const token0Read = useReadContract({
    address: targetPool,
    abi: uniV2PairAbi,
    functionName: 'token0',
    query: { enabled: enabled && !!targetPool },
  });
  const totalSupplyRead = useReadContract({
    address: targetPool,
    abi: uniV2PairAbi,
    functionName: 'totalSupply',
    query: { enabled: enabled && !!targetPool },
  });

  // Orient the reserves onto (pair, target) using token0.
  const oriented = useMemo<{ rPair: bigint; rTarget: bigint } | null>(() => {
    const reserves = reservesRead.data as readonly [bigint, bigint, number] | undefined;
    const token0 = typeof token0Read.data === 'string' ? token0Read.data.toLowerCase() : undefined;
    if (!reserves || !token0 || !pairToken || !targetToken) return null;
    const r0 = reserves[0];
    const r1 = reserves[1];
    if (token0 === pairToken.toLowerCase()) return { rPair: r0, rTarget: r1 };
    if (token0 === targetToken.toLowerCase()) return { rPair: r1, rTarget: r0 };
    return null;
  }, [reservesRead.data, token0Read.data, pairToken, targetToken]);

  const step2 = useMemo(() => {
    if (!step1 || oriented === null) return null;
    if (typeof pairPre !== 'bigint' || typeof targetPre !== 'bigint') return null;
    if (targetOutExp === undefined) return null;
    const totalSupply = asBig(totalSupplyRead.data);
    if (totalSupply === undefined) return null;
    return computeStep2({
      pairPre,
      targetPre,
      minPairOut: step1.minPairOut,
      halfWorst: step1.halfWorst,
      targetOutExp,
      rPair: oriented.rPair,
      rTarget: oriented.rTarget,
      totalSupply,
    });
  }, [step1, oriented, pairPre, targetPre, targetOutExp, totalSupplyRead.data]);

  const suggestion = useMemo<UniboostSuggestion | null>(() => {
    if (typeof primeBal !== 'bigint' || primeBal <= 0n) return null;
    if (!step1 || !step2) return null;
    // Wait for real decimals — formatting a 6-decimal token (e.g. USDC prime) at
    // 18 would show an unreadable 1e-12-scale number and mismatch the submit parse.
    if (primeDecimals === undefined || pairDecimals === undefined || targetDecimals === undefined) {
      return null;
    }
    return {
      amountIn: formatUnits(primeBal, primeDecimals),
      minPairOut: formatUnits(step1.minPairOut, pairDecimals),
      minTargetOut: formatUnits(step2.minTargetOut, targetDecimals),
      minLP: formatUnits(step2.minLP, LP_DECIMALS),
    };
  }, [primeBal, step1, step2, primeDecimals, pairDecimals, targetDecimals]);

  const refetch = () => {
    primeBalRead.refetch();
    pairPreRead.refetch();
    targetPreRead.refetch();
    lpOwnedRead.refetch();
    step1Quote.refetch();
    step2Quote.refetch();
    reservesRead.refetch();
    totalSupplyRead.refetch();
  };

  return { suggestion, decimals, lpOwned, refetch };
}
