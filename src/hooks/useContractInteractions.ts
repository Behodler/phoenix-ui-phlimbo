import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { autoDolaVaultAbi, behodler3TokenlaunchAbi } from '../generated/wagmi'
import type { Address } from 'viem'

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
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

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
 * Hook for reading balance from AutoDolaVault
 */
export function useVaultBalance(address: Address | undefined, token: Address | undefined) {
  const { data, isError, isLoading } = useReadContract({
    address: CONTRACTS.autoDolaVault,
    abi: autoDolaVaultAbi,
    functionName: 'balanceOf',
    args: address && token ? [token, address] : undefined,
  })

  return {
    balance: data as bigint | undefined,
    isError,
    isLoading,
  }
}

/**
 * Hook for interacting with Behodler3Tokenlaunch (bonding curve)
 */
export function useBondingCurve() {
  const { data: currentPrice } = useReadContract({
    address: CONTRACTS.behodler3Tokenlaunch,
    abi: behodler3TokenlaunchAbi,
    functionName: 'getCurrentMarginalPrice',
  })

  const { data: totalRaised } = useReadContract({
    address: CONTRACTS.behodler3Tokenlaunch,
    abi: behodler3TokenlaunchAbi,
    functionName: 'getTotalRaised',
  })

  return {
    currentPrice: currentPrice as bigint | undefined,
    totalRaised: totalRaised as bigint | undefined,
  }
}
