import { useReadContract, useWriteContract } from 'wagmi'
import { erc20Abi, maxUint256 } from 'viem'
import type { Address, Hash } from 'viem'

/**
 * Hook for reading wallet's ERC20 token balance
 * This is a generic hook for reading any ERC20 token balance from a wallet address
 */
export function useTokenBalance(address: Address | undefined, token: Address | undefined) {
  const { data, isError, isLoading, refetch } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  return {
    balance: data as bigint | undefined,
    isError,
    isLoading,
    refetch, // Expose refetch to allow manual balance updates after transactions
  }
}

/**
 * Hook for reading ERC20 token allowance
 * Returns the amount of tokens that an owner has approved for a spender to use
 */
export function useTokenAllowance(
  owner: Address | undefined,
  spender: Address | undefined,
  token: Address | undefined
) {
  const { data, isError, isLoading, refetch } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
  })

  return {
    allowance: data as bigint | undefined,
    isError,
    isLoading,
    refetch,
  }
}

/**
 * Hook for ERC20 token approval transactions
 * Provides a function to approve a spender to use tokens on behalf of the owner
 *
 * @returns Object containing the approval function and transaction state
 */
export function useTokenApproval() {
  const { writeContractAsync } = useWriteContract()

  /**
   * Approve a spender to use tokens
   *
   * @param tokenAddress - Address of the ERC20 token to approve
   * @param spenderAddress - Address of the contract/account to approve
   * @param amount - Amount to approve (defaults to maxUint256 for unlimited approval)
   * @returns Promise that resolves to the transaction hash
   */
  const approve = async (
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint = maxUint256
  ): Promise<Hash> => {
    const hash = await writeContractAsync({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [spenderAddress, amount],
    })
    return hash
  }

  return {
    approve,
  }
}
