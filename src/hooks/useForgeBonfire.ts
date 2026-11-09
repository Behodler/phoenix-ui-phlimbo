import { useEffect, useState } from 'react';
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { formatUnits, parseEventLogs, zeroAddress } from 'viem';
import { nftBonfireAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { usePolling } from '../contexts/PollingContext';
import { useToast } from '../components/ui/ToastProvider';
import { useClaimNftHoldings } from './useClaimNftHoldings';
import { decodeContractError } from '../lib/decodeContractError';
import { nftStaticConfig } from '../data/nftMockData';
import { FORGE_BONFIRE_DEFAULT_NFT_ID, FORGE_BONFIRE_MIN_PAYOUT_BPS } from '../data/forgeMockData';
import {
  createBonfirePotClock,
  prefersReducedMotion,
  type BonfirePotClock,
} from '../components/vault/forge/bonfirePotClock';
import { log } from '../utils/logger';

/** Re-read cadence while real-time updates are on. Matches the Stake tab heartbeat. */
const BONFIRE_REFRESH_INTERVAL_MS = 12_000;

/** Why a burn cannot be sent right now. `null` when it can. */
export type BonfireBlocker =
  | 'inactive'
  | 'disconnected'
  | 'loading'
  /** `ratePerDay == 0`: the contract reverts `NFTBonfire__BurningDisabled`. */
  | 'disabled'
  /** Paused by the global Pauser. Accrual continues; burns revert. */
  | 'paused'
  | 'no-nft'
  /** The attested pot is zero: a burn would destroy the NFT for nothing. */
  | 'empty'
  | null;

export interface ForgeBonfireState {
  /** False when NFTBonfire is the zero address on this network. */
  active: boolean;
  /** True once the pot, rate and cap have been read at least once. */
  loaded: boolean;
  /** Display-only ticker, re-synced to `pendingPayout()` on every poll. */
  clock: BonfirePotClock;
  /** Antimatter per day, human units. */
  ratePerDay: number;
  /** Pot cap, human units. `null` when the contract's cap is `0` (unlimited). */
  maxPayout: number | null;
  paused: boolean;
  nftHoldings: Record<number, number>;
  selectedNftId: number;
  setSelectedNftId: (id: number) => void;
  /** Block-attested `pendingPayout() × FORGE_BONFIRE_MIN_PAYOUT_BPS`, wei. What a burn signs. */
  minPayoutWei: bigint | undefined;
  blocker: BonfireBlocker;
  pendingBurn: boolean;
  /** Sends `burn(tokenId, minPayoutWei)` for the given `nftStaticConfig` id. */
  burn: (configId: number, minPayoutWei: bigint) => Promise<void>;
}

const liveAddress = (value: unknown): `0x${string}` | undefined => {
  const addr = value as `0x${string}` | undefined;
  return addr && addr !== zeroAddress ? addr : undefined;
};

const toAntimatter = (raw: bigint) => Number(formatUnits(raw, 18));

/**
 * Live wiring for the Forge "NFT Bonfire" row (`NFTBonfire`).
 *
 * `burn(tokenId, minPayout)` always burns one unit from `msg.sender`; the
 * bonfire is an authorised burner on NFTMinterV2, so no ERC1155 approval is
 * needed. The pot is `pendingPayout()`, polled on the 12 s heartbeat and
 * extrapolated between polls by `clock` for display only.
 */
export function useForgeBonfire(): ForgeBonfireState {
  const { address: wallet } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const { isPollingEnabled } = usePolling();
  const { addToast } = useToast();

  const bonfire = liveAddress(addresses?.NFTBonfire);
  const active = !!bonfire;
  const refetchInterval = isPollingEnabled ? BONFIRE_REFRESH_INTERVAL_MS : false;

  // The bonfire's own (immutable) minter, so holdings are read from the contract it burns on.
  const { data: nftMinterRaw } = useReadContract({
    address: bonfire,
    abi: nftBonfireAbi,
    functionName: 'nftMinter',
    query: { enabled: active },
  });
  const nftMinter = liveAddress(nftMinterRaw);

  const bonfireContract = { address: bonfire, abi: nftBonfireAbi } as const;
  const {
    data: reads,
    dataUpdatedAt,
    refetch: refetchReads,
  } = useReadContracts({
    contracts: [
      { ...bonfireContract, functionName: 'pendingPayout' },
      { ...bonfireContract, functionName: 'ratePerDay' },
      { ...bonfireContract, functionName: 'maxPayout' },
      { ...bonfireContract, functionName: 'paused' },
    ],
    allowFailure: false,
    query: { enabled: active, refetchInterval },
  });
  const [potRaw, rateRaw, maxRaw, pausedRaw] = (reads ?? []) as [bigint?, bigint?, bigint?, boolean?];
  const loaded = reads !== undefined;
  const ratePerDay = rateRaw === undefined ? 0 : toAntimatter(rateRaw);
  const maxPayout = maxRaw === undefined || maxRaw === 0n ? null : toAntimatter(maxRaw);
  const paused = pausedRaw === true;

  const [clock] = useState(() =>
    createBonfirePotClock(
      { potInitial: 0, ratePerDay: 0, maxPayout: Infinity },
      { intervalMs: prefersReducedMotion() ? 1000 : 50 },
    ),
  );
  // Re-anchor the ticker on every successful read, even when the values are unchanged.
  useEffect(() => {
    if (potRaw === undefined || rateRaw === undefined || maxRaw === undefined) return;
    clock.sync({
      potInitial: toAntimatter(potRaw),
      ratePerDay: toAntimatter(rateRaw),
      maxPayout: maxRaw === 0n ? Infinity : toAntimatter(maxRaw),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  const holdings = useClaimNftHoldings(wallet, nftMinter, refetchInterval);
  const { nftHoldings } = holdings;

  // Default to the preferred NFT, else the first held one, unless the user picked one they hold.
  const [selectedNftId, setSelectedNftId] = useState(FORGE_BONFIRE_DEFAULT_NFT_ID);
  useEffect(() => {
    if ((nftHoldings[selectedNftId] ?? 0) > 0) return;
    const held = nftStaticConfig.find((n) => (nftHoldings[n.id] ?? 0) > 0);
    if (held) setSelectedNftId(held.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftHoldings]);

  const minPayoutWei = potRaw === undefined ? undefined : (potRaw * BigInt(FORGE_BONFIRE_MIN_PAYOUT_BPS)) / 10_000n;

  let blocker: BonfireBlocker = null;
  if (!active) blocker = 'inactive';
  else if (!wallet) blocker = 'disconnected';
  else if (!loaded || !nftMinter || holdings.mappingLoading) blocker = 'loading';
  else if (rateRaw === 0n) blocker = 'disabled';
  else if (paused) blocker = 'paused';
  else if ((nftHoldings[selectedNftId] ?? 0) === 0) blocker = 'no-nft';
  else if (potRaw === 0n) blocker = 'empty';

  // ---- Write --------------------------------------------------------------
  const [pendingBurn, setPendingBurn] = useState(false);
  const { data: burnHash, writeContractAsync } = useWriteContract();
  const {
    data: burnReceipt,
    isSuccess: burnDone,
    isError: burnFailed,
  } = useWaitForTransactionReceipt({ hash: burnHash, query: { enabled: !!burnHash } });

  const explorerUrl = (hash: string) =>
    networkType === 'mainnet' ? `https://etherscan.io/tx/${hash}` : `https://sepolia.etherscan.io/tx/${hash}`;

  const burn = async (configId: number, minPayout: bigint) => {
    const tokenId = holdings.tokenIdFor(configId);
    if (!bonfire || tokenId === undefined) return;
    try {
      setPendingBurn(true);
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the burn in your wallet.', duration: 30000 });
      const hash = await writeContractAsync({
        address: bonfire,
        abi: nftBonfireAbi,
        functionName: 'burn',
        args: [tokenId, minPayout],
      });
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
        action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') },
      });
    } catch (error) {
      const decoded = decodeContractError(error);
      log.error('Bonfire burn failed:', error);
      addToast(
        decoded.userRejected
          ? { type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the transaction.', duration: 8000 }
          : { type: 'error', title: 'Burn Failed', description: decoded.message, duration: 16000 },
      );
      setPendingBurn(false);
    }
  };

  useEffect(() => {
    if (!burnHash || !pendingBurn) return;
    if (burnDone) {
      const [event] = burnReceipt
        ? parseEventLogs({ abi: nftBonfireAbi, logs: burnReceipt.logs, eventName: 'Burned' })
        : [];
      const paid = event ? toAntimatter(event.args.payout).toLocaleString('en-US', { maximumFractionDigits: 2 }) : null;
      addToast({
        type: 'success',
        title: 'NFT Burned',
        description: paid ? `${paid} Antimatter has been sent to your wallet.` : 'The Antimatter pot has been sent to your wallet.',
        duration: 30000,
        action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(burnHash), '_blank') },
      });
      clock.reset();
    } else if (burnFailed) {
      addToast({ type: 'error', title: 'Burn Failed', description: 'The burn transaction reverted. Your NFT was kept.', duration: 16000 });
    } else {
      return;
    }
    refetchReads();
    holdings.refetch();
    setPendingBurn(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burnDone, burnFailed, burnHash]);

  return {
    active,
    loaded,
    clock,
    ratePerDay,
    maxPayout,
    paused,
    nftHoldings,
    selectedNftId,
    setSelectedNftId,
    minPayoutWei,
    blocker,
    pendingBurn,
    burn,
  };
}
