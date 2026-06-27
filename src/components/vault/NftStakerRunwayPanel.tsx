import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, parseUnits } from 'viem';
import {
  nftStakerAbi,
  nftMinterV2Abi,
  balancerPoolerMintDebtHookAbi,
} from '@behodler/phase2-wagmi-hooks';
import { useToast } from '../ui/ToastProvider';
import ActionButton from '../ui/ActionButton';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Constants used to mirror NFTStaker._recomputeSchedule math client-side
// when computing the Minimum Runway stat.
const SECONDS_PER_YEAR = 365n * 86400n;
const APY_PRECISION = 10n ** 18n;
const GROWTH_PRECISION = 10n ** 14n;

interface NftStakerRunwayPanelProps {
  /** Display title for the panel header, e.g. "Ratchet NFT Staker — Runway". */
  title: string;
  /** The NFTStaker contract address (e.g. NFTStaker or RatchetNFTStaker). */
  stakerAddress: `0x${string}` | undefined;
  /** The phUSD reward-token address. */
  phUsdAddress: `0x${string}` | undefined;
  /** Short contract label used in toast/warning copy, e.g. "RatchetNFTStaker". */
  stakerLabel: string;
  /** Prefix to keep input ids unique when multiple panels are rendered. */
  idPrefix: string;
}

/**
 * Self-contained admin Runway panel for an NFTStaker. Renders runway stats and a
 * phUSD top-up flow (approve + topUp). Parameterized by staker address so the
 * same panel can drive both the Liquid Sky Phoenix and Ratchet NFT stakers.
 */
export default function NftStakerRunwayPanel({
  title,
  stakerAddress,
  phUsdAddress,
  stakerLabel,
  idPrefix,
}: NftStakerRunwayPanelProps) {
  const { isConnected, address: walletAddress } = useAccount();
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const isNftStakerDeployed = !!stakerAddress &&
    stakerAddress.toLowerCase() !== ZERO_ADDRESS;

  const { data: nftStakerRunwaySeconds, refetch: refetchRunwaySeconds } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'runwaySeconds',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerRewardRate, refetch: refetchRewardRate } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'currentRewardRate',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerTotalBudget, refetch: refetchTotalBudget } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'totalBudget',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerTotalDebt, refetch: refetchTotalDebt } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'totalDebt',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerTargetApy, refetch: refetchTargetApy } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'targetAPY',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerTotalStaked, refetch: refetchTotalStakedRaw } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'totalStaked',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerOwner } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'owner',
    query: { enabled: isNftStakerDeployed },
  });

  // Reads for the Minimum Runway stat — the runway that would hold if the
  // entire `totalSupply(stakedId)` of the NFT were staked under current
  // conditions. We mirror NFTStaker._recomputeSchedule's `latestPrice`
  // derivation client-side because the contract does not expose it as a view.
  const { data: nftStakerStakedId } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'stakedId',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerNftMinter } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'nftMinter',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerDispatcherIndex } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'dispatcherIndex',
    query: { enabled: isNftStakerDeployed },
  });

  const { data: nftStakerDispatcherHook } = useReadContract({
    address: stakerAddress,
    abi: nftStakerAbi,
    functionName: 'dispatcherHook',
    query: { enabled: isNftStakerDeployed },
  });

  const isNftMinterValid = typeof nftStakerNftMinter === 'string'
    && (nftStakerNftMinter as string).toLowerCase() !== ZERO_ADDRESS;

  const { data: nftMinterConfig, refetch: refetchNftMinterConfig } = useReadContract({
    address: nftStakerNftMinter as `0x${string}` | undefined,
    abi: nftMinterV2Abi,
    functionName: 'configs',
    args: typeof nftStakerDispatcherIndex === 'bigint'
      ? [nftStakerDispatcherIndex]
      : undefined,
    query: {
      enabled: isNftStakerDeployed
        && isNftMinterValid
        && typeof nftStakerDispatcherIndex === 'bigint',
    },
  });

  const { data: nftStakerMaxSupply, refetch: refetchMaxSupply } = useReadContract({
    address: nftStakerNftMinter as `0x${string}` | undefined,
    abi: nftMinterV2Abi,
    functionName: 'totalSupply',
    args: typeof nftStakerStakedId === 'bigint'
      ? [nftStakerStakedId]
      : undefined,
    query: {
      enabled: isNftStakerDeployed
        && isNftMinterValid
        && typeof nftStakerStakedId === 'bigint',
    },
  });

  const { data: nftStakerPhUsdBalance, refetch: refetchNftStakerPhUsdBalance } = useReadContract({
    address: phUsdAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: stakerAddress ? [stakerAddress] : undefined,
    query: { enabled: isNftStakerDeployed && !!phUsdAddress },
  });

  const isDispatcherHookValid = typeof nftStakerDispatcherHook === 'string'
    && (nftStakerDispatcherHook as string).toLowerCase() !== ZERO_ADDRESS;

  // Mirror NFTStaker's own `runwaySeconds()` behaviour: only add mint debt when
  // dispatcherHook is non-zero. When zero, we treat mintDebt as 0n and skip the
  // read entirely.
  const { data: nftStakerMintDebt, refetch: refetchMintDebt } = useReadContract({
    address: nftStakerDispatcherHook as `0x${string}` | undefined,
    abi: balancerPoolerMintDebtHookAbi,
    functionName: 'mintDebt',
    query: { enabled: isNftStakerDeployed && isDispatcherHookValid },
  });

  const [topUpAmountInput, setTopUpAmountInput] = useState<string>('');
  const [topUpInputError, setTopUpInputError] = useState<string | null>(null);

  // Parse the user input into a bigint amount, surfacing parse errors inline.
  const parsedTopUpAmount = useMemo<bigint | null>(() => {
    const trimmed = topUpAmountInput.trim();
    if (!trimmed) return null;
    try {
      const value = parseUnits(trimmed, 18);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [topUpAmountInput]);

  const { data: nftStakerPhUsdAllowance, refetch: refetchNftStakerAllowance } = useReadContract({
    address: phUsdAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: walletAddress && stakerAddress
      ? [walletAddress as `0x${string}`, stakerAddress]
      : undefined,
    query: { enabled: isNftStakerDeployed && !!phUsdAddress && !!walletAddress },
  });

  const isNftStakerOwner = useMemo(() => {
    if (!walletAddress || !nftStakerOwner) return false;
    return (nftStakerOwner as string).toLowerCase() === walletAddress.toLowerCase();
  }, [walletAddress, nftStakerOwner]);

  const [topUpTxHash, setTopUpTxHash] = useState<`0x${string}` | undefined>();
  const [topUpApproveTxHash, setTopUpApproveTxHash] = useState<`0x${string}` | undefined>();
  const [isTopUpApproving, setIsTopUpApproving] = useState(false);
  const [isTopUpExecuting, setIsTopUpExecuting] = useState(false);

  const { isSuccess: topUpApproveConfirmed } = useWaitForTransactionReceipt({
    hash: topUpApproveTxHash,
    query: { enabled: !!topUpApproveTxHash },
  });
  const { isSuccess: topUpConfirmed } = useWaitForTransactionReceipt({
    hash: topUpTxHash,
    query: { enabled: !!topUpTxHash },
  });

  const refetchNftStakerStats = () => {
    refetchRunwaySeconds();
    refetchRewardRate();
    refetchTotalBudget();
    refetchTotalDebt();
    refetchTargetApy();
    refetchTotalStakedRaw();
    refetchNftStakerAllowance();
    refetchMaxSupply();
    refetchNftStakerPhUsdBalance();
    refetchNftMinterConfig();
    refetchMintDebt();
  };

  // Compute Minimum Runway: what the runway would be if `totalSupply(stakedId)`
  // were staked. Mirrors NFTStaker._recomputeSchedule math (NFTStaker.sol
  // lines 385-425) plus runwaySeconds() (line ~616), with the two user-spec
  // overrides applied before the formula path.
  const minimumRunwayDisplay = useMemo<string>(() => {
    // Edge case 1: NFT supply is zero (or unknown) → dash.
    if (typeof nftStakerMaxSupply !== 'bigint') return '—';
    if (nftStakerMaxSupply === 0n) return '—';

    // Edge case 2 (user spec): no phUSD in the staking contract → display "0".
    // Worst-case framing: the floor we can guarantee right now is zero.
    if (typeof nftStakerPhUsdBalance !== 'bigint') return '—';
    if (nftStakerPhUsdBalance === 0n) return '0';

    if (!nftMinterConfig) return '—';
    // wagmi decodes the configs() output as a positional tuple
    // [dispatcher, price, growthBasisPoints, disabled].
    const price = nftMinterConfig[1];
    const growthBp = nftMinterConfig[2];

    if (typeof price !== 'bigint' || price === 0n) return '0.00 days';
    if (typeof growthBp !== 'bigint') return '—';

    // Mirror NFTStaker._recomputeSchedule latestPrice derivation:
    //   if (growthBp == 0) latestPrice = price;
    //   else latestPrice = price.mulDiv(1e18, 1e18 + growthBp * 1e14);
    let latestPrice: bigint;
    if (growthBp === 0n) {
      latestPrice = price;
    } else {
      const r = APY_PRECISION + growthBp * GROWTH_PRECISION;
      latestPrice = (price * APY_PRECISION) / r;
    }

    if (latestPrice === 0n) return '0.00 days';

    if (typeof nftStakerTargetApy !== 'bigint' || nftStakerTargetApy === 0n) {
      return '0.00 days';
    }

    const sMax = nftStakerMaxSupply * latestPrice;
    const fMax = (sMax * nftStakerTargetApy) / APY_PRECISION;
    if (fMax === 0n) return '0.00 days';
    const rMax = fMax / SECONDS_PER_YEAR;
    if (rMax === 0n) return '0.00 days';

    const mintDebt = typeof nftStakerMintDebt === 'bigint' ? nftStakerMintDebt : 0n;
    const v = nftStakerPhUsdBalance + mintDebt;
    const seconds = v / rMax;
    const days = Number(seconds) / 86400;
    return `${days.toFixed(2)} days`;
  }, [
    nftStakerMaxSupply,
    nftStakerPhUsdBalance,
    nftMinterConfig,
    nftStakerTargetApy,
    nftStakerMintDebt,
  ]);

  useEffect(() => {
    if (topUpApproveConfirmed && topUpApproveTxHash) {
      setIsTopUpApproving(false);
      setTopUpApproveTxHash(undefined);
      refetchNftStakerAllowance();
      addToast({
        type: 'success',
        title: 'Approval Confirmed',
        description: `phUSD allowance set for ${stakerLabel}. You can now top up.`,
      });
    }
    // refetchNftStakerAllowance is stable from wagmi; addToast pulled from context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topUpApproveConfirmed, topUpApproveTxHash]);

  useEffect(() => {
    if (topUpConfirmed && topUpTxHash) {
      setIsTopUpExecuting(false);
      setTopUpTxHash(undefined);
      refetchNftStakerStats();
      addToast({
        type: 'success',
        title: 'Top Up Confirmed',
        description: `phUSD has been transferred to ${stakerLabel}. Runway updated.`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topUpConfirmed, topUpTxHash]);

  const handleNftStakerApprove = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to approve.',
      });
      return;
    }
    if (!phUsdAddress || !stakerAddress) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: `phUSD or ${stakerLabel} address missing.`,
      });
      return;
    }
    if (parsedTopUpAmount === null) {
      setTopUpInputError('Enter a valid phUSD amount > 0.');
      return;
    }
    setTopUpInputError(null);
    setIsTopUpApproving(true);
    try {
      const hash = await writeContractAsync({
        address: phUsdAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [stakerAddress, parsedTopUpAmount],
      });
      setTopUpApproveTxHash(hash);
      addToast({
        type: 'info',
        title: 'Approval Submitted',
        description: 'Waiting for approval confirmation...',
      });
    } catch (err) {
      setIsTopUpApproving(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Approval Failed',
        description: msg,
      });
    }
  };

  const handleNftStakerTopUp = async () => {
    if (!isConnected || !walletAddress) {
      addToast({
        type: 'error',
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to top up.',
      });
      return;
    }
    if (!stakerAddress) {
      addToast({
        type: 'error',
        title: 'Contract Not Available',
        description: `${stakerLabel} address missing.`,
      });
      return;
    }
    if (parsedTopUpAmount === null) {
      setTopUpInputError('Enter a valid phUSD amount > 0.');
      return;
    }
    setTopUpInputError(null);
    setIsTopUpExecuting(true);
    try {
      const hash = await writeContractAsync({
        address: stakerAddress,
        abi: nftStakerAbi,
        functionName: 'topUp',
        args: [parsedTopUpAmount],
      });
      setTopUpTxHash(hash);
      addToast({
        type: 'info',
        title: 'Top Up Submitted',
        description: 'Waiting for top-up confirmation...',
      });
    } catch (err) {
      setIsTopUpExecuting(false);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast({
        type: 'error',
        title: 'Top Up Failed',
        description: msg,
      });
    }
  };

  const inputId = `${idPrefix}-topup-amount`;

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        {isNftStakerDeployed && nftStakerOwner && (
          <span className="text-xs font-mono text-muted-foreground">
            owner: {(nftStakerOwner as string).slice(0, 6)}…{(nftStakerOwner as string).slice(-4)}
          </span>
        )}
      </div>
      {!isNftStakerDeployed ? (
        <p className="text-sm text-muted-foreground">
          {stakerLabel} not deployed on this chain.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Runway:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof nftStakerRunwaySeconds === 'bigint' && nftStakerRunwaySeconds > 0n
                  ? `${(Number(nftStakerRunwaySeconds) / 86400).toFixed(2)} days`
                  : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Minimum Runway:</span>
              <span className="text-sm font-mono text-foreground">
                {minimumRunwayDisplay}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Reward Rate (per second):</span>
              <span className="text-sm font-mono text-foreground">
                {typeof nftStakerRewardRate === 'bigint'
                  ? `${(Number(nftStakerRewardRate) / 1e18).toFixed(8)} phUSD/sec`
                  : '0.00000000 phUSD/sec'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Reward Rate (per day):</span>
              <span className="text-sm font-mono text-foreground">
                {typeof nftStakerRewardRate === 'bigint'
                  ? `${((Number(nftStakerRewardRate) * 86400) / 1e18).toFixed(2)} phUSD/day`
                  : '0.00 phUSD/day'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Budget:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof nftStakerTotalBudget === 'bigint'
                  ? `${(Number(nftStakerTotalBudget) / 1e18).toFixed(2)} phUSD`
                  : '0.00 phUSD'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Debt:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof nftStakerTotalDebt === 'bigint'
                  ? `${(Number(nftStakerTotalDebt) / 1e18).toFixed(2)} phUSD`
                  : '0.00 phUSD'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Target APY:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof nftStakerTargetApy === 'bigint'
                  ? `${(Number(nftStakerTargetApy) / 1e16).toFixed(2)} %`
                  : '0.00 %'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total Staked:</span>
              <span className="text-sm font-mono text-foreground">
                {typeof nftStakerTotalStaked === 'bigint'
                  ? nftStakerTotalStaked.toString()
                  : '0'}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border">
            <label
              htmlFor={inputId}
              className="block text-sm font-medium text-foreground mb-2"
            >
              Top up phUSD
            </label>
            <input
              id={inputId}
              type="text"
              inputMode="decimal"
              value={topUpAmountInput}
              onChange={(e) => {
                setTopUpAmountInput(e.target.value);
                setTopUpInputError(null);
              }}
              placeholder="e.g. 1000"
              disabled={isTopUpApproving || isTopUpExecuting}
              className={
                'w-full px-3 py-2 bg-background border rounded-lg text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed ' +
                (topUpInputError ? 'border-red-500' : 'border-border')
              }
            />
            {topUpInputError && (
              <p className="text-xs text-red-500 mt-1">{topUpInputError}</p>
            )}

            <div className="flex gap-3 mt-3">
              {(() => {
                const allowanceBigint = typeof nftStakerPhUsdAllowance === 'bigint'
                  ? nftStakerPhUsdAllowance
                  : 0n;
                const requiredAmount = parsedTopUpAmount ?? 0n;
                const needsApproval = requiredAmount > 0n && allowanceBigint < requiredAmount;
                const txInFlight = isTopUpApproving || isTopUpExecuting;

                if (needsApproval) {
                  return (
                    <ActionButton
                      disabled={txInFlight || parsedTopUpAmount === null}
                      onAction={handleNftStakerApprove}
                      label={isTopUpApproving ? 'Approving…' : 'Approve phUSD'}
                      variant="primary"
                      isLoading={isTopUpApproving}
                    />
                  );
                }
                return (
                  <div title={!isNftStakerOwner ? `${stakerLabel}.owner only` : undefined}>
                    <ActionButton
                      disabled={txInFlight || parsedTopUpAmount === null || !isNftStakerOwner}
                      onAction={handleNftStakerTopUp}
                      label={isTopUpExecuting ? 'Topping Up…' : 'Top Up'}
                      variant="primary"
                      isLoading={isTopUpExecuting}
                    />
                  </div>
                );
              })()}
            </div>
            {!isNftStakerOwner && walletAddress && (
              <p className="text-xs text-muted-foreground mt-2">
                Connected wallet is not the {stakerLabel} owner — Top Up will revert on-chain.
              </p>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-border">
            <button
              onClick={refetchNftStakerStats}
              className="text-xs text-accent hover:text-accent/80 underline"
            >
              Refresh Runway Stats
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
            <strong>Note:</strong> Runway is derived: <code>(rewardToken.balanceOf(this) + dispatcherHook.mintDebt()) / rewardRate</code>.
            Top Up requires phUSD approval for {stakerLabel}, then transfers phUSD from your wallet
            and recomputes the emission schedule. Approve uses the exact entered amount.
          </p>
        </>
      )}
    </div>
  );
}
