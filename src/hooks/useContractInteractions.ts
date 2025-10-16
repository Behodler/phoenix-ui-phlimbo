import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { autoDolaVaultAbi, behodler3TokenlaunchAbi } from '../generated/wagmi'
import { erc20Abi, maxUint256 } from 'viem'
import type { Address, Hash } from 'viem'

// For now, using placeholder addresses - these should be loaded from deployment server
// or configured via environment variables
const CONTRACTS = {
  autoDolaVault: '0x0000000000000000000000000000000000000000' as Address,
  behodler3Tokenlaunch: '0x0000000000000000000000000000000000000000' as Address,
  vault: '0x0000000000000000000000000000000000000000' as Address,
}

/**
 * Hook for interacting with AutoDolaVault contract
 */
export function useAutoDolaVault() {
  const { data: hash, writeContract, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  })

  const deposit = async (amount: bigint, recipient: Address) => {
    return writeContract({
      address: CONTRACTS.autoDolaVault,
      abi: autoDolaVaultAbi,
      functionName: 'deposit',
      args: [CONTRACTS.vault, amount, recipient],
    })
  }

  const withdraw = async (token: Address, client: Address, amount: bigint, recipient: Address) => {
    return writeContract({
      address: CONTRACTS.autoDolaVault,
      abi: autoDolaVaultAbi,
      functionName: 'withdrawFrom',
      args: [token, client, amount, recipient],
    })
  }

  return {
    deposit,
    withdraw,
    isPending,
    isConfirming,
    isSuccess,
    hash,
  }
}

/**
 * Hook for reading wallet's ERC20 token balance
 * This is a generic hook for reading any ERC20 token balance from a wallet address
 */
export function useTokenBalance(address: Address | undefined, token: Address | undefined) {
  const { data, isError, isLoading } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  })

  return {
    balance: data as bigint | undefined,
    isError,
    isLoading,
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
 * Hook for interacting with Behodler3Tokenlaunch (bonding curve)
 */
export function useBondingCurve(bondingCurveAddress: Address | undefined) {
  // Fetch current marginal price
  const { data: currentPrice, isLoading: isLoadingCurrent, isError: isErrorCurrent } = useReadContract({
    address: bondingCurveAddress,
    abi: behodler3TokenlaunchAbi,
    functionName: 'getCurrentMarginalPrice',
    query: {
      enabled: !!bondingCurveAddress,
    },
  })

  // Fetch initial marginal price (start price)
  const { data: initialPrice, isLoading: isLoadingInitial, isError: isErrorInitial } = useReadContract({
    address: bondingCurveAddress,
    abi: behodler3TokenlaunchAbi,
    functionName: 'getInitialMarginalPrice',
    query: {
      enabled: !!bondingCurveAddress,
    },
  })

  // Fetch final marginal price (end price)
  const { data: finalPrice, isLoading: isLoadingFinal, isError: isErrorFinal } = useReadContract({
    address: bondingCurveAddress,
    abi: behodler3TokenlaunchAbi,
    functionName: 'getFinalMarginalPrice',
    query: {
      enabled: !!bondingCurveAddress,
    },
  })

  const { data: totalRaised } = useReadContract({
    address: bondingCurveAddress,
    abi: behodler3TokenlaunchAbi,
    functionName: 'getTotalRaised',
    query: {
      enabled: !!bondingCurveAddress,
    },
  })

  // Aggregate loading and error states
  const isLoading = isLoadingCurrent || isLoadingInitial || isLoadingFinal
  const isError = isErrorCurrent || isErrorInitial || isErrorFinal

  return {
    currentPrice: currentPrice as bigint | undefined,
    initialPrice: initialPrice as bigint | undefined,
    finalPrice: finalPrice as bigint | undefined,
    totalRaised: totalRaised as bigint | undefined,
    isLoading,
    isError,
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

/**
 * Hook for adding liquidity to the bonding curve
 * Calls the addLiquidity function on the Behodler3Tokenlaunch contract
 *
 * @param bondingCurveAddress - Address of the bonding curve contract
 * @returns Object containing addLiquidity function and transaction state
 */
export function useAddLiquidity(bondingCurveAddress: Address | undefined) {
  const { data: hash, writeContractAsync, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
    query: {
      enabled: !!hash,
    },
  })

  /**
   * Add liquidity to the bonding curve
   *
   * @param inputAmount - Amount of DOLA to deposit (in wei, scaled by 1e18)
   * @param minBondingTokens - Minimum bonding tokens to receive (in wei, scaled by 1e18)
   * @returns Promise that resolves to the transaction hash
   */
  const addLiquidity = async (
    inputAmount: bigint,
    minBondingTokens: bigint
  ): Promise<Hash> => {
    if (!bondingCurveAddress) {
      throw new Error('Bonding curve address not available')
    }

    const hash = await writeContractAsync({
      address: bondingCurveAddress,
      abi: behodler3TokenlaunchAbi,
      functionName: 'addLiquidity',
      args: [inputAmount, minBondingTokens],
    })
    return hash
  }

  return {
    addLiquidity,
    isPending,
    isConfirming,
    isSuccess,
    hash,
    receipt,
  }
}
