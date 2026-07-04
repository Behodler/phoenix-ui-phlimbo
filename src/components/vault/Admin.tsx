import { useState, useEffect, useMemo } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from 'wagmi';
import { readContract } from '@wagmi/core';
import { wagmiConfig } from '../../wagmiConfig';
import { erc20Abi, formatUnits, parseUnits, zeroAddress } from 'viem';
import {
  phlimboV2Abi,
  phusdStableMinterAbi,
  erc4626YieldStrategyAbi,
  stableYieldAccumulatorAbi,
  balancerPoolerV2Abi,
  stableStakerAbi,
  multiPoolerAbi,
  nudgeRatchetDelayReleaseAbi,
} from '@behodler/phase2-wagmi-hooks';
import { pauserAbi } from '../../lib/pauserAbi';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useToast } from '../ui/ToastProvider';
import ActionButton from '../ui/ActionButton';
import NftStakerRunwayPanel from './NftStakerRunwayPanel';
import { useTokenBalance } from '../../hooks/useContractInteractions';
import { useSolvencyInfo } from '../../hooks/useSolvencyInfo';
import { useUniboostAutofill } from '../../hooks/useUniboostAutofill';
import type { Abi, AbiFunction } from 'viem';
import type { ContractAddresses } from '../../types/contracts';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// The three Uniboost dispatchers fed by the MultiPooler. Each table row maps a
// short label to its address key in ContractAddresses; the MultiPooler.pool()
// call takes one PoolCall struct per non-blank row.
const UNIBOOST_ROWS = [
  { label: 'EYE', addressKey: 'UniboostEYE' },
  { label: 'SCX', addressKey: 'UniboostSCX' },
  { label: 'FLX', addressKey: 'UniboostFLX' },
] as const;

type UniboostLabel = (typeof UNIBOOST_ROWS)[number]['label'];

// Editable fields of one MultiPooler.PoolCall row (raw decimal strings; the
// `uniboost` address is resolved from ContractAddresses at submit time).
interface PoolRowInput {
  amountIn: string;
  minPairOut: string;
  minTargetOut: string;
  minLP: string;
}

const emptyPoolRow = (): PoolRowInput => ({
  amountIn: '',
  minPairOut: '',
  minTargetOut: '',
  minLP: '',
});

const emptyPoolRows = (): Record<UniboostLabel, PoolRowInput> => ({
  EYE: emptyPoolRow(),
  SCX: emptyPoolRow(),
  FLX: emptyPoolRow(),
});

// PhusdStableMinter V1 (retired). DOLA/USDC migrated their positions to the V2
// minter (now in addresses.PhusdStableMinter), but USDe retained its position in
// V1. Minting going forward only uses V2; V1 is hardcoded here because it is no
// longer referenced anywhere else once the contract address change is committed.
const PHUSD_STABLE_MINTER_V1 = '0x435B0A1884bd0fb5667677C9eb0e59425b1477E5' as const;

// ABI for ERC20 tokens with mint function (used on testnets)
const mintableErc20Abi = [
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

/**
 * Contract configuration type
 */
interface ContractConfig {
  name: string;
  addressKey: keyof ContractAddresses;
  abi: Abi;
}

/**
 * Contract configurations for admin panel - Phase 2 contracts
 */
const getContractConfigs = (): ContractConfig[] => [
  {
    name: 'PhUSD',
    addressKey: 'PhUSD',
    abi: mintableErc20Abi as Abi,
  },
  {
    name: 'Pauser',
    addressKey: 'Pauser',
    abi: pauserAbi as Abi,
  },
  {
    name: 'YieldStrategyDola',
    addressKey: 'YieldStrategyDola',
    abi: erc4626YieldStrategyAbi as Abi,
  },

  {
    name: 'PhusdStableMinter',
    addressKey: 'PhusdStableMinter',
    abi: phusdStableMinterAbi as Abi,
  },
  {
    name: 'PhlimboEA',
    addressKey: 'PhlimboEA',
    abi: phlimboV2Abi as Abi,
  },
];

/**
 * Expands exponential notation into a plain integer string
 * e.g. "1e20" -> "100000000000000000000"
 * Rejects any negative exponents or decimals
 */
function expandExpInt(input: string): string {
  const s = String(input).trim();
  const m = /^([+-]?)(\d+)(?:[eE]([+-]?\d+))?$/.exec(s);
  if (!m) throw new Error("Invalid integer format");

  const sign = m[1] === "-" ? "-" : "";
  const base = m[2];
  const exp = m[3] !== undefined ? parseInt(m[3], 10) : 0;

  if (exp < 0) throw new Error("Negative exponents not allowed (Ethereum uses integers only)");

  // Append exp number of zeros
  const result = base + "0".repeat(exp);

  // Strip leading zeros except one
  return sign + result.replace(/^(-?)0+(?=\d)/, "$1");
}

/**
 * Check if a Solidity type is numeric (uint/int variants)
 */
function isNumericType(solidityType: string): boolean {
  // Match uint/int with any bit size or no bit size specified
  return /^(u?int\d*)$/.test(solidityType);
}

/**
 * Check if a Solidity type is boolean
 */
function isBooleanType(solidityType: string): boolean {
  return solidityType === 'bool';
}

/**
 * Convert string value to boolean
 * Only "true" (case-insensitive) returns true, everything else returns false
 */
function convertBooleanParameter(value: string): boolean {
  const result = !!value && `${value}`.toLowerCase() === 'true';
  console.log('[Boolean Debug] Converting:', { input: value, output: result });
  return result;
}

/**
 * Extract all functions from ABI
 * Note: ABIs only contain external/public functions by definition
 */
const extractFunctionsFromAbi = (abi: Abi): string[] => {
  const functions = abi.filter(
    (item): item is AbiFunction => item.type === 'function'
  );

  return functions.map((func) => func.name);
};

/**
 * Reads StableStaker admin stats for one stake-token pool:
 * - buffer: token.balanceOf(StableStaker) — the set-aside balance held directly on the
 *   contract, used to pay withdrawals while the pool's yield strategy is underwater
 * - totalStaked: poolInfo(token).totalStaked
 * - underwater: withdrawDisabled(token) — true when the strategy is below par
 *   (totalBalanceOf < principalOf), i.e. a withdraw would evaluate the pool as underwater
 */
function useStableStakerPoolStats(
  stableStaker: `0x${string}` | undefined,
  tokenAddress: `0x${string}` | undefined,
) {
  const enabled =
    !!stableStaker && stableStaker !== ZERO_ADDRESS &&
    !!tokenAddress && tokenAddress !== ZERO_ADDRESS;

  const { data: buffer, refetch: refetchBuffer, isLoading: bufferLoading } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: stableStaker ? [stableStaker] : undefined,
    query: { enabled },
  });

  const { data: poolInfo, refetch: refetchPoolInfo, isLoading: poolInfoLoading } = useReadContract({
    address: stableStaker,
    abi: stableStakerAbi,
    functionName: 'poolInfo',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled },
  });

  const { data: withdrawDisabled, refetch: refetchWithdrawDisabled, isLoading: withdrawDisabledLoading } = useReadContract({
    address: stableStaker,
    abi: stableStakerAbi,
    functionName: 'withdrawDisabled',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled },
  });

  return {
    buffer: typeof buffer === 'bigint' ? buffer : undefined,
    // poolInfo tuple: (phusdPerSecond, accPhusdPerShare, lastRewardTime, totalStaked)
    totalStaked: poolInfo ? poolInfo[3] : undefined,
    underwater: withdrawDisabled === true,
    isLoading: bufferLoading || poolInfoLoading || withdrawDisabledLoading,
    refetch: () => {
      refetchBuffer();
      refetchPoolInfo();
      refetchWithdrawDisabled();
    },
  };
}

/**
 * Reads one yield-strategy client's principal/yield/total for a single token.
 *
 * A yield strategy tracks deposits per (token, client) pair, where `client` is
 * the contract that deposited into the strategy (e.g. PhusdStableMinter or
 * StableStaker). principalOf returns the deposited principal, totalBalanceOf
 * returns principal + accrued yield, and yield is the difference.
 *
 * Returns 0n for any pair that has never deposited (the strategy reverts/returns
 * zero), so callers can safely sum across clients.
 */
function useYieldStrategyClientStats(
  strategy: `0x${string}` | undefined,
  token: `0x${string}` | undefined,
  client: `0x${string}` | undefined,
) {
  const enabled =
    !!strategy && strategy !== ZERO_ADDRESS &&
    !!token && token !== ZERO_ADDRESS &&
    !!client && client !== ZERO_ADDRESS;

  const { data: principalData, refetch: refetchPrincipal } = useReadContract({
    address: strategy,
    abi: erc4626YieldStrategyAbi,
    functionName: 'principalOf',
    args: token && client ? [token, client] : undefined,
    query: { enabled },
  });

  const { data: totalData, refetch: refetchTotal } = useReadContract({
    address: strategy,
    abi: erc4626YieldStrategyAbi,
    functionName: 'totalBalanceOf',
    args: token && client ? [token, client] : undefined,
    query: { enabled },
  });

  const principal = typeof principalData === 'bigint' ? principalData : 0n;
  const total = typeof totalData === 'bigint' ? totalData : 0n;
  const yieldAmount = total > principal ? total - principal : 0n;

  return {
    principal,
    total,
    yield: yieldAmount,
    refetch: () => {
      refetchPrincipal();
      refetchTotal();
    },
  };
}

/**
 * Admin Component
 *
 * Provides administrative controls for the Phoenix protocol contract owners.
 * This component is only rendered when the connected wallet address matches
 * the owner address of any Phase 2 protocol contract.
 */
export default function Admin() {
  const { isConnected, address: walletAddress } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const chainId = useChainId();
  const { addToast, removeToast } = useToast();
  const [isMinting, setIsMinting] = useState(false);

  // State for contract and function selection
  const [selectedContractKey, setSelectedContractKey] = useState<string>('');
  const [ownedContracts, setOwnedContracts] = useState<ContractConfig[]>([]);
  const [isLoadingOwnership, setIsLoadingOwnership] = useState(false);
  const [availableFunctions, setAvailableFunctions] = useState<string[]>([]);
  const [selectedFunctionName, setSelectedFunctionName] = useState<string>('');
  const [selectedFunction, setSelectedFunction] = useState<AbiFunction | null>(null);

  // State for parameter inputs and validation
  const [parameterValues, setParameterValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [conversionErrors, setConversionErrors] = useState<Record<string, string>>({});

  // State for transaction management
  const [isCalling, setIsCalling] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch the owner address from the PhlimboEA contract (new Phase 2 architecture)
  const { data: ownerAddress } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboV2Abi,
    functionName: 'owner',
    query: {
      enabled: !!addresses?.PhlimboEA,
    },
  });

  // Fetch principal from YieldStrategyDola (principal deposited via PhusdStableMinter)
  const { data: phusdStableMinterPrincipal, refetch: refetchPrincipal, error: principalError } = useReadContract({
    address: addresses?.YieldStrategyDola as `0x${string}` | undefined,
    abi: erc4626YieldStrategyAbi,
    functionName: 'principalOf',
    args: addresses?.Dola && addresses?.PhusdStableMinter
      ? [addresses.Dola as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyDola && !!addresses?.Dola && !!addresses?.PhusdStableMinter,
    },
  });

  // Fetch total balance from YieldStrategyDola (principal + yield for PhusdStableMinter)
  // Uses totalBalanceOf per IYieldStrategy interface specification
  // This is used for calculating yield display: yield = totalBalanceOf - principalOf
  const { data: phusdStableMinterTotalBalance, refetch: refetchTotalBalance, error: totalBalanceError } = useReadContract({
    address: addresses?.YieldStrategyDola as `0x${string}` | undefined,
    abi: erc4626YieldStrategyAbi,
    functionName: 'totalBalanceOf',
    args: addresses?.Dola && addresses?.PhusdStableMinter
      ? [addresses.Dola as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyDola && !!addresses?.Dola && !!addresses?.PhusdStableMinter,
    },
  });

  // Fetch principal from YieldStrategyUSDC (autoUSD - principal deposited via PhusdStableMinter)
  const { data: autoUsdPrincipal, refetch: refetchAutoUsdPrincipal, error: autoUsdPrincipalError } = useReadContract({
    address: addresses?.YieldStrategyUSDC as `0x${string}` | undefined,
    abi: erc4626YieldStrategyAbi,
    functionName: 'principalOf',
    args: addresses?.USDC && addresses?.PhusdStableMinter
      ? [addresses.USDC as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyUSDC && !!addresses?.USDC && !!addresses?.PhusdStableMinter,
    },
  });

  // Fetch total balance from YieldStrategyUSDC (autoUSD - principal + yield for PhusdStableMinter)
  const { data: autoUsdTotalBalance, refetch: refetchAutoUsdTotalBalance, error: autoUsdTotalBalanceError } = useReadContract({
    address: addresses?.YieldStrategyUSDC as `0x${string}` | undefined,
    abi: erc4626YieldStrategyAbi,
    functionName: 'totalBalanceOf',
    args: addresses?.USDC && addresses?.PhusdStableMinter
      ? [addresses.USDC as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyUSDC && !!addresses?.USDC && !!addresses?.PhusdStableMinter,
    },
  });

  // Fetch principal from YieldStrategyUSDe (principal deposited via PhusdStableMinter)
  const { data: usdeYieldStrategyPrincipal, refetch: refetchUsdePrincipal, error: usdePrincipalError } = useReadContract({
    address: addresses?.YieldStrategyUSDe as `0x${string}` | undefined,
    abi: erc4626YieldStrategyAbi,
    functionName: 'principalOf',
    args: addresses?.USDe && addresses?.PhusdStableMinter
      ? [addresses.USDe as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyUSDe && !!addresses?.USDe && !!addresses?.PhusdStableMinter,
    },
  });

  // Fetch total balance from YieldStrategyUSDe (principal + yield for PhusdStableMinter)
  const { data: usdeYieldStrategyTotalBalance, refetch: refetchUsdeTotalBalance, error: usdeTotalBalanceError } = useReadContract({
    address: addresses?.YieldStrategyUSDe as `0x${string}` | undefined,
    abi: erc4626YieldStrategyAbi,
    functionName: 'totalBalanceOf',
    args: addresses?.USDe && addresses?.PhusdStableMinter
      ? [addresses.USDe as `0x${string}`, addresses.PhusdStableMinter as `0x${string}`]
      : undefined,
    query: {
      enabled: !!addresses?.YieldStrategyUSDe && !!addresses?.USDe && !!addresses?.PhusdStableMinter,
    },
  });

  // ========== PHLIMBO STATISTICS SECTION ==========
  // Fetch PhlimboEA pool info: (totalStaked, accPhUSDPerShare, accStablePerShare, phUSDPerSecond, lastRewardTime)
  const { data: poolInfo, refetch: refetchPoolInfo, isLoading: poolInfoLoading } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboV2Abi,
    functionName: 'getPoolInfo',
    query: {
      enabled: !!addresses?.PhlimboEA,
    },
  });

  // Fetch rewardPerSecond from PhlimboEA (linear depletion reward rate)
  const { data: rewardPerSecond, refetch: refetchRewardsPerSecond, isLoading: rewardPerSecondLoading } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboV2Abi,
    functionName: 'rewardPerSecond',
    query: {
      enabled: !!addresses?.PhlimboEA,
    },
  });

  // Fetch depletionDuration from PhlimboEA (duration over which rewards are depleted, in seconds)
  const { data: depletionDuration, refetch: refetchDepletionDuration, isLoading: depletionDurationLoading } = useReadContract({
    address: addresses?.PhlimboEA as `0x${string}` | undefined,
    abi: phlimboV2Abi,
    functionName: 'depletionDuration',
    query: {
      enabled: !!addresses?.PhlimboEA,
    },
  });

  // Fetch USDC balance held by PhlimboEA contract
  const { balance: phlimboUsdcBalance, refetch: refetchPhlimboUsdc, isLoading: phlimboUsdcLoading } = useTokenBalance(
    addresses?.PhlimboEA as `0x${string}` | undefined,
    addresses?.USDC as `0x${string}` | undefined
  );

  // Fetch YieldFunnel DOLA pending yield from StableYieldAccumulator.getYield(dolaStrategy)
  const { data: dolaYield, refetch: refetchDolaYield, isLoading: dolaYieldLoading } = useReadContract({
    address: addresses?.StableYieldAccumulator as `0x${string}` | undefined,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getYield',
    args: addresses?.YieldStrategyDola ? [addresses.YieldStrategyDola as `0x${string}`] : undefined,
    query: {
      enabled: !!addresses?.StableYieldAccumulator && !!addresses?.YieldStrategyDola,
    },
  });

  // Fetch YieldFunnel USDC pending yield from StableYieldAccumulator.getYield(usdcStrategy)
  const { data: usdcFunnelYield, refetch: refetchUsdcFunnelYield, isLoading: usdcFunnelYieldLoading } = useReadContract({
    address: addresses?.StableYieldAccumulator as `0x${string}` | undefined,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getYield',
    args: addresses?.YieldStrategyUSDC ? [addresses.YieldStrategyUSDC as `0x${string}`] : undefined,
    query: {
      enabled: !!addresses?.StableYieldAccumulator && !!addresses?.YieldStrategyUSDC,
    },
  });

  // Fetch YieldFunnel USDe pending yield from StableYieldAccumulator.getYield(usdeStrategy)
  const { data: usdeFunnelYield, refetch: refetchUsdeFunnelYield, isLoading: usdeFunnelYieldLoading } = useReadContract({
    address: addresses?.StableYieldAccumulator as `0x${string}` | undefined,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getYield',
    args: addresses?.YieldStrategyUSDe ? [addresses.YieldStrategyUSDe as `0x${string}`] : undefined,
    query: {
      enabled: !!addresses?.StableYieldAccumulator && !!addresses?.YieldStrategyUSDe,
    },
  });

  // ========== STABLE STAKER SECTION ==========
  const stableStakerAddress = addresses?.StableStaker as `0x${string}` | undefined;
  const isStableStakerDeployed = !!stableStakerAddress && stableStakerAddress !== ZERO_ADDRESS;
  const stableStakerUsdc = useStableStakerPoolStats(stableStakerAddress, addresses?.USDC as `0x${string}` | undefined);
  const stableStakerUsde = useStableStakerPoolStats(stableStakerAddress, addresses?.USDe as `0x${string}` | undefined);
  const stableStakerDola = useStableStakerPoolStats(stableStakerAddress, addresses?.Dola as `0x${string}` | undefined);
  const stableStakerPools = [
    { label: 'USDC', decimals: 6, stats: stableStakerUsdc },
    { label: 'USDe', decimals: 18, stats: stableStakerUsde },
    { label: 'DOLA', decimals: 18, stats: stableStakerDola },
  ];
  const stableStakerLoading = stableStakerPools.some((p) => p.stats.isLoading);

  // Yield-strategy balances attributable to the StableStaker client, mirroring
  // the PhusdStableMinter reads above. The strategy panels show line items for
  // both clients (StableMinter + StableStaker) with per-strategy totals.
  const dolaStakerStrategyStats = useYieldStrategyClientStats(
    addresses?.YieldStrategyDola as `0x${string}` | undefined,
    addresses?.Dola as `0x${string}` | undefined,
    stableStakerAddress,
  );
  const usdcStakerStrategyStats = useYieldStrategyClientStats(
    addresses?.YieldStrategyUSDC as `0x${string}` | undefined,
    addresses?.USDC as `0x${string}` | undefined,
    stableStakerAddress,
  );
  const usdeStakerStrategyStats = useYieldStrategyClientStats(
    addresses?.YieldStrategyUSDe as `0x${string}` | undefined,
    addresses?.USDe as `0x${string}` | undefined,
    stableStakerAddress,
  );

  // USDe's position under the retired V1 StableMinter. USDe never migrated to V2,
  // so this read (against the hardcoded V1 minter) holds its real balance, while
  // the V2 read above reflects the current minter. Shown as a separate line item.
  const usdeStableMinterV1Stats = useYieldStrategyClientStats(
    addresses?.YieldStrategyUSDe as `0x${string}` | undefined,
    addresses?.USDe as `0x${string}` | undefined,
    PHUSD_STABLE_MINTER_V1,
  );

  // Extract values from poolInfo tuple
  const phlimboTotalStaked = poolInfo ? poolInfo[0] : 0n;
  const phlimboPhUSDPerSecond = poolInfo ? poolInfo[3] : 0n;

  // Helper function to format duration in human-readable format
  const formatDuration = (seconds: bigint | undefined): string => {
    if (!seconds) return '0 seconds';
    const secs = Number(seconds);
    if (secs === 0) return '0 seconds';

    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const remainingSecs = secs % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    if (remainingSecs > 0 && parts.length === 0) parts.push(`${remainingSecs} second${remainingSecs !== 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(', ') : '0 seconds';
  };

  // Format Phlimbo statistics for display
  const phUSDPerSecondDisplay = (Number(phlimboPhUSDPerSecond) / 1e18).toFixed(6);
  // rewardPerSecond is stored with 1e18 precision scaling AND is in raw USDC (6 decimals)
  // So divide by 1e18 (precision) and 1e6 (USDC decimals) = 1e24 total
  const rewardPerSecondDisplay = rewardPerSecond
    ? (Number(rewardPerSecond) / 1e24).toFixed(8)
    : '0.00000000';
  const depletionDurationDisplay = formatDuration(depletionDuration as bigint | undefined);
  const totalStakedDisplay = (Number(phlimboTotalStaked) / 1e18).toFixed(2);
  const phlimboUsdcDisplay = phlimboUsdcBalance
    ? (Number(phlimboUsdcBalance) / 1e6).toFixed(2) // USDC has 6 decimals
    : '0.00';
  const dolaYieldDisplay = dolaYield
    ? (Number(dolaYield) / 1e18).toFixed(2)
    : '0.00';
  const usdcFunnelYieldDisplay = usdcFunnelYield
    ? (Number(usdcFunnelYield) / 1e6).toFixed(2)
    : '0.00';
  const usdeFunnelYieldDisplay = usdeFunnelYield
    ? (Number(usdeFunnelYield) / 1e18).toFixed(2)
    : '0.00';

  // Combined loading state for Phlimbo statistics
  const phlimboStatsLoading = poolInfoLoading || rewardPerSecondLoading || depletionDurationLoading || phlimboUsdcLoading || dolaYieldLoading || usdcFunnelYieldLoading || usdeFunnelYieldLoading;

  // Refetch all Phlimbo statistics
  const refetchPhlimboStats = () => {
    refetchPoolInfo();
    refetchRewardsPerSecond();
    refetchDepletionDuration();
    refetchPhlimboUsdc();
    refetchDolaYield();
    refetchUsdcFunnelYield();
    refetchUsdeFunnelYield();
  };
  // ========== END PHLIMBO STATISTICS SECTION ==========

  // ========== SOLVENCY STATUS SECTION ==========
  // Use the custom solvency info hook for calculating solvency metrics
  const {
    actualBalanceFormatted: solvencyActualBalance,
    owedToStakersFormatted,
    runwayFormatted,
    runwayTimeFormatted,
    runwayHealth,
    isLoading: solvencyLoading,
    refetch: refetchSolvency,
  } = useSolvencyInfo();

  // Helper function to get color class based on runway health
  const getRunwayHealthColor = (health: 'healthy' | 'warning' | 'critical'): string => {
    switch (health) {
      case 'healthy':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-foreground';
    }
  };
  // ========== END SOLVENCY STATUS SECTION ==========

  // ========== NFT STAKER RUNWAY SECTION ==========
  // The runway panels themselves live in <NftStakerRunwayPanel>; here we only
  // resolve the staker addresses fed to each instance. There are two NFT
  // stakers: the original Liquid Sky Phoenix (LSP) staker and the Ratchet staker.
  const nftStakerAddress = addresses?.NFTStaker as `0x${string}` | undefined;
  const ratchetNftStakerAddress = addresses?.RatchetNFTStaker as `0x${string}` | undefined;
  const phUsdAddress = addresses?.PhUSD as `0x${string}` | undefined;
  // ========== END NFT STAKER RUNWAY SECTION ==========

  // ========== BALANCER POOLER V2 DISPATCH SECTION ==========
  const balancerPoolerV2Address = addresses?.BalancerPooler as `0x${string}` | undefined;
  const sUsdsAddress = addresses?.SUSDS as `0x${string}` | undefined;
  const isBalancerPoolerV2Deployed = !!balancerPoolerV2Address &&
    balancerPoolerV2Address.toLowerCase() !== ZERO_ADDRESS;

  const { data: dispatcherSusdsBalance, refetch: refetchDispatcherSusdsBalance } = useReadContract({
    address: sUsdsAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: balancerPoolerV2Address ? [balancerPoolerV2Address] : undefined,
    query: { enabled: isBalancerPoolerV2Deployed && !!sUsdsAddress },
  });

  const { data: dispatcherAuthVersion, refetch: refetchAuthVersion } = useReadContract({
    address: balancerPoolerV2Address,
    abi: balancerPoolerV2Abi,
    functionName: 'authVersion',
    query: { enabled: isBalancerPoolerV2Deployed },
  });

  const { data: dispatcherPoolerAuthVersion, refetch: refetchPoolerAuthVersion } = useReadContract({
    address: balancerPoolerV2Address,
    abi: balancerPoolerV2Abi,
    functionName: 'poolerAuthVersion',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    query: { enabled: isBalancerPoolerV2Deployed && !!walletAddress },
  });

  const { data: dispatcherPaused, refetch: refetchDispatcherPaused } = useReadContract({
    address: balancerPoolerV2Address,
    abi: balancerPoolerV2Abi,
    functionName: 'paused',
    query: { enabled: isBalancerPoolerV2Deployed },
  });

  // Donation percent (0–100). Contract computes setAside = balance * pct / 100
  // at execution time. Configured via setBatchDonationSize. A zero value is a
  // supported "donations off" state — the contract skips the donation phase
  // entirely. Still read here because the set-aside reduces the BPT actually
  // minted, which feeds the minBPT slippage estimate below.
  const { data: batchDonationSize, refetch: refetchBatchDonationSize } = useReadContract({
    address: balancerPoolerV2Address,
    abi: balancerPoolerV2Abi,
    functionName: 'batchDonationSize',
    query: { enabled: isBalancerPoolerV2Deployed },
  });

  // Mirror the contract's compute exactly: (balance * pct) / 100. Both inputs
  // are bigints, so the division floors — same as Solidity.
  const setAsideSusds = useMemo<bigint | null>(() => {
    if (typeof dispatcherSusdsBalance !== 'bigint') return null;
    if (typeof batchDonationSize !== 'bigint') return null;
    if (batchDonationSize === 0n || dispatcherSusdsBalance === 0n) return 0n;
    return (dispatcherSusdsBalance * batchDonationSize) / 100n;
  }, [dispatcherSusdsBalance, batchDonationSize]);

  // Resolve the Balancer V3 pool address from the dispatcher's `pool()` view.
  // In Balancer V3 the pool contract IS the BPT ERC20 token, so we then read
  // the dispatcher's ERC20 balance on that address to get its accumulated BPT.
  const { data: balancerPoolAddress } = useReadContract({
    address: balancerPoolerV2Address,
    abi: balancerPoolerV2Abi,
    functionName: 'pool',
    query: { enabled: isBalancerPoolerV2Deployed },
  });

  const isPoolAddressValid = typeof balancerPoolAddress === 'string'
    && (balancerPoolAddress as string).toLowerCase() !== ZERO_ADDRESS;

  const { data: dispatcherBptBalance, refetch: refetchDispatcherBptBalance } = useReadContract({
    address: balancerPoolAddress as `0x${string}` | undefined,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: balancerPoolerV2Address ? [balancerPoolerV2Address] : undefined,
    query: {
      enabled: isBalancerPoolerV2Deployed
        && isPoolAddressValid
        && !!balancerPoolerV2Address,
    },
  });

  // getIdealBPT is non-view (writes Balancer router transient state during the
  // simulation), so eth_call still returns a clean value but useReadContract
  // will reject the ABI annotation. Use useSimulateContract — same eth_call
  // underneath. Only run the simulation when there is an sUSDS balance to pool;
  // otherwise the call reverts and we'd surface a misleading error.
  //
  // account: zeroAddress is required for the real Balancer V3 router. It detects
  // static-call mode via `tx.origin == address(0)` (EVMCallModeHelpers) and
  // reverts query paths with NotStaticCall() when called with a non-zero `from`.
  // Wagmi defaults `from` to the connected wallet, which trips this check on
  // mainnet/staging; the local mock router doesn't enforce it.
  const idealBptSimEnabled = isBalancerPoolerV2Deployed &&
    typeof dispatcherSusdsBalance === 'bigint' &&
    dispatcherSusdsBalance > 0n;

  const {
    data: idealBptSim,
    refetch: refetchIdealBpt,
    error: idealBptError,
  } = useSimulateContract({
    address: balancerPoolerV2Address,
    abi: balancerPoolerV2Abi,
    functionName: 'getIdealBPT',
    account: zeroAddress,
    query: { enabled: idealBptSimEnabled },
  });

  const idealBpt = useMemo<bigint | null>(() => {
    if (!idealBptSim) return null;
    const result = idealBptSim.result;
    return typeof result === 'bigint' ? result : null;
  }, [idealBptSim]);

  const isAuthorisedPooler = useMemo(() => {
    if (typeof dispatcherAuthVersion !== 'bigint') return false;
    if (typeof dispatcherPoolerAuthVersion !== 'bigint') return false;
    return dispatcherPoolerAuthVersion === dispatcherAuthVersion;
  }, [dispatcherAuthVersion, dispatcherPoolerAuthVersion]);

  // Editable input for minBPT, displayed as decimal but stored raw.
  const [minBptInput, setMinBptInput] = useState<string>('');
  // Tracks whether the user has manually edited the minBPT input. Once true,
  // we stop auto-overwriting from idealBpt updates so we don't clobber edits.
  const [userEditedMinBpt, setUserEditedMinBpt] = useState(false);

  // Auto-populate minBPT to (expected BPT) * 99 / 100 (1% slippage) whenever
  // idealBpt changes, unless the user has manually edited the field. Never
  // default to 0.
  //
  // getIdealBPT() takes no args and simulates against the dispatcher's full
  // sUSDS balance, but the contract sets aside batchDonationSize% of that
  // balance for the donation/nudge swap before pooling. So the BPT actually
  // minted is roughly idealBpt * (balance - setAside) / balance. Scale before
  // applying the 1% tolerance — otherwise pool() reverts on the slippage guard
  // whenever donations are enabled.
  useEffect(() => {
    if (userEditedMinBpt) return;
    if (idealBpt === null || idealBpt === 0n) return;
    if (typeof dispatcherSusdsBalance !== 'bigint' || dispatcherSusdsBalance === 0n) return;
    if (setAsideSusds === null) return;
    const pooled = dispatcherSusdsBalance - setAsideSusds;
    if (pooled <= 0n) return;
    const expected = (idealBpt * pooled) / dispatcherSusdsBalance;
    const tolerated = (expected * 99n) / 100n;
    if (tolerated === 0n) return;
    setMinBptInput(formatUnits(tolerated, 18));
  }, [idealBpt, userEditedMinBpt, dispatcherSusdsBalance, setAsideSusds]);

  const parsedMinBpt = useMemo<bigint | null>(() => {
    const trimmed = minBptInput.trim();
    if (!trimmed) return null;
    try {
      const value = parseUnits(trimmed, 18);
      return value;
    } catch {
      return null;
    }
  }, [minBptInput]);

  const [poolTxHash, setPoolTxHash] = useState<`0x${string}` | undefined>();
  const [isPoolExecuting, setIsPoolExecuting] = useState(false);
  const { isSuccess: poolConfirmed } = useWaitForTransactionReceipt({
    hash: poolTxHash,
    query: { enabled: !!poolTxHash },
  });

  const refetchDispatcherStats = () => {
    refetchDispatcherSusdsBalance();
    refetchAuthVersion();
    refetchPoolerAuthVersion();
    refetchDispatcherPaused();
    refetchIdealBpt();
    refetchDispatcherBptBalance();
    refetchBatchDonationSize();
  };

  useEffect(() => {
    if (poolConfirmed && poolTxHash) {
      setIsPoolExecuting(false);
      setPoolTxHash(undefined);
      // After a successful pool, sUSDS balance drops to 0 and the next
      // getIdealBPT() simulation will revert (require sUSDSAmount > 0). The
      // refetch call still triggers the read; the gating in `idealBptSimEnabled`
      // suppresses it once balance hits 0.
      refetchDispatcherStats();
      // Clear the manual-edit flag so the next non-zero balance auto-populates.
      setUserEditedMinBpt(false);
      setMinBptInput('');
      addToast({
        type: 'success',
        title: 'Pool Confirmed',
        description: 'sUSDS has been pooled into the Balancer V3 pool.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolConfirmed, poolTxHash]);
  // ========== END BALANCER POOLER V2 DISPATCH SECTION ==========

  // ========== UNIBOOST MULTIPOOLER SECTION ==========
  const multiPoolerAddress = addresses?.MultiPooler as `0x${string}` | undefined;
  const isMultiPoolerDeployed = !!multiPoolerAddress &&
    multiPoolerAddress.toLowerCase() !== ZERO_ADDRESS;

  // Authorisation mirrors BalancerPoolerV2: the connected wallet must be the
  // MultiPooler's single authorised pooler (setPooler) or its owner.
  const { data: multiPoolerPooler, refetch: refetchMultiPoolerPooler } = useReadContract({
    address: multiPoolerAddress,
    abi: multiPoolerAbi,
    functionName: 'pooler',
    query: { enabled: isMultiPoolerDeployed },
  });

  const { data: multiPoolerOwner, refetch: refetchMultiPoolerOwner } = useReadContract({
    address: multiPoolerAddress,
    abi: multiPoolerAbi,
    functionName: 'owner',
    query: { enabled: isMultiPoolerDeployed },
  });

  const isAuthorisedMultiPooler = useMemo(() => {
    if (!walletAddress) return false;
    const w = walletAddress.toLowerCase();
    const pooler = typeof multiPoolerPooler === 'string' ? multiPoolerPooler.toLowerCase() : undefined;
    const owner = typeof multiPoolerOwner === 'string' ? multiPoolerOwner.toLowerCase() : undefined;
    return w === pooler || w === owner;
  }, [walletAddress, multiPoolerPooler, multiPoolerOwner]);

  const [multiPoolRows, setMultiPoolRows] = useState<Record<UniboostLabel, PoolRowInput>>(emptyPoolRows);

  // MEV-safe auto-fill. Unlike BalancerPoolerV2 (getIdealBPT on-chain quote), the
  // Uniboost dispatcher exposes no quote, so each row's floors are reconstructed
  // off-chain from the dispatcher's prime balance + UniV2 quotes/reserves at 1%
  // slippage — see useUniboostAutofill. One hook per dispatcher, unrolled (never
  // in a loop) to keep hook order stable.
  const eyeAutofill = useUniboostAutofill(addresses?.UniboostEYE as `0x${string}` | undefined);
  const scxAutofill = useUniboostAutofill(addresses?.UniboostSCX as `0x${string}` | undefined);
  const flxAutofill = useUniboostAutofill(addresses?.UniboostFLX as `0x${string}` | undefined);
  const uniboostAutofills: Record<UniboostLabel, ReturnType<typeof useUniboostAutofill>> = {
    EYE: eyeAutofill,
    SCX: scxAutofill,
    FLX: flxAutofill,
  };

  // Once the user edits any field of a row we stop auto-overwriting it (mirrors
  // BalancerPoolerV2's userEditedMinBpt guard). Cleared after a successful pool
  // and by the per-row "auto" reset.
  const [userEditedRows, setUserEditedRows] = useState<Record<UniboostLabel, boolean>>({
    EYE: false,
    SCX: false,
    FLX: false,
  });

  // Auto-populate each un-edited row from its dispatcher's suggestion. Only writes
  // when the suggestion differs from the current row, so it never loops.
  useEffect(() => {
    setMultiPoolRows((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const { label } of UNIBOOST_ROWS) {
        if (userEditedRows[label]) continue;
        const s = uniboostAutofills[label].suggestion;
        if (!s) continue;
        const cur = prev[label];
        if (
          cur.amountIn === s.amountIn &&
          cur.minPairOut === s.minPairOut &&
          cur.minTargetOut === s.minTargetOut &&
          cur.minLP === s.minLP
        ) {
          continue;
        }
        next[label] = {
          amountIn: s.amountIn,
          minPairOut: s.minPairOut,
          minTargetOut: s.minTargetOut,
          minLP: s.minLP,
        };
        changed = true;
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEditedRows, eyeAutofill.suggestion, scxAutofill.suggestion, flxAutofill.suggestion]);

  // Validate all rows in one pass for the button gating. A row is "included"
  // once amountIn parses to > 0; mins must each be > 0 on an included row (a 0
  // slippage floor on a public mempool invites an MEV sandwich, same rationale
  // as the BalancerPoolerV2 minBPT guard).
  const multiPoolValidation = useMemo(() => {
    let validCount = 0;
    let anyMinInvalid = false;
    let anyNumberInvalid = false;
    for (const { label } of UNIBOOST_ROWS) {
      const row = multiPoolRows[label];
      if (!row.amountIn.trim()) continue;
      try {
        const d = label === 'EYE' ? eyeAutofill.decimals : label === 'SCX' ? scxAutofill.decimals : flxAutofill.decimals;
        const amountIn = parseUnits(row.amountIn.trim(), d.amountIn);
        const minPairOut = parseUnits(row.minPairOut.trim() || '0', d.minPairOut);
        const minTargetOut = parseUnits(row.minTargetOut.trim() || '0', d.minTargetOut);
        const minLP = parseUnits(row.minLP.trim() || '0', d.minLP);
        if (amountIn <= 0n) continue;
        validCount++;
        if (minPairOut <= 0n || minTargetOut <= 0n || minLP <= 0n) anyMinInvalid = true;
      } catch {
        anyNumberInvalid = true;
      }
    }
    return { validCount, anyMinInvalid, anyNumberInvalid };
  }, [multiPoolRows, eyeAutofill.decimals, scxAutofill.decimals, flxAutofill.decimals]);

  const [multiPoolTxHash, setMultiPoolTxHash] = useState<`0x${string}` | undefined>();
  const [isMultiPoolExecuting, setIsMultiPoolExecuting] = useState(false);
  const { isSuccess: multiPoolConfirmed } = useWaitForTransactionReceipt({
    hash: multiPoolTxHash,
    query: { enabled: !!multiPoolTxHash },
  });

  useEffect(() => {
    if (multiPoolConfirmed && multiPoolTxHash) {
      setIsMultiPoolExecuting(false);
      setMultiPoolTxHash(undefined);
      setMultiPoolRows(emptyPoolRows());
      // Clear the edit guards and refetch balances/quotes so the drained
      // dispatchers re-auto-populate (to blank while balances are 0).
      setUserEditedRows({ EYE: false, SCX: false, FLX: false });
      eyeAutofill.refetch();
      scxAutofill.refetch();
      flxAutofill.refetch();
      refetchMultiPoolerPooler();
      refetchMultiPoolerOwner();
      addToast({
        type: 'success',
        title: 'Pool Confirmed',
        description: 'Uniboost dispatchers pooled via MultiPooler.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiPoolConfirmed, multiPoolTxHash]);
  // ========== END UNIBOOST MULTIPOOLER SECTION ==========

  // ========== NUDGE RATCHET RELEASE SECTION ==========
  const nudgeRatchetAddress = addresses?.NudgeRatchet as `0x${string}` | undefined;
  const isNudgeRatchetDeployed = !!nudgeRatchetAddress &&
    nudgeRatchetAddress.toLowerCase() !== ZERO_ADDRESS;

  const { data: nudgeRatchetOwner, refetch: refetchNudgeRatchetOwner } = useReadContract({
    address: nudgeRatchetAddress,
    abi: nudgeRatchetDelayReleaseAbi,
    functionName: 'owner',
    query: { enabled: isNudgeRatchetDeployed },
  });

  const { data: nudgeRatchetIsReleaser, refetch: refetchNudgeRatchetIsReleaser } = useReadContract({
    address: nudgeRatchetAddress,
    abi: nudgeRatchetDelayReleaseAbi,
    functionName: 'releasers',
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    query: { enabled: isNudgeRatchetDeployed && !!walletAddress },
  });

  const { data: nudgeRatchetPaused, refetch: refetchNudgeRatchetPaused } = useReadContract({
    address: nudgeRatchetAddress,
    abi: nudgeRatchetDelayReleaseAbi,
    functionName: 'paused',
    query: { enabled: isNudgeRatchetDeployed },
  });

  // Pending USDC held by the dispatcher = the upper limit for release(amount).
  // The dispatcher's primeToken is 6-decimal USDC and release() transfers raw units.
  const nudgeRatchetUsdcAddress = addresses?.USDC as `0x${string}` | undefined;
  const { data: nudgeRatchetPendingUsdc, refetch: refetchNudgeRatchetPendingUsdc } = useReadContract({
    address: nudgeRatchetUsdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: nudgeRatchetAddress ? [nudgeRatchetAddress] : undefined,
    query: { enabled: isNudgeRatchetDeployed && !!nudgeRatchetUsdcAddress },
  });

  const isAuthorisedReleaser = useMemo(() => {
    if (!walletAddress) return false;
    const w = walletAddress.toLowerCase();
    const owner = typeof nudgeRatchetOwner === 'string' ? nudgeRatchetOwner.toLowerCase() : undefined;
    return w === owner || nudgeRatchetIsReleaser === true;
  }, [walletAddress, nudgeRatchetOwner, nudgeRatchetIsReleaser]);

  const [releaseAmountInput, setReleaseAmountInput] = useState<string>('');

  const parsedReleaseAmount = useMemo<bigint | null>(() => {
    const trimmed = releaseAmountInput.trim();
    if (!trimmed) return null;
    try {
      // USDC is 6 decimals; release() transfers raw token units.
      return parseUnits(trimmed, 6);
    } catch {
      return null;
    }
  }, [releaseAmountInput]);

  const [releaseTxHash, setReleaseTxHash] = useState<`0x${string}` | undefined>();
  const [isReleaseExecuting, setIsReleaseExecuting] = useState(false);
  const { isSuccess: releaseConfirmed } = useWaitForTransactionReceipt({
    hash: releaseTxHash,
    query: { enabled: !!releaseTxHash },
  });

  useEffect(() => {
    if (releaseConfirmed && releaseTxHash) {
      setIsReleaseExecuting(false);
      setReleaseTxHash(undefined);
      setReleaseAmountInput('');
      refetchNudgeRatchetOwner();
      refetchNudgeRatchetIsReleaser();
      refetchNudgeRatchetPaused();
      refetchNudgeRatchetPendingUsdc();
      addToast({
        type: 'success',
        title: 'Release Confirmed',
        description: 'NudgeRatchet release executed.',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseConfirmed, releaseTxHash]);
  // ========== END NUDGE RATCHET RELEASE SECTION ==========

  // Wagmi hooks for contract write and transaction tracking
  const { data: txHash, writeContractAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
    },
  });

  // Check if we should show mint yield button (hide on mainnet, chainID 1)
  const isMainnet = chainId === 1;
  const showMintYieldButton = !isMainnet;

  // Calculate yield vs principal breakdown
  // Total = phusdStableMinterTotalBalance (queries YieldStrategyDola.totalBalanceOf)
  // Principal = principal tracked for PhusdStableMinter deposits (queries YieldStrategyDola.principalOf)
  // Yield = Total - Principal (calculated from YieldStrategyDola's tracked principal + yield)
  const principal = phusdStableMinterPrincipal !== undefined ? phusdStableMinterPrincipal : 0n;
  const totalVaultBalance = phusdStableMinterTotalBalance !== undefined ? phusdStableMinterTotalBalance : 0n;
  const yield_ = totalVaultBalance > principal ? totalVaultBalance - principal : 0n;

  // Calculate USDC yield vs principal breakdown (YieldStrategyUSDC / autoUSD)
  // Uses same pattern as DOLA but with USDC 6 decimals
  const usdcPrincipal = autoUsdPrincipal !== undefined ? autoUsdPrincipal : 0n;
  const usdcTotalBalance = autoUsdTotalBalance !== undefined ? autoUsdTotalBalance : 0n;
  const usdcYield = usdcTotalBalance > usdcPrincipal ? usdcTotalBalance - usdcPrincipal : 0n;

  // Calculate USDe yield vs principal breakdown (YieldStrategyUSDe)
  // Uses same pattern as DOLA since USDe is also 18 decimals
  const usdePrincipal = usdeYieldStrategyPrincipal !== undefined ? usdeYieldStrategyPrincipal : 0n;
  const usdeTotalBalance = usdeYieldStrategyTotalBalance !== undefined ? usdeYieldStrategyTotalBalance : 0n;
  const usdeYield = usdeTotalBalance > usdePrincipal ? usdeTotalBalance - usdePrincipal : 0n;

  // Format a raw token amount for display, scaling by the token's decimals.
  const fmtAmount = (value: bigint, decimals: number): string =>
    Number(formatUnits(value, decimals)).toFixed(2);

  // Per-strategy panel config. Each strategy shows line items split by client
  // (StableMinter + StableStaker) with a per-strategy total row. The StableMinter
  // figures reuse the existing reads above; the StableStaker figures come from
  // useYieldStrategyClientStats.
  const yieldStrategyPanels = [
    {
      name: 'YieldStrategyDola',
      token: 'DOLA',
      decimals: 18,
      clients: [
        { label: 'StableMinter', principal, yield: yield_, total: totalVaultBalance },
        {
          label: 'StableStaker',
          principal: dolaStakerStrategyStats.principal,
          yield: dolaStakerStrategyStats.yield,
          total: dolaStakerStrategyStats.total,
        },
      ],
      refetch: () => {
        refetchPrincipal();
        refetchTotalBalance();
        dolaStakerStrategyStats.refetch();
      },
    },
    {
      name: 'YieldStrategyUSDC',
      token: 'USDC',
      decimals: 6,
      clients: [
        { label: 'StableMinter', principal: usdcPrincipal, yield: usdcYield, total: usdcTotalBalance },
        {
          label: 'StableStaker',
          principal: usdcStakerStrategyStats.principal,
          yield: usdcStakerStrategyStats.yield,
          total: usdcStakerStrategyStats.total,
        },
      ],
      refetch: () => {
        refetchAutoUsdPrincipal();
        refetchAutoUsdTotalBalance();
        usdcStakerStrategyStats.refetch();
      },
    },
    {
      name: 'YieldStrategyUSDe',
      token: 'USDe',
      decimals: 18,
      clients: [
        {
          label: 'StableMinter V1',
          principal: usdeStableMinterV1Stats.principal,
          yield: usdeStableMinterV1Stats.yield,
          total: usdeStableMinterV1Stats.total,
        },
        { label: 'StableMinter V2 (current)', principal: usdePrincipal, yield: usdeYield, total: usdeTotalBalance },
        {
          label: 'StableStaker',
          principal: usdeStakerStrategyStats.principal,
          yield: usdeStakerStrategyStats.yield,
          total: usdeStakerStrategyStats.total,
        },
      ],
      refetch: () => {
        refetchUsdePrincipal();
        refetchUsdeTotalBalance();
        usdeStableMinterV1Stats.refetch();
        usdeStakerStrategyStats.refetch();
      },
    },
  ];

  // Debug logging for balance queries
  useEffect(() => {
    console.log('[Admin] Balance Query Debug:', {
      dola: {
        principal: phusdStableMinterPrincipal?.toString(),
        totalBalance: phusdStableMinterTotalBalance?.toString(),
        yield_: yield_.toString(),
      },
      usdc: {
        principal: autoUsdPrincipal?.toString(),
        totalBalance: autoUsdTotalBalance?.toString(),
        yield_: usdcYield.toString(),
      },
      usde: {
        principal: usdeYieldStrategyPrincipal?.toString(),
        totalBalance: usdeYieldStrategyTotalBalance?.toString(),
        yield_: usdeYield.toString(),
      },
      addresses: {
        YieldStrategyDola: addresses?.YieldStrategyDola,
        YieldStrategyUSDC: addresses?.YieldStrategyUSDC,
        YieldStrategyUSDe: addresses?.YieldStrategyUSDe,
        Dola: addresses?.Dola,
        USDC: addresses?.USDC,
        USDe: addresses?.USDe,
        PhusdStableMinter: addresses?.PhusdStableMinter,
      },
      errors: {
        principalError: principalError?.message,
        totalBalanceError: totalBalanceError?.message,
        autoUsdPrincipalError: autoUsdPrincipalError?.message,
        autoUsdTotalBalanceError: autoUsdTotalBalanceError?.message,
        usdePrincipalError: usdePrincipalError?.message,
        usdeTotalBalanceError: usdeTotalBalanceError?.message,
      }
    });

    if (principalError) {
      console.error('[Admin] DOLA Principal Query Error:', principalError);
    }
    if (totalBalanceError) {
      console.error('[Admin] DOLA Total Balance Query Error:', totalBalanceError);
    }
    if (autoUsdPrincipalError) {
      console.error('[Admin] USDC Principal Query Error:', autoUsdPrincipalError);
    }
    if (autoUsdTotalBalanceError) {
      console.error('[Admin] USDC Total Balance Query Error:', autoUsdTotalBalanceError);
    }
    if (usdePrincipalError) {
      console.error('[Admin] USDe Principal Query Error:', usdePrincipalError);
    }
    if (usdeTotalBalanceError) {
      console.error('[Admin] USDe Total Balance Query Error:', usdeTotalBalanceError);
    }
  }, [phusdStableMinterPrincipal, phusdStableMinterTotalBalance, principal, totalVaultBalance, yield_, autoUsdPrincipal, autoUsdTotalBalance, usdcYield, usdeYieldStrategyPrincipal, usdeYieldStrategyTotalBalance, usdePrincipal, usdeTotalBalance, usdeYield, addresses, principalError, totalBalanceError, autoUsdPrincipalError, autoUsdTotalBalanceError, usdePrincipalError, usdeTotalBalanceError]);

  /**
   * Discover owned contracts by checking ownership of each contract
   */
  useEffect(() => {
    const discoverOwnedContracts = async () => {
      if (!isConnected || !walletAddress || !addresses) {
        console.log('Contract discovery skipped:', {
          isConnected,
          hasWallet: !!walletAddress,
          hasAddresses: !!addresses,
        });
        setOwnedContracts([]);
        return;
      }

      console.log('Starting contract ownership discovery...');
      console.log('Available addresses:', addresses);
      console.log('Connected wallet:', walletAddress);

      setIsLoadingOwnership(true);

      try {
        const contractConfigs = getContractConfigs();
        console.log('Contract configs to check:', contractConfigs.map(c => ({ name: c.name, key: c.addressKey })));

        const ownedConfigsPromises = contractConfigs.map(async (config) => {
          try {
            const contractAddress = addresses[config.addressKey];

            console.log(`Checking ${config.name}:`, {
              addressKey: config.addressKey,
              contractAddress,
              hasAddress: !!contractAddress,
            });

            if (!contractAddress) {
              console.warn(`${config.name}: No address found for key "${config.addressKey}"`);
              return null;
            }

            console.log(`${config.name}: Calling owner() at ${contractAddress}...`);

            // Try to read the owner() function using wagmi's readContract
            try {
              const ownerAddr = await readContract(wagmiConfig, {
                address: contractAddress as `0x${string}`,
                abi: config.abi,
                functionName: 'owner',
              });

              console.log(`${config.name}: Successfully read owner address:`, ownerAddr);

              console.log(`${config.name}: Owner check:`, {
                contractOwner: ownerAddr,
                walletAddress,
                matches: (ownerAddr as string).toLowerCase() === walletAddress.toLowerCase(),
              });

              // Compare addresses (case-insensitive)
              if ((ownerAddr as string).toLowerCase() === walletAddress.toLowerCase()) {
                console.log(`${config.name}: Owned by connected wallet!`);
                return config;
              } else {
                console.log(`${config.name}: Not owned by connected wallet`);
              }
            } catch (ownerError) {
              console.warn(`${config.name}: Failed to read owner() function:`, ownerError);
              // Contract might not have an owner() function, skip it
            }

            return null;
          } catch (error) {
            console.error(`Error checking ownership for ${config.name}:`, error);
            return null;
          }
        });

        const ownedConfigs = (await Promise.all(ownedConfigsPromises)).filter(
          (config): config is ContractConfig => config !== null
        );

        console.log('Ownership discovery complete:', {
          totalChecked: contractConfigs.length,
          ownedCount: ownedConfigs.length,
          ownedContracts: ownedConfigs.map(c => c.name),
        });

        setOwnedContracts(ownedConfigs);
      } catch (error) {
        console.error('Error discovering owned contracts:', error);
        addToast({
          type: 'error',
          title: 'Contract Discovery Failed',
          description: 'Unable to check contract ownership. Please try again.',
        });
      } finally {
        setIsLoadingOwnership(false);
      }
    };

    discoverOwnedContracts();
  }, [isConnected, walletAddress, addresses, addToast]);

  /**
   * Extract functions when a contract is selected
   */
  useEffect(() => {
    if (!selectedContractKey) {
      setAvailableFunctions([]);
      return;
    }

    const selectedContract = ownedContracts.find(
      (contract) => contract.addressKey === selectedContractKey
    );

    if (selectedContract) {
      const functions = extractFunctionsFromAbi(selectedContract.abi);
      setAvailableFunctions(functions);
      setSelectedFunctionName('');
      setSelectedFunction(null);
      setParameterValues({});
      setValidationErrors({});
      setConversionErrors({});
    }
  }, [selectedContractKey, ownedContracts]);

  /**
   * Get function details when a function is selected
   */
  useEffect(() => {
    if (!selectedFunctionName || !selectedContractKey) {
      setSelectedFunction(null);
      setParameterValues({});
      setValidationErrors({});
      setConversionErrors({});
      return;
    }

    const selectedContract = ownedContracts.find(
      (contract) => contract.addressKey === selectedContractKey
    );

    if (!selectedContract) return;

    const func = (selectedContract.abi as AbiFunction[]).find(
      (item): item is AbiFunction =>
        item.type === 'function' && item.name === selectedFunctionName
    );

    if (func) {
      setSelectedFunction(func);
      // Initialize parameter values with empty strings
      const initialValues: Record<string, string> = {};
      func.inputs.forEach((input) => {
        initialValues[input.name || `param_${func.inputs.indexOf(input)}`] = '';
      });
      setParameterValues(initialValues);
      setValidationErrors({});
      setConversionErrors({});
    }
  }, [selectedFunctionName, selectedContractKey, ownedContracts]);

  /**
   * Handle transaction success
   */
  useEffect(() => {
    if (isTxSuccess && txHash) {
      addToast({
        type: 'success',
        title: 'Transaction Successful',
        description: 'Your transaction has been confirmed on the blockchain.',
        duration: 30000,
        action: {
          label: 'View Transaction',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${txHash}`
              : networkType === 'local'
              ? `http://localhost:8545`
              : `https://sepolia.etherscan.io/tx/${txHash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });
      setIsExecuting(false);
    }
  }, [isTxSuccess, txHash, networkType, addToast]);

  /**
   * Handle parameter value change
   */
  const handleParameterChange = (paramName: string, value: string) => {
    setParameterValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));

    // Clear any previous validation error for this parameter
    setValidationErrors((prev) => ({
      ...prev,
      [paramName]: false,
    }));

    // Clear any conversion error for this parameter
    setConversionErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[paramName];
      return newErrors;
    });
  };

  /**
   * Build function arguments from parameter values
   */
  const buildFunctionArgs = (): unknown[] | null => {
    if (!selectedFunction) return null;

    const args: unknown[] = [];
    const newValidationErrors: Record<string, boolean> = {};
    const newConversionErrors: Record<string, string> = {};
    let hasError = false;

    for (const input of selectedFunction.inputs) {
      const paramName = input.name || `param_${selectedFunction.inputs.indexOf(input)}`;
      const value = parameterValues[paramName] || '';

      // Check for empty required fields
      if (!value && value !== '0') {
        newValidationErrors[paramName] = true;
        hasError = true;
        continue;
      }

      try {
        // Handle numeric types (uint, int variants)
        if (isNumericType(input.type)) {
          // Expand any exponential notation
          const expanded = expandExpInt(value);
          args.push(BigInt(expanded));
        }
        // Handle boolean types
        else if (isBooleanType(input.type)) {
          args.push(convertBooleanParameter(value));
        }
        // Handle address types
        else if (input.type === 'address') {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            newConversionErrors[paramName] = 'Invalid address format';
            hasError = true;
            continue;
          }
          args.push(value as `0x${string}`);
        }
        // Handle bytes types
        else if (input.type.startsWith('bytes')) {
          if (!/^0x[a-fA-F0-9]*$/.test(value)) {
            newConversionErrors[paramName] = 'Invalid bytes format (must start with 0x)';
            hasError = true;
            continue;
          }
          args.push(value as `0x${string}`);
        }
        // Default: pass as string
        else {
          args.push(value);
        }
      } catch (error) {
        newConversionErrors[paramName] = error instanceof Error ? error.message : 'Conversion failed';
        hasError = true;
      }
    }

    setValidationErrors(newValidationErrors);
    setConversionErrors(newConversionErrors);

    if (hasError) return null;
    return args;
  };

  /**
   * Handle read call (view/pure functions)
   */
  const handleCallFunction = async () => {
    if (!selectedFunction) return;

    const args = buildFunctionArgs();
    if (!args) return;

    setIsCalling(true);

    try {
      const selectedContract = ownedContracts.find(
        (contract) => contract.addressKey === selectedContractKey
      );

      if (!selectedContract || !addresses) {
        throw new Error('Contract not found');
      }

      const contractAddress = addresses[selectedContract.addressKey];
      if (!contractAddress) {
        throw new Error('Contract address not available');
      }

      console.log(`[Admin Panel] Calling ${selectedFunction.name} with args:`, args);

      const result = await readContract(wagmiConfig, {
        address: contractAddress as `0x${string}`,
        abi: selectedContract.abi,
        functionName: selectedFunction.name,
        args: args as any,
      });

      console.log(`[Admin Panel] Result:`, result);

      // Format result for display
      let displayResult: string;
      if (typeof result === 'bigint') {
        displayResult = result.toString();
      } else if (typeof result === 'object') {
        displayResult = JSON.stringify(result, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v
        , 2);
      } else {
        displayResult = String(result);
      }

      addToast({
        type: 'success',
        title: 'Call Successful',
        description: `Result: ${displayResult}`,
        duration: 30000,
      });
    } catch (error) {
      console.error('[Admin Panel] Call error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Call Failed',
        description: errorMessage,
        duration: 16000,
      });
    } finally {
      setIsCalling(false);
    }
  };

  /**
   * Handle execute transaction (state-changing functions)
   */
  const handleExecuteFunction = async () => {
    if (!selectedFunction) return;

    const args = buildFunctionArgs();
    if (!args) return;

    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to execute transactions.',
        duration: 12000,
      });
      return;
    }

    setIsExecuting(true);

    try {
      const selectedContract = ownedContracts.find(
        (contract) => contract.addressKey === selectedContractKey
      );

      if (!selectedContract || !addresses) {
        throw new Error('Contract not found');
      }

      const contractAddress = addresses[selectedContract.addressKey];
      if (!contractAddress) {
        throw new Error('Contract address not available');
      }

      console.log(`[Admin Panel] Executing ${selectedFunction.name} with args:`, args);

      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: `Please confirm the transaction in your wallet.`,
        duration: 30000,
      });

      // Execute the transaction
      const hash = await writeContractAsync({
        address: contractAddress as `0x${string}`,
        abi: selectedContract.abi,
        functionName: selectedFunction.name,
        args: args as any,
      });

      // Remove pending toast
      removeToast(pendingToastId);

      // Show confirming toast
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
      });

      console.log(`[Admin Panel] Transaction submitted:`, hash);

      // Success will be handled by useEffect when transaction confirms

    } catch (error) {
      console.error('[Admin Panel] Execute error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Transaction Failed',
        description: errorMessage,
        duration: 16000,
      });
      setIsExecuting(false);
    }
  };

  /**
   * Handle BalancerPoolerV2 pool dispatch
   */
  const handleDispatcherPool = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to pool.',
      });
      return;
    }
    if (!balancerPoolerV2Address) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'BalancerPoolerV2 address missing.',
      });
      return;
    }
    // Hard-block submission of 0 — see story §4 MEV note. minBPT = 0 on a public
    // mempool invites a sandwich that can drain the entire single-sided deposit.
    if (parsedMinBpt === null || parsedMinBpt <= 0n) {
      addToast({
        type: 'error',
        title: 'Invalid minBPT',
        description: 'minBPT must be > 0 — submitting 0 invites MEV sandwich attacks that can drain the deposit.',
      });
      return;
    }
    setIsPoolExecuting(true);
    try {
      const hash = await writeContractAsync({
        address: balancerPoolerV2Address,
        abi: balancerPoolerV2Abi,
        functionName: 'pool',
        args: [parsedMinBpt],
      });
      setPoolTxHash(hash);
      addToast({
        type: 'info',
        title: 'Pool Submitted',
        description: 'Waiting for pool confirmation...',
      });
    } catch (err) {
      setIsPoolExecuting(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Pool Failed',
        description: msg,
      });
    }
  };

  /**
   * Handle Uniboost MultiPooler batch pool. Builds one PoolCall struct per
   * non-blank row and submits them all in a single MultiPooler.pool() tx.
   */
  const handleMultiPool = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to pool.',
      });
      return;
    }
    if (!multiPoolerAddress || !isMultiPoolerDeployed) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'MultiPooler is not deployed on this chain.',
      });
      return;
    }

    const calls: {
      uniboost: `0x${string}`;
      amountIn: bigint;
      minPairOut: bigint;
      minTargetOut: bigint;
      minLP: bigint;
    }[] = [];

    for (const { label, addressKey } of UNIBOOST_ROWS) {
      const row = multiPoolRows[label];
      // Blank rows are skipped, not submitted as zero-amount calls.
      if (!row.amountIn.trim()) continue;

      let amountIn: bigint;
      let minPairOut: bigint;
      let minTargetOut: bigint;
      let minLP: bigint;
      try {
        // Each field is parsed with its token's native decimals (primeToken can
        // be non-18, e.g. USDC = 6) so the raw on-chain value is exact.
        const d = uniboostAutofills[label].decimals;
        amountIn = parseUnits(row.amountIn.trim(), d.amountIn);
        minPairOut = parseUnits(row.minPairOut.trim() || '0', d.minPairOut);
        minTargetOut = parseUnits(row.minTargetOut.trim() || '0', d.minTargetOut);
        minLP = parseUnits(row.minLP.trim() || '0', d.minLP);
      } catch {
        addToast({
          type: 'error',
          title: 'Invalid Amount',
          description: `Row ${label} has a value that is not a valid number.`,
        });
        return;
      }

      if (amountIn <= 0n) continue;

      const uniboost = addresses?.[addressKey] as `0x${string}` | undefined;
      if (!uniboost || uniboost.toLowerCase() === ZERO_ADDRESS) {
        addToast({
          type: 'error',
          title: 'Dispatcher Not Available',
          description: `Uniboost ${label} address is missing on this chain.`,
        });
        return;
      }

      // Block zero slippage floors — same MEV sandwich rationale as minBPT.
      if (minPairOut <= 0n || minTargetOut <= 0n || minLP <= 0n) {
        addToast({
          type: 'error',
          title: 'Invalid Slippage Floor',
          description: `Row ${label}: minPairOut, minTargetOut and minLP must each be > 0 — 0 invites MEV sandwich attacks.`,
        });
        return;
      }

      calls.push({ uniboost, amountIn, minPairOut, minTargetOut, minLP });
    }

    if (calls.length === 0) {
      addToast({
        type: 'error',
        title: 'Nothing to Pool',
        description: 'Enter an amountIn (> 0) for at least one dispatcher.',
      });
      return;
    }

    setIsMultiPoolExecuting(true);
    try {
      const hash = await writeContractAsync({
        address: multiPoolerAddress,
        abi: multiPoolerAbi,
        functionName: 'pool',
        args: [calls],
      });
      setMultiPoolTxHash(hash);
      addToast({
        type: 'info',
        title: 'Pool Submitted',
        description: `Waiting for confirmation (${calls.length} dispatcher${calls.length > 1 ? 's' : ''})...`,
      });
    } catch (err) {
      setIsMultiPoolExecuting(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Pool Failed',
        description: msg,
      });
    }
  };

  /**
   * Handle NudgeRatchet delayed release.
   */
  const handleRelease = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to release.',
      });
      return;
    }
    if (!nudgeRatchetAddress || !isNudgeRatchetDeployed) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'NudgeRatchet is not deployed on this chain.',
      });
      return;
    }
    if (parsedReleaseAmount === null || parsedReleaseAmount <= 0n) {
      addToast({
        type: 'error',
        title: 'Invalid Amount',
        description: 'Release amount must be a number greater than 0.',
      });
      return;
    }

    setIsReleaseExecuting(true);
    try {
      const hash = await writeContractAsync({
        address: nudgeRatchetAddress,
        abi: nudgeRatchetDelayReleaseAbi,
        functionName: 'release',
        args: [parsedReleaseAmount],
      });
      setReleaseTxHash(hash);
      addToast({
        type: 'info',
        title: 'Release Submitted',
        description: 'Waiting for release confirmation...',
      });
    } catch (err) {
      setIsReleaseExecuting(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Release Failed',
        description: msg,
      });
    }
  };

  /**
   * Handle mint yield button click
   * Mints DOLA to the AutoDOLA underlying vault for testing
   */
  const handleMintYield = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to mint yield.',
      });
      return;
    }

    if (!addresses?.Dola || !addresses?.AutoDOLA) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: 'Contract addresses not loaded. Please try again.',
      });
      return;
    }

    setIsMinting(true);

    try {
      // Mint a fixed amount for testing (1000 DOLA = 1000 * 1e18 wei)
      const mintAmount = BigInt(1000) * BigInt(1e18);

      // Show pending toast
      const pendingToastId = addToast({
        type: 'info',
        title: 'Confirm Transaction',
        description: 'Please confirm the mint yield transaction in your wallet.',
        duration: 30000,
      });

 
      // Call the mint function on the DOLA token contract, minting to AutoDOLA vault
      const hash = await writeContractAsync({
        address: addresses.Dola as `0x${string}`,
        abi: mintableErc20Abi,
        functionName: 'mint',
        args: [addresses.AutoDOLA as `0x${string}`, mintAmount],
      });

      // Remove pending toast
      removeToast(pendingToastId);

      // Show confirming toast
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
        action: {
          label: 'View on Explorer',
          onClick: () => {
            const explorerUrl = networkType === 'mainnet'
              ? `https://etherscan.io/tx/${hash}`
              : networkType === 'local'
              ? `http://localhost:8545`
              : `https://sepolia.etherscan.io/tx/${hash}`;
            window.open(explorerUrl, '_blank');
          }
        }
      });

      // Wait for confirmation and refetch balances
      setTimeout(() => {
        addToast({
          type: 'success',
          title: 'Yield Minted Successfully',
          description: `Successfully minted 1000 DOLA to AutoDOLA vault!`,
          duration: 30000,
          action: {
            label: 'View Transaction',
            onClick: () => {
              const explorerUrl = networkType === 'mainnet'
                ? `https://etherscan.io/tx/${hash}`
                : networkType === 'local'
                ? `http://localhost:8545`
                : `https://sepolia.etherscan.io/tx/${hash}`;
              window.open(explorerUrl, '_blank');
            }
          }
        });
        // Refetch balance breakdown after minting yield
        refetchPrincipal();
        refetchTotalBalance();
        setIsMinting(false);
      }, 2000);

    } catch (error) {
      console.error('Mint yield failed:', error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addToast({
        type: 'error',
        title: 'Mint Yield Failed',
        description: errorMessage,
        duration: 16000,
      });
      setIsMinting(false);
    }
  };

  return (
    <div className="p-6">
      {/* Admin Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Admin Controls</h2>
        <p className="text-sm text-muted-foreground">
          Administrative functions for Phoenix Phase 2 protocol contracts
        </p>
      </div>

      {/* Owner Info Box */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">PhlimboEA Owner:</span>
            <span className="text-xs font-mono text-accent">
              {ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}` : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Your wallet:</span>
            <span className="text-xs font-mono text-accent">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Mint Yield Button - Hidden on mainnet (chainID 1) */}
      {showMintYieldButton && (
        <div className="mb-6">
          <ActionButton
            disabled={!isConnected || isMinting}
            onAction={handleMintYield}
            label={!isConnected ? "Connect Wallet" : "Mint Test Yield (1000 DOLA)"}
            variant="primary"
            isLoading={isMinting}
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Mints 1000 DOLA to AutoDOLA vault for testing yield accumulation
          </p>
        </div>
      )}

      {/* Yield Strategy Balance Breakdowns — split by client (StableMinter + StableStaker) with totals */}
      {yieldStrategyPanels.map((strategy) => {
        const totalPrincipal = strategy.clients.reduce((sum, c) => sum + c.principal, 0n);
        const totalYield = strategy.clients.reduce((sum, c) => sum + c.yield, 0n);
        const totalBalance = strategy.clients.reduce((sum, c) => sum + c.total, 0n);
        return (
          <div key={strategy.name} className="bg-card border border-border rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3">
              {strategy.name} Balance Breakdown
            </h3>
            <div className="space-y-3">
              {strategy.clients.map((client, idx) => (
                <div
                  key={client.label}
                  className={idx > 0 ? 'space-y-2 pt-3 border-t border-border' : 'space-y-2'}
                >
                  <div className="text-sm font-medium text-foreground">{client.label}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Principal:</span>
                    <span className="text-sm font-mono text-foreground">
                      {fmtAmount(client.principal, strategy.decimals)} {strategy.token}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Yield Generated:</span>
                    <span className="text-sm font-mono text-accent">
                      {fmtAmount(client.yield, strategy.decimals)} {strategy.token}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Subtotal:</span>
                    <span className="text-sm font-mono text-foreground">
                      {fmtAmount(client.total, strategy.decimals)} {strategy.token}
                    </span>
                  </div>
                </div>
              ))}
              <div className="space-y-1 pt-3 border-t-2 border-border">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Total Principal:</span>
                  <span className="text-sm font-mono text-foreground">
                    {fmtAmount(totalPrincipal, strategy.decimals)} {strategy.token}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">Total Yield:</span>
                  <span className="text-sm font-mono text-accent">
                    {fmtAmount(totalYield, strategy.decimals)} {strategy.token}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-foreground">Total Vault Balance:</span>
                  <span className="text-sm font-mono font-semibold text-foreground">
                    {fmtAmount(totalBalance, strategy.decimals)} {strategy.token}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={strategy.refetch}
                className="text-xs text-accent hover:text-accent/80 underline"
              >
                Refresh Balances
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              <strong>Note:</strong> Line items split {strategy.token} principal and yield by depositing
              client (StableMinter and StableStaker). Yield is vault balance growth beyond principal.
              PhUSD values are based on principal only, while the protocol utilizes yield separately.
              <span className="block mt-2">
                Values are fetched directly from {strategy.name} using the IYieldStrategy interface:
                principalOf(token, client) returns principal only, totalBalanceOf(token, client) returns
                principal + yield. Yield is calculated as: totalBalanceOf - principalOf.
              </span>
            </p>
          </div>
        );
      })}

      {/* Phlimbo Statistics Section */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Phlimbo Statistics
          </h3>
          {phlimboStatsLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">phUSDPerSecond:</span>
            <span className="text-sm font-mono text-foreground">
              {phUSDPerSecondDisplay} phUSD/sec
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">rewardPerSecond:</span>
            <span className="text-sm font-mono text-foreground">
              {rewardPerSecondDisplay} USDC/sec
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">depletionDuration:</span>
            <span className="text-sm font-mono text-foreground">
              {depletionDurationDisplay}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Staked:</span>
            <span className="text-sm font-mono text-foreground">
              {totalStakedDisplay} phUSD
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">USDC Balance (PhlimboEA):</span>
            <span className="text-sm font-mono text-foreground">
              {phlimboUsdcDisplay} USDC
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">YieldFunnel DOLA (Pending):</span>
            <span className="text-sm font-mono text-accent">
              {dolaYieldDisplay} DOLA
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">YieldFunnel USDC (Pending):</span>
            <span className="text-sm font-mono text-accent">
              {usdcFunnelYieldDisplay} USDC
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">YieldFunnel USDe (Pending):</span>
            <span className="text-sm font-mono text-accent">
              {usdeFunnelYieldDisplay} USDe
            </span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={refetchPhlimboStats}
            className="text-xs text-accent hover:text-accent/80 underline"
          >
            Refresh Phlimbo Stats
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          <strong>Note:</strong> phUSDPerSecond is the current phUSD emission rate.
          rewardPerSecond is the current USDC reward distribution rate (stored with 1e18 precision in contract), recalculated when users stake/unstake or USDC yield is injected.
          depletionDuration is the configurable duration over which rewards are linearly depleted.
          YieldFunnel DOLA/USDC/USDe show pending yield from each stable yield strategy.
        </p>
      </div>

      {/* Solvency Status Section */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Solvency Status
          </h3>
          {solvencyLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Actual Balance (USDC held):</span>
            <span className="text-sm font-mono text-foreground">
              {solvencyActualBalance} USDC
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Owed to Stakers:</span>
            <span className="text-sm font-mono text-foreground">
              {owedToStakersFormatted} USDC
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-border">
            <span className="text-sm font-medium text-foreground">Runway (Available for Distribution):</span>
            <span className={`text-sm font-mono font-semibold ${getRunwayHealthColor(runwayHealth)}`}>
              {runwayFormatted} USDC
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Runway Time Estimate:</span>
            <span className={`text-sm font-mono ${getRunwayHealthColor(runwayHealth)}`}>
              {runwayTimeFormatted}
            </span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border">
          <button
            onClick={refetchSolvency}
            className="text-xs text-accent hover:text-accent/80 underline"
          >
            Refresh Solvency Status
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
          <strong>Solvency Calculation:</strong> Projects the reward balance as if _updatePool() ran now.
          <span className="block mt-1">
            <strong>Owed to Stakers</strong> = Actual Balance - Projected Reward Balance (rewards already accrued but not claimed)
          </span>
          <span className="block mt-1">
            <strong>Runway</strong> = Projected Reward Balance (buffer available for future distribution)
          </span>
          <span className="block mt-2">
            <strong>Health Indicators:</strong>{' '}
            <span className="text-green-500">Green</span> = 14+ days runway,{' '}
            <span className="text-yellow-500">Yellow</span> = 3-14 days,{' '}
            <span className="text-red-500">Red</span> = less than 3 days
          </span>
        </p>
      </div>

      {/* Stable Staker Section */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Stable Staker
          </h3>
          {stableStakerLoading && (
            <span className="text-xs text-muted-foreground animate-pulse">Loading...</span>
          )}
        </div>
        {!isStableStakerDeployed ? (
          <p className="text-sm text-muted-foreground">
            StableStaker not deployed on this chain.
          </p>
        ) : (
          <>
            <div className="space-y-3">
              {stableStakerPools.map(({ label, decimals, stats }, idx) => (
                <div
                  key={label}
                  className={idx > 0 ? 'space-y-2 pt-3 border-t border-border' : 'space-y-2'}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        stats.underwater ? 'text-red-500' : 'text-green-500'
                      }`}
                    >
                      {stats.underwater ? 'UNDERWATER' : 'Solvent'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Set-Aside Buffer:</span>
                    <span className="text-sm font-mono text-foreground">
                      {typeof stats.buffer === 'bigint'
                        ? `${Number(formatUnits(stats.buffer, decimals)).toFixed(2)} ${label}`
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Staked:</span>
                    <span className="text-sm font-mono text-foreground">
                      {typeof stats.totalStaked === 'bigint'
                        ? `${Number(formatUnits(stats.totalStaked, decimals)).toFixed(2)} ${label}`
                        : '—'}
                    </span>
                  </div>
                  {stats.underwater && (
                    <p className="text-xs text-red-500">
                      Yield strategy is below par — withdrawals revert unless fully covered by
                      the set-aside buffer
                      {typeof stats.buffer === 'bigint'
                        ? ` (up to ${Number(formatUnits(stats.buffer, decimals)).toFixed(2)} ${label})`
                        : ''}.
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => stableStakerPools.forEach((p) => p.stats.refetch())}
                className="text-xs text-accent hover:text-accent/80 underline"
              >
                Refresh Stable Staker Stats
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              <strong>Note:</strong> Set-Aside Buffer is the token balance held directly on the
              StableStaker contract (token.balanceOf), kept outside the yield strategy so
              withdrawals can still be paid while the strategy is underwater. Total Staked is
              poolInfo.totalStaked. Status reflects withdrawDisabled(token): a pool evaluates as
              underwater when its strategy's totalBalanceOf is less than its principalOf, in
              which case a normal withdraw reverts unless the full amount fits in the buffer.
            </p>
          </>
        )}
      </div>

      {/* NFT Staker — Runway Panels (Ratchet on top, Liquid Sky Phoenix below) */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <NftStakerRunwayPanel
          title="Ratchet NFT Staker — Runway"
          stakerAddress={ratchetNftStakerAddress}
          phUsdAddress={phUsdAddress}
          stakerLabel="RatchetNFTStaker"
          idPrefix="ratchet-nft-staker"
        />

        <div className="my-6 border-t border-border" />

        <NftStakerRunwayPanel
          title="LSP NFT Staker — Runway"
          stakerAddress={nftStakerAddress}
          phUsdAddress={phUsdAddress}
          stakerLabel="NFTStaker"
          idPrefix="lsp-nft-staker"
        />
      </div>

      {/* BalancerPoolerV2 — Pending Dispatch Panel */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            BalancerPoolerV2 — Pending Dispatch
          </h3>
        </div>
        {!isBalancerPoolerV2Deployed ? (
          <p className="text-sm text-muted-foreground">
            BalancerPoolerV2 not deployed on this chain.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">sUSDS Balance (dispatcher):</span>
                <span className="text-sm font-mono text-foreground">
                  {typeof dispatcherSusdsBalance === 'bigint'
                    ? `${(Number(dispatcherSusdsBalance) / 1e18).toFixed(2)} sUSDS`
                    : '0.00 sUSDS'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">BPT held by dispatcher:</span>
                <span className="text-sm font-mono text-foreground">
                  {typeof dispatcherBptBalance === 'bigint'
                    ? `${(Number(dispatcherBptBalance) / 1e18).toFixed(2)} BPT`
                    : '0.00 BPT'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">sUSDS set aside for Nudge:</span>
                <span className="text-sm font-mono text-foreground">
                  {setAsideSusds === null || typeof batchDonationSize !== 'bigint'
                    ? '—'
                    : batchDonationSize === 0n
                      ? '0.00 sUSDS (donations disabled)'
                      : `${(Number(setAsideSusds) / 1e18).toFixed(2)} sUSDS (${batchDonationSize.toString()}%)`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estimated BPT out (idealBPT):</span>
                <span className="text-sm font-mono text-foreground">
                  {idealBpt !== null
                    ? `${formatUnits(idealBpt, 18)} BPT`
                    : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Authorised pooler:</span>
                <span className={
                  'text-sm font-mono ' + (isAuthorisedPooler ? 'text-green-500' : 'text-red-500')
                }>
                  {isAuthorisedPooler ? 'yes' : 'no'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Paused:</span>
                <span className={
                  'text-sm font-mono ' + (dispatcherPaused ? 'text-red-500' : 'text-foreground')
                }>
                  {dispatcherPaused ? 'yes' : 'no'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <label
                htmlFor="dispatcher-min-bpt"
                className="block text-sm font-medium text-foreground mb-2"
              >
                minBPT (slippage floor — defaults to 1% below idealBPT)
              </label>
              <input
                id="dispatcher-min-bpt"
                type="text"
                inputMode="decimal"
                value={minBptInput}
                onChange={(e) => {
                  setMinBptInput(e.target.value);
                  setUserEditedMinBpt(true);
                }}
                placeholder={idealBpt === null ? 'No idealBPT — enter manually' : 'BPT amount'}
                disabled={isPoolExecuting}
                className={
                  'w-full px-3 py-2 bg-background border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ' +
                  ((parsedMinBpt === null || parsedMinBpt <= 0n) && minBptInput !== ''
                    ? 'border-red-500'
                    : 'border-border')
                }
              />
              {idealBpt === null && idealBptError && (
                <div className="mt-1 space-y-1">
                  <p className="text-xs text-red-500">
                    Could not estimate BPT — refresh, or enter a value manually.
                  </p>
                  <pre className="text-[10px] text-red-400 whitespace-pre-wrap break-all bg-red-950/30 border border-red-900/50 rounded p-2 font-mono">
                    {(idealBptError as { shortMessage?: string }).shortMessage ?? idealBptError.message}
                    {(idealBptError as { metaMessages?: string[] }).metaMessages?.length
                      ? '\n\n' + (idealBptError as { metaMessages?: string[] }).metaMessages!.join('\n')
                      : ''}
                    {(idealBptError as { cause?: { shortMessage?: string; message?: string } }).cause
                      ? '\n\nCause: ' + ((idealBptError as { cause?: { shortMessage?: string; message?: string } }).cause!.shortMessage
                          ?? (idealBptError as { cause?: { shortMessage?: string; message?: string } }).cause!.message
                          ?? '')
                      : ''}
                  </pre>
                </div>
              )}
              {minBptInput !== '' && (parsedMinBpt === null || parsedMinBpt <= 0n) && (
                <p className="text-xs text-red-500 mt-1">
                  minBPT must be &gt; 0 — submitting 0 invites MEV sandwich attacks that can drain the deposit.
                </p>
              )}

              {(() => {
                const susdsZero = typeof dispatcherSusdsBalance !== 'bigint' || dispatcherSusdsBalance === 0n;
                const minBptInvalid = parsedMinBpt === null || parsedMinBpt <= 0n;
                let tooltip: string | undefined;
                if (susdsZero) tooltip = 'Nothing to pool';
                else if (dispatcherPaused) tooltip = 'Dispatcher is paused';
                else if (!isAuthorisedPooler) tooltip = 'Wallet not authorised. Contract owner must call setAuthorizedPooler(<your-address>, true).';
                else if (minBptInvalid) tooltip = 'minBPT must be > 0 (MEV sandwich risk)';

                const disabled = susdsZero
                  || !!dispatcherPaused
                  || !isAuthorisedPooler
                  || minBptInvalid
                  || isPoolExecuting;

                return (
                  <div className="mt-3" title={tooltip}>
                    <ActionButton
                      disabled={disabled}
                      onAction={handleDispatcherPool}
                      label={isPoolExecuting ? 'Pooling…' : 'Pool All sUSDS'}
                      variant="primary"
                      isLoading={isPoolExecuting}
                    />
                  </div>
                );
              })()}
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={refetchDispatcherStats}
                className="text-xs text-accent hover:text-accent/80 underline"
              >
                Refresh Dispatcher Stats
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              <strong>Note:</strong> Pool All single-side-deposits the dispatcher's sUSDS
              balance into the sUSDS/phUSD Balancer V3 pool, after first setting aside
              <code> batchDonationSize</code>% of the balance and swapping it to USDC for the
              BatchMinter / Nudge accumulator. <code>minBPT</code> auto-populates to 1% below
              <code> getIdealBPT()</code> scaled by the pooled fraction
              <code> (balance − setAside) / balance</code> — <code>getIdealBPT()</code> simulates
              against the full balance, so the raw value overshoots actual minted BPT when
              donations are enabled. <code>minBPT</code> must be &gt; 0; when
              <code> batchDonationSize == 0</code> the donation phase is skipped entirely. The
              connected wallet must have been authorised by the contract owner via
              <code> setAuthorizedPooler</code>.
            </p>
          </>
        )}
      </div>

      {/* Uniboost MultiPooler Panel */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Uniboost MultiPooler
          </h3>
          <span className={
            'text-xs font-mono ' + (isAuthorisedMultiPooler ? 'text-green-500' : 'text-red-500')
          }>
            {isAuthorisedMultiPooler ? 'authorised' : 'not authorised'}
          </span>
        </div>
        {!isMultiPoolerDeployed ? (
          <p className="text-sm text-muted-foreground">
            MultiPooler not deployed on this chain.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-2 font-medium">Dispatcher</th>
                    <th className="py-2 px-2 font-medium">amountIn</th>
                    <th className="py-2 px-2 font-medium">minPairOut</th>
                    <th className="py-2 px-2 font-medium">minTargetOut</th>
                    <th className="py-2 pl-2 font-medium">minLP</th>
                  </tr>
                </thead>
                <tbody>
                  {UNIBOOST_ROWS.map(({ label, addressKey }) => {
                    const uniboost = addresses?.[addressKey] as string | undefined;
                    const uniboostMissing = !uniboost || uniboost.toLowerCase() === ZERO_ADDRESS;
                    const row = multiPoolRows[label];
                    // Manual edits mark the row so the auto-fill stops clobbering it.
                    const setField = (field: keyof PoolRowInput, value: string) => {
                      setMultiPoolRows((prev) => ({
                        ...prev,
                        [label]: { ...prev[label], [field]: value },
                      }));
                      setUserEditedRows((prev) => (prev[label] ? prev : { ...prev, [label]: true }));
                    };
                    const isEdited = userEditedRows[label];
                    const hasSuggestion = !!uniboostAutofills[label].suggestion;
                    const resetToAuto = () => {
                      setUserEditedRows((prev) => ({ ...prev, [label]: false }));
                      uniboostAutofills[label].refetch();
                    };
                    const cellClass =
                      'w-full px-2 py-1 bg-background border border-border rounded text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed';
                    return (
                      <tr key={label} className="border-b border-border last:border-b-0">
                        <td className="py-2 pr-2 align-middle">
                          <div className="font-mono text-foreground">{label}</div>
                          {uniboostMissing && (
                            <div className="text-[10px] text-red-500">address missing</div>
                          )}
                          {!uniboostMissing && isEdited && (
                            <button
                              onClick={resetToAuto}
                              className="text-[10px] text-accent hover:text-accent/80 underline"
                            >
                              ↻ auto
                            </button>
                          )}
                          {!uniboostMissing && !isEdited && hasSuggestion && (
                            <div className="text-[10px] text-green-500">auto · 1%</div>
                          )}
                        </td>
                        {(['amountIn', 'minPairOut', 'minTargetOut', 'minLP'] as const).map((field) => (
                          <td key={field} className="py-2 px-2 align-middle">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={row[field]}
                              onChange={(e) => setField(field, e.target.value)}
                              placeholder="0.0"
                              disabled={isMultiPoolExecuting || uniboostMissing}
                              className={cellClass}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {multiPoolValidation.anyNumberInvalid && (
              <p className="text-xs text-red-500 mt-2">
                One or more fields is not a valid number.
              </p>
            )}
            {multiPoolValidation.anyMinInvalid && (
              <p className="text-xs text-red-500 mt-2">
                Each populated row must set minPairOut, minTargetOut and minLP &gt; 0 — 0 invites MEV sandwich attacks.
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-border">
              {(() => {
                const { validCount, anyMinInvalid, anyNumberInvalid } = multiPoolValidation;
                let tooltip: string | undefined;
                if (!isAuthorisedMultiPooler) tooltip = 'Wallet not authorised. MultiPooler owner must call setPooler(<your-address>).';
                else if (validCount === 0) tooltip = 'Enter an amountIn (> 0) for at least one dispatcher';
                else if (anyNumberInvalid) tooltip = 'One or more fields is not a valid number';
                else if (anyMinInvalid) tooltip = 'Slippage floors must be > 0 (MEV sandwich risk)';

                const disabled = !isAuthorisedMultiPooler
                  || validCount === 0
                  || anyNumberInvalid
                  || anyMinInvalid
                  || isMultiPoolExecuting;

                return (
                  <div title={tooltip}>
                    <ActionButton
                      disabled={disabled}
                      onAction={handleMultiPool}
                      label={isMultiPoolExecuting ? 'Pooling…' : 'Pool'}
                      variant="primary"
                      isLoading={isMultiPoolExecuting}
                    />
                  </div>
                );
              })()}
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => {
                  refetchMultiPoolerPooler();
                  refetchMultiPoolerOwner();
                  eyeAutofill.refetch();
                  scxAutofill.refetch();
                  flxAutofill.refetch();
                }}
                className="text-xs text-accent hover:text-accent/80 underline"
              >
                Refresh
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              <strong>Note:</strong> Each row is one <code>MultiPooler.PoolCall</code> for a Uniboost
              dispatcher (buy-and-pool into its UniV2 pool). Populated rows are batched into a single
              <code> pool()</code> transaction; blank rows (no <code>amountIn</code>) are skipped. Each
              value is entered in its token's native units — <code>amountIn</code> in the prime token
              (e.g. USDC, 6 decimals), <code>minPairOut</code>/<code>minTargetOut</code> in the pair/target
              tokens, <code>minLP</code> in LP tokens (18 decimals). <code>minPairOut</code>,
              <code> minTargetOut</code> and <code>minLP</code> are slippage floors and must be &gt; 0.
              Rows tagged <span className="text-green-500">auto · 1%</span> are auto-filled to 1%-safe
              MEV floors, derived off-chain from each dispatcher's prime balance and its UniV2
              quotes/reserves (the two swaps + LP mint of <code>Uniboost.pool()</code>); the Uniboost
              dispatcher has no on-chain quote, so these are computed against the worst-case output of
              each leg. Editing any field switches that row to manual — use <code>↻ auto</code> to
              restore. The connected wallet must be the MultiPooler's authorised pooler
              (<code> setPooler</code>) or its owner.
            </p>
          </>
        )}
      </div>

      {/* NudgeRatchet Release Panel */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            NudgeRatchet — Release
          </h3>
          <span className={
            'text-xs font-mono ' + (isAuthorisedReleaser ? 'text-green-500' : 'text-red-500')
          }>
            {isAuthorisedReleaser ? 'authorised' : 'not authorised'}
          </span>
        </div>
        {!isNudgeRatchetDeployed ? (
          <p className="text-sm text-muted-foreground">
            NudgeRatchet not deployed on this chain.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending USDC:</span>
                {typeof nudgeRatchetPendingUsdc === 'bigint' && nudgeRatchetPendingUsdc > 0n ? (
                  <button
                    type="button"
                    onClick={() => setReleaseAmountInput(formatUnits(nudgeRatchetPendingUsdc, 6))}
                    disabled={isReleaseExecuting}
                    title="Release limit — click to fill the amount with the full pending balance"
                    className="text-sm font-mono text-accent hover:text-accent/80 underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    {Number(formatUnits(nudgeRatchetPendingUsdc, 6)).toFixed(2)} USDC
                  </button>
                ) : (
                  <span className="text-sm font-mono text-foreground">
                    {typeof nudgeRatchetPendingUsdc === 'bigint' ? '0.00 USDC' : '—'}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Paused:</span>
                <span className={
                  'text-sm font-mono ' + (nudgeRatchetPaused ? 'text-red-500' : 'text-foreground')
                }>
                  {nudgeRatchetPaused ? 'yes' : 'no'}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <label
                htmlFor="nudge-release-amount"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Release amount
              </label>
              <input
                id="nudge-release-amount"
                type="text"
                inputMode="decimal"
                value={releaseAmountInput}
                onChange={(e) => setReleaseAmountInput(e.target.value)}
                placeholder="Amount to release"
                disabled={isReleaseExecuting}
                className={
                  'w-full px-3 py-2 bg-background border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ' +
                  ((parsedReleaseAmount === null || parsedReleaseAmount <= 0n) && releaseAmountInput !== ''
                    ? 'border-red-500'
                    : 'border-border')
                }
              />
              {releaseAmountInput !== '' && (parsedReleaseAmount === null || parsedReleaseAmount <= 0n) && (
                <p className="text-xs text-red-500 mt-1">
                  Amount must be a number greater than 0.
                </p>
              )}

              {(() => {
                const amountInvalid = parsedReleaseAmount === null || parsedReleaseAmount <= 0n;
                let tooltip: string | undefined;
                if (nudgeRatchetPaused) tooltip = 'NudgeRatchet is paused';
                else if (!isAuthorisedReleaser) tooltip = 'Wallet not authorised. Owner must call setReleaser(<your-address>, true).';
                else if (amountInvalid) tooltip = 'Enter an amount > 0';

                const disabled = !!nudgeRatchetPaused
                  || !isAuthorisedReleaser
                  || amountInvalid
                  || isReleaseExecuting;

                return (
                  <div className="mt-3" title={tooltip}>
                    <ActionButton
                      disabled={disabled}
                      onAction={handleRelease}
                      label={isReleaseExecuting ? 'Releasing…' : 'Release'}
                      variant="primary"
                      isLoading={isReleaseExecuting}
                    />
                  </div>
                );
              })()}
            </div>

            <div className="mt-3 pt-3 border-t border-border">
              <button
                onClick={() => {
                  refetchNudgeRatchetOwner();
                  refetchNudgeRatchetIsReleaser();
                  refetchNudgeRatchetPaused();
                  refetchNudgeRatchetPendingUsdc();
                }}
                className="text-xs text-accent hover:text-accent/80 underline"
              >
                Refresh Status
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
              <strong>Note:</strong> Calls <code>release(amount)</code> on the NudgeRatchetDelayRelease
              dispatcher, forwarding held USDC to the batchMinter. The amount is entered as a decimal
              number of USDC (6 decimals) and cannot exceed the pending balance shown above. The
              connected wallet must be an authorised releaser (<code>setReleaser</code>) or the owner,
              and the contract must not be paused.
            </p>
          </>
        )}
      </div>

      {/* Selected Contract Address Display */}
      {selectedContractKey && addresses && (
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Selected Contract Address:</span>
            <span className="text-xs font-mono text-accent">
              {(() => {
                const selectedContract = ownedContracts.find(c => c.addressKey === selectedContractKey);
                if (!selectedContract) return 'N/A';
                const address = addresses[selectedContract.addressKey];
                return typeof address === 'string' && address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : 'N/A';
              })()}
            </span>
          </div>
        </div>
      )}

      {/* Contract and Function Dropdowns */}
      <div className="flex gap-4 mb-6">
        {/* Contracts Dropdown */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Contract
          </label>
          <select
            value={selectedContractKey}
            onChange={(e) => setSelectedContractKey(e.target.value)}
            disabled={isLoadingOwnership || ownedContracts.length === 0}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">
              {isLoadingOwnership
                ? 'Loading...'
                : ownedContracts.length === 0
                ? 'No owned contracts found'
                : 'Select a contract'}
            </option>
            {ownedContracts.map((contract) => (
              <option key={contract.addressKey} value={contract.addressKey}>
                {contract.name}
              </option>
            ))}
          </select>
        </div>

        {/* Functions Dropdown */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Function
          </label>
          <select
            value={selectedFunctionName}
            onChange={(e) => setSelectedFunctionName(e.target.value)}
            disabled={!selectedContractKey || availableFunctions.length === 0}
            className="w-full px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">
              {!selectedContractKey
                ? 'Select a contract first'
                : 'Select a function'}
            </option>
            {availableFunctions.map((funcName) => (
              <option key={funcName} value={funcName}>
                {funcName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Function Parameters */}
      {selectedFunction && selectedFunction.inputs.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Parameters for {selectedFunction.name}
          </h3>
          <div className="space-y-4">
            {selectedFunction.inputs.map((input, index) => {
              const paramName = input.name || `param_${index}`;
              return (
                <div key={paramName}>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {paramName} ({input.type})
                  </label>
                  <input
                    type="text"
                    value={parameterValues[paramName] || ''}
                    onChange={(e) => handleParameterChange(paramName, e.target.value)}
                    placeholder={`Enter ${input.type}`}
                    className={`w-full px-3 py-2 bg-background border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                      validationErrors[paramName] || conversionErrors[paramName]
                        ? 'border-red-500'
                        : 'border-border'
                    }`}
                  />
                  {validationErrors[paramName] && (
                    <p className="text-xs text-red-500 mt-1">This field is required</p>
                  )}
                  {conversionErrors[paramName] && (
                    <p className="text-xs text-red-500 mt-1">{conversionErrors[paramName]}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {selectedFunction && (
        <div className="flex gap-4">
          {/* Call button for view/pure functions */}
          {(selectedFunction.stateMutability === 'view' || selectedFunction.stateMutability === 'pure') && (
            <ActionButton
              disabled={isCalling}
              onAction={handleCallFunction}
              label="Call"
              variant="primary"
              isLoading={isCalling}
            />
          )}

          {/* Execute button for state-changing functions */}
          {selectedFunction.stateMutability !== 'view' && selectedFunction.stateMutability !== 'pure' && (
            <ActionButton
              disabled={isExecuting || isConfirming}
              onAction={handleExecuteFunction}
              label="Execute"
              variant="primary"
              isLoading={isExecuting || isConfirming}
            />
          )}
        </div>
      )}

      {/* Admin Notice */}
      <div className="mt-6 p-4 bg-card border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Phase 2 Contracts:</strong> This admin panel manages the new Phoenix Phase 2 protocol contracts
          including PhUSD, Pauser, YieldStrategies (Dola, USDT, USDS), PhusdStableMinter, and PhlimboEA.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          <strong>Dynamic ABI Loading:</strong> ABIs are statically imported from <code className="px-1 py-0.5 bg-background rounded">@behodler/phase2-wagmi-hooks</code>.
        </p>
      </div>
    </div>
  );
}
