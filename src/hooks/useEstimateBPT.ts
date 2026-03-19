import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { BALANCER_POOL_ADDRESS, BALANCER_VAULT_ADDRESS } from './useBalancerPrice';

const vaultAbi = [
  {
    name: 'getCurrentLiveBalances',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'pool', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
] as const;

/**
 * Estimates minimum BPT output for a single-sided sUSDS add to the Balancer pool.
 *
 * Uses proportional formula as upper bound: amount * totalSupply / sUsdsBalance,
 * then applies slippage tolerance. The proportional formula overestimates for
 * single-sided adds, so the slippage accounts for both approximation error and
 * on-chain price movement.
 */
export function useEstimateBPT(
  sUsdsAmount: bigint,
  slippageBps: number,
  enabled: boolean,
): { minBPT: bigint | undefined; estimatedBPT: bigint | undefined; isLoading: boolean; isError: boolean } {
  const {
    data: totalSupply,
    isLoading: isLoadingSupply,
    isError: isErrorSupply,
  } = useReadContract({
    address: BALANCER_POOL_ADDRESS,
    abi: erc20Abi,
    functionName: 'totalSupply',
    query: { enabled, refetchInterval: 30000 },
  });

  const {
    data: liveBalances,
    isLoading: isLoadingBalances,
    isError: isErrorBalances,
  } = useReadContract({
    address: BALANCER_VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: 'getCurrentLiveBalances',
    args: [BALANCER_POOL_ADDRESS],
    query: { enabled, refetchInterval: 30000 },
  });

  const isLoading = isLoadingSupply || isLoadingBalances;
  const isError = isErrorSupply || isErrorBalances;

  let estimatedBPT: bigint | undefined;
  let minBPT: bigint | undefined;

  if (totalSupply !== undefined && liveBalances !== undefined && sUsdsAmount > 0n) {
    const sUsdsBalance = liveBalances[0]; // sUSDS is token index 0
    if (sUsdsBalance > 0n) {
      // Proportional upper bound for BPT output
      estimatedBPT = (sUsdsAmount * totalSupply) / sUsdsBalance;
      // Apply slippage: minBPT = estimatedBPT * (10000 - slippageBps) / 10000
      minBPT = (estimatedBPT * BigInt(10000 - slippageBps)) / 10000n;
    }
  }

  return { minBPT, estimatedBPT, isLoading, isError };
}
