import { useReadContracts } from 'wagmi';
import { batchNftMinterNudgeDiscountAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { usePolling } from '../contexts/PollingContext';
import { liveAddress } from '../lib/liveAddress';

/** Same heartbeat as `useDiscountBatchMinter`, gated on real-time updates. */
const PENDING_BUY_REFRESH_INTERVAL_MS = 12_000;

export interface NudgeDiscountPendingBuyState {
  /** False when `NudgeDiscountBatchMinter` is missing or the zero address. */
  active: boolean;
  isLoading: boolean;
  isError: boolean;
  /** USDC reserved for the deferred buy, raw 6 dp. Undefined until loaded. */
  pendingBuyUsdc?: bigint;
  /** phUSD owed to NFT stakers from the next buy, raw 18 dp. Undefined until loaded. */
  pendingStakerPhusd?: bigint;
  /** Share of the buy's excess that is burned, in percent. Undefined until loaded. */
  burnPercent?: number;
  refetch: () => void;
}

/**
 * Read-only view of `BatchNFTMinterNudgeDiscount`'s deferred buy reserve:
 * `pendingBuyUSDC`, `pendingStakerPhUSD` and `burnPercent` in one multicall.
 * No read is issued while the minter address is zero or absent.
 */
export function useNudgeDiscountPendingBuy(): NudgeDiscountPendingBuyState {
  const { addresses } = useContractAddresses();
  const { isPollingEnabled } = usePolling();

  const minter = liveAddress(addresses?.NudgeDiscountBatchMinter);
  const active = !!minter;
  const refetchInterval = isPollingEnabled ? PENDING_BUY_REFRESH_INTERVAL_MS : false;

  const contract = { address: minter, abi: batchNftMinterNudgeDiscountAbi } as const;
  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [
      { ...contract, functionName: 'pendingBuyUSDC' },
      { ...contract, functionName: 'pendingStakerPhUSD' },
      { ...contract, functionName: 'burnPercent' },
    ],
    allowFailure: false,
    query: { enabled: active, refetchInterval },
  });

  const [pendingBuyUsdc, pendingStakerPhusd, burnPercent] = (data ?? []) as readonly [
    bigint | undefined,
    bigint | undefined,
    number | undefined,
  ];

  return {
    active,
    isLoading,
    isError,
    pendingBuyUsdc,
    pendingStakerPhusd,
    burnPercent,
    refetch: () => {
      void refetch();
    },
  };
}
