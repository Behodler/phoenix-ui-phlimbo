import { useReadContract, useAccount } from 'wagmi';
import { BALANCER_POOL_ADDRESS } from './useBalancerPrice';

// Balancer V3 Router on Ethereum mainnet
const BALANCER_ROUTER_ADDRESS = '0xae563e3f8219521950555f5962419c8919758ea2' as const;

// Minimal ABI for Balancer V3 Router queryAddLiquidityUnbalanced.
// Marked as 'view' so wagmi uses eth_call; the on-chain function uses transient
// state simulation but works correctly via static call.
const routerQueryAbi = [
  {
    name: 'queryAddLiquidityUnbalanced',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'pool', type: 'address' },
      { name: 'exactAmountsIn', type: 'uint256[]' },
      { name: 'sender', type: 'address' },
      { name: 'userData', type: 'bytes' },
    ],
    outputs: [{ name: 'bptAmountOut', type: 'uint256' }],
  },
] as const;

/**
 * Estimates BPT output for a single-sided sUSDS add to the Balancer 50/50 balanced pool
 * by querying the Balancer V3 Router's queryAddLiquidityUnbalanced.
 *
 * This gives an accurate estimate that accounts for the balanced pool and
 * unbalanced join pricing, unlike a proportional formula which assumes
 * a balanced join.
 */
export function useEstimateBPT(
  sUsdsAmount: bigint,
  enabled: boolean,
): { minBPT: bigint | undefined; estimatedBPT: bigint | undefined; isLoading: boolean; isError: boolean } {
  const { address: walletAddress } = useAccount();

  // Use connected wallet as sender (can influence results via hooks), fallback to zero address
  const sender = walletAddress ?? '0x0000000000000000000000000000000000000000';

  // Pool token order: [sUSDS, phUSD] — single-sided sUSDS means [amount, 0]
  const {
    data: bptAmountOut,
    isLoading,
    isError,
  } = useReadContract({
    address: BALANCER_ROUTER_ADDRESS,
    abi: routerQueryAbi,
    functionName: 'queryAddLiquidityUnbalanced',
    args: [BALANCER_POOL_ADDRESS, [sUsdsAmount, 0n], sender, '0x'],
    query: { enabled: enabled && sUsdsAmount > 0n, refetchInterval: 30000 },
  });

  let estimatedBPT: bigint | undefined;
  let minBPT: bigint | undefined;

  if (bptAmountOut !== undefined && sUsdsAmount > 0n) {
    estimatedBPT = bptAmountOut;
    // 5% slippage tolerance (500 bps)
    minBPT = (estimatedBPT * 9500n) / 10000n;
  }

  return { minBPT, estimatedBPT, isLoading, isError };
}
