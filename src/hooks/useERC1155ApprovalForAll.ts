import { useReadContract, useWriteContract } from 'wagmi';
import type { Address, Hash } from 'viem';

/**
 * Minimal ABI fragment for ERC1155 setApprovalForAll / isApprovedForAll.
 * viem's erc20Abi has no ERC1155 counterpart in this version, so we
 * hand-roll the two functions used here.
 */
const erc1155ApprovalAbi = [
  {
    type: 'function',
    name: 'isApprovedForAll',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'operator', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'setApprovalForAll',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'operator', type: 'address' },
      { name: 'approved', type: 'bool' },
    ],
    outputs: [],
  },
] as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface UseERC1155ApprovalForAllResult {
  /** True iff `owner` has approved `operator` for all token ids on `token`. */
  isApprovedForAll: boolean;
  /** Submit a setApprovalForAll(operator, true) tx. Returns the tx hash. */
  approveAll: () => Promise<Hash>;
  /** True between submitting the approval tx and resolving its hash. */
  isApproving: boolean;
  /** Refetch the on-chain approval flag. */
  refetch: () => void;
}

/**
 * Read + write hook for ERC1155 `setApprovalForAll`.
 *
 * Used by the staking surface to authorise the NFTStaker contract to
 * pull ERC1155 units from the user via `safeTransferFrom`. ERC1155
 * has no per-id allowance — it's all-or-nothing per (owner, operator).
 *
 * Disabled (returns `false` and a no-op `approveAll`) when any address
 * is zero / undefined, so callers can safely render before contract
 * addresses resolve or on networks where the operator isn't deployed.
 */
export function useERC1155ApprovalForAll(
  owner: Address | undefined,
  operator: Address | undefined,
  token: Address | undefined,
): UseERC1155ApprovalForAllResult {
  const enabled =
    !!owner &&
    !!operator &&
    !!token &&
    operator !== ZERO_ADDRESS &&
    token !== ZERO_ADDRESS;

  const { data, refetch } = useReadContract({
    address: token,
    abi: erc1155ApprovalAbi,
    functionName: 'isApprovedForAll',
    args: owner && operator ? [owner, operator] : undefined,
    query: {
      enabled,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  });

  const { writeContractAsync, isPending: isApproving } = useWriteContract();

  const approveAll = async (): Promise<Hash> => {
    if (!enabled || !token || !operator) {
      throw new Error('ERC1155 approval not available — missing token/operator/owner');
    }
    const hash = await writeContractAsync({
      address: token,
      abi: erc1155ApprovalAbi,
      functionName: 'setApprovalForAll',
      args: [operator, true],
    });
    return hash;
  };

  return {
    isApprovedForAll: !!data,
    approveAll,
    isApproving,
    refetch,
  };
}
