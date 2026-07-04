// MEV-safe slippage floors for Uniboost.pool(amountIn, minPairOut, minTargetOut, minLP).
//
// Unlike BalancerPoolerV2 (which exposes getIdealBPT() as an on-chain quote), the
// Uniboost dispatcher has NO quote/preview function, so the three floors must be
// reconstructed off-chain from raw UniswapV2 primitives. The on-chain flow
// (src/dispatchers/Uniboost.sol pool()) is a three-step zap:
//
//   1. swapExactTokensForTokens(amountIn, minPairOut, primeToPairPath)  prime -> pair
//   2. half = pairToken.balanceOf(this) / 2;                             (naive 50/50)
//      swapExactTokensForTokens(half, minTargetOut, [pair, target])      pair  -> target
//   3. addLiquidity(target, pair, targetBal, pairRemaining, 0, 0)        LP mint
//      require(liquidity >= minLP)
//
// addLiquidity's own amountAMin/amountBMin are hardcoded 0, so minLP is the ONLY
// guard on the LP step. The floors are computed against the WORST-CASE output of
// each prior leg so that if leg 1 lands exactly on its floor, leg 2 (whose runtime
// `half` shrinks accordingly) and the LP mint still clear — otherwise a floor
// computed off the *expected* half would revert whenever leg 1 underperforms.
//
// All quantities here are raw token units (bigint). The UI formats each field
// with its token's NATIVE decimals (primeToken can be non-18, e.g. USDC = 6; a
// UniV2 LP token is always 18) and re-parses with the same decimals at submit,
// so the raw value round-trips exactly. See useUniboostAutofill's decimals.

// Default slippage tolerance: 1% below expected, matching BalancerPoolerV2's
// minBPT auto-fill (Admin.tsx `expected * 99n / 100n`).
export const TOL_NUM = 99n;
export const TOL_DEN = 100n;

const applyTol = (x: bigint, num = TOL_NUM, den = TOL_DEN): bigint => (x * num) / den;

// Minimal UniswapV2 router ABI — only getAmountsOut, which mirrors the
// swapExactTokensForTokens quotes used in Uniboost.pool()'s two swaps. (The
// router ABI is not shipped in @behodler/phase2-wagmi-hooks.)
export const uniV2RouterAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getAmountsOut',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path', type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

// Minimal UniswapV2 pair ABI — reserves + token0 (to orient them) + totalSupply,
// needed to estimate the LP minted by step 3's addLiquidity.
export const uniV2PairAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'getReserves',
    inputs: [],
    outputs: [
      { name: 'reserve0', type: 'uint112' },
      { name: 'reserve1', type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'token0',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'totalSupply',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// Phase 1: from the prime->pair quote, derive minPairOut and the worst-case
// `half` that step 2 will swap (used to size the step-2 quote). Returns null if
// there is no prime to pool or the quote is non-positive.
export interface Step1Inputs {
  pairPre: bigint; // pairToken.balanceOf(dispatcher) before pooling (pre-existing dust)
  pairOutExp: bigint; // getAmountsOut(amountIn, primeToPairPath) last element
}

export interface Step1Result {
  minPairOut: bigint;
  halfWorst: bigint; // (pairPre + minPairOut) / 2 — the worst-case step-2 swap amount
}

export function computeStep1({ pairPre, pairOutExp }: Step1Inputs): Step1Result | null {
  if (pairOutExp <= 0n) return null;
  const minPairOut = applyTol(pairOutExp);
  if (minPairOut <= 0n) return null;
  const pairBalWorst = pairPre + minPairOut;
  const halfWorst = pairBalWorst / 2n;
  return { minPairOut, halfWorst };
}

// Phase 2: from the pair->target quote (sized off halfWorst) plus the target
// pool's post-swap reserves, derive minTargetOut and minLP. Returns null when the
// LP mint cannot be estimated (empty pool, or the swap would drain the target
// reserve in this estimate).
export interface Step2Inputs {
  pairPre: bigint;
  targetPre: bigint; // targetToken.balanceOf(dispatcher) before pooling (pre-existing dust)
  minPairOut: bigint;
  halfWorst: bigint;
  targetOutExp: bigint; // getAmountsOut(halfWorst, [pair, target]) last element
  rPair: bigint; // reserve of the pairing token in the target pool (current)
  rTarget: bigint; // reserve of the target token in the target pool (current)
  totalSupply: bigint; // target pool LP total supply
}

export interface Step2Result {
  minTargetOut: bigint;
  minLP: bigint;
}

export function computeStep2({
  pairPre,
  targetPre,
  minPairOut,
  halfWorst,
  targetOutExp,
  rPair,
  rTarget,
  totalSupply,
}: Step2Inputs): Step2Result | null {
  if (targetOutExp <= 0n) return null;
  if (totalSupply <= 0n) return null;

  const minTargetOut = applyTol(targetOutExp);
  if (minTargetOut <= 0n) return null;

  // Worst-case amounts deposited into addLiquidity, consistent with the floors:
  // step 1 yields at least minPairOut, of which halfWorst is swapped, leaving the
  // rest; step 2 yields at least minTargetOut of target token.
  const pairBalWorst = pairPre + minPairOut;
  const pairRemainingWorst = pairBalWorst - halfWorst;
  const targetBalWorst = targetPre + minTargetOut;

  // Reserves after step 2's swap: pair goes in, target comes out.
  const rPairAfter = rPair + halfWorst;
  const rTargetAfter = rTarget - targetOutExp;
  if (rTargetAfter <= 0n || rPairAfter <= 0n) return null;

  // UniswapV2 mints liquidity = min(amountA * ts / reserveA, amountB * ts / reserveB)
  // on the post-swap reserves. The limiting side (target, since the 50/50 split is
  // naive) sets the LP received.
  const lpFromTarget = (targetBalWorst * totalSupply) / rTargetAfter;
  const lpFromPair = (pairRemainingWorst * totalSupply) / rPairAfter;
  const expectedLP = lpFromTarget < lpFromPair ? lpFromTarget : lpFromPair;
  if (expectedLP <= 0n) return null;

  const minLP = applyTol(expectedLP);
  if (minLP <= 0n) return null;

  return { minTargetOut, minLP };
}
