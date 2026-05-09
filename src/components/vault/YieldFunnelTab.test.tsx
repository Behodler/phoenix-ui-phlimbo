import type React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import YieldFunnelTab from './YieldFunnelTab';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
//
// These tests focus exclusively on the new exempt-strategies wiring:
//   1. Default checkbox state is "all checked" → empty exempt array.
//   2. Unchecking a row adds that row's strategyAddress to exempt array.
//   3. Re-checking removes it.
//   4. The 3-arg `claim(nftIndex, minRewardTokenSupplied, exemptStrategies)`
//      call site forwards the exempt array as the third argument.
//
// We mock out wagmi, contract-address context, wallet-balances context, and
// every hook the component pulls in so the render is purely deterministic
// and the only signal we care about — the args passed to writeContract — is
// observable via the spy on useWriteContract.

const writeContractMock = vi.fn().mockResolvedValue('0xhash');

vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: true, address: '0xWallet' }),
  useWriteContract: () => ({
    data: undefined,
    writeContractAsync: writeContractMock,
    isPending: false,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
  }),
}));

const ACCUMULATOR_ADDRESS = '0xAccumulator0000000000000000000000000000000';

vi.mock('../../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: {
      StableYieldAccumulator: ACCUMULATOR_ADDRESS,
      USDC: '0xUSDC0000000000000000000000000000000000000',
    },
    networkType: 'local',
  }),
}));

vi.mock('../../contexts/WalletBalancesContext', () => ({
  useWalletBalances: () => ({
    refreshWalletBalances: vi.fn(),
    usdcBalanceRaw: 10n ** 18n, // plenty
    usdcLoading: false,
  }),
}));

// Two strategies with non-zero pending yield; tests will toggle these on/off.
const STRATEGY_A = '0xStrategyAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const STRATEGY_B = '0xStrategyBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

vi.mock('../../hooks/useYieldFunnelData', () => ({
  useYieldFunnelData: () => ({
    pendingYield: [
      {
        strategyAddress: STRATEGY_A,
        tokenAddress: '0xTokenA',
        symbol: 'USDS',
        name: 'Sky Dollar',
        amount: 1n,
        amountFormatted: '1.00',
        decimals: 18,
      },
      {
        strategyAddress: STRATEGY_B,
        tokenAddress: '0xTokenB',
        symbol: 'USDe',
        name: 'Ethena USDe',
        amount: 2n,
        amountFormatted: '2.00',
        decimals: 18,
      },
    ],
    discountPercent: 5,
    claimAmount: 100n,
    claimAmountFormatted: '0.10',
    totalYieldFormatted: '3.00',
    profitFormatted: '2.90',
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// One NFT with non-zero balance so the component can build a valid claim call.
vi.mock('../../hooks/useMinterPageView', () => ({
  useMinterPageView: () => ({
    data: {
      EYE: {
        allowanceRaw: 0n,
        priceRaw: 0n,
        balanceRaw: 0n,
        allowance: '0',
        price: '0',
        growthBasisPoints: 0,
        balance: '0',
        nftBalance: 1, // owned → selectable
        dispatcherIndex: 0,
      },
      SCX: {
        allowanceRaw: 0n,
        priceRaw: 0n,
        balanceRaw: 0n,
        allowance: '0',
        price: '0',
        growthBasisPoints: 0,
        balance: '0',
        nftBalance: 0,
        dispatcherIndex: 1,
      },
      Flax: {
        allowanceRaw: 0n,
        priceRaw: 0n,
        balanceRaw: 0n,
        allowance: '0',
        price: '0',
        growthBasisPoints: 0,
        balance: '0',
        nftBalance: 0,
        dispatcherIndex: 2,
      },
      USDS: {
        allowanceRaw: 0n,
        priceRaw: 0n,
        balanceRaw: 0n,
        allowance: '0',
        price: '0',
        growthBasisPoints: 0,
        balance: '0',
        nftBalance: 0,
        dispatcherIndex: 3,
      },
      WBTC: {
        allowanceRaw: 0n,
        priceRaw: 0n,
        balanceRaw: 0n,
        allowance: '0',
        price: '0',
        growthBasisPoints: 0,
        balance: '0',
        nftBalance: 0,
        dispatcherIndex: 4,
      },
      eyeTotalBurnt: '0',
      scxTotalBurnt: '0',
      flaxTotalBurnt: '0',
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useContractInteractions', () => ({
  useTokenAllowance: () => ({
    allowance: 10n ** 30n, // huge → no approval needed
    isLoading: false,
    refetch: vi.fn(),
  }),
  useTokenApproval: () => ({
    approve: vi.fn(),
  }),
}));

vi.mock('../../hooks/useTransaction', () => ({
  useApprovalTransaction: () => ({
    state: { isPending: false, isConfirming: false, error: null },
    execute: vi.fn(),
    retry: vi.fn(),
  }),
}));

vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

// Stub the confirmation dialog: render its children when open and expose
// a single "confirm" button so tests can drive the claim path without
// depending on the real dialog's transition / portal behavior.
type ConfirmationStubProps = {
  isOpen: boolean;
  onConfirm: () => void;
  children?: React.ReactNode;
};
vi.mock('../ui/ConfirmationDialog', () => ({
  default: ({ isOpen, onConfirm, children }: ConfirmationStubProps) =>
    isOpen ? (
      <div data-testid="confirmation-dialog">
        {children}
        <button data-testid="confirmation-confirm" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null,
}));

// Stub the NFT selector grid: auto-select the first owned NFT on mount so
// the supply button is enabled without user interaction.
type NftStub = { nftBalance: number };
type SelectorStubProps = {
  nfts: NftStub[];
  onSelect: (n: NftStub) => void;
  selectedNft: NftStub | null;
};
vi.mock('./NFTSelectorGrid', () => ({
  default: ({ nfts, onSelect, selectedNft }: SelectorStubProps) => {
    // Auto-select the first NFT with a balance the first time we render.
    if (!selectedNft && nfts.length > 0) {
      const owned = nfts.find((n) => n.nftBalance > 0);
      if (owned) {
        // Defer the call so it happens during render commit, not parent's render.
        queueMicrotask(() => onSelect(owned));
      }
    }
    return <div data-testid="nft-selector-stub" />;
  },
}));

type ActionButtonStubProps = {
  label: string;
  onAction: () => void;
  disabled: boolean;
};
vi.mock('../ui/ActionButton', () => ({
  default: ({ label, onAction, disabled }: ActionButtonStubProps) => (
    <button
      data-testid="action-button"
      onClick={onAction}
      disabled={disabled}
      data-label={label}
    >
      {label}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/**
 * Render YieldFunnelTab and flush the NFTSelectorGrid auto-select microtask
 * so the supply button is enabled before the test asserts on it.
 */
async function renderAndAutoSelectNft() {
  const result = render(<YieldFunnelTab />);
  // Flush the queueMicrotask in the NFTSelectorGrid stub and the resulting
  // setSelectedNft commit. waitFor polls until the supply button enables.
  await waitFor(() => {
    const btn = screen.getByTestId('action-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(btn.dataset.label).toMatch(/Supply/);
  });
  return result;
}

/**
 * Open the confirmation dialog and click confirm to fire the claim call.
 * Uses act() so React flushes the setShowConfirmation state update before
 * the next assertion runs.
 */
async function triggerClaim() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('action-button'));
  });
  const confirmBtn = await screen.findByTestId('confirmation-confirm');
  await act(async () => {
    fireEvent.click(confirmBtn);
  });
}

describe('YieldFunnelTab — exempt strategies checkboxes', () => {
  beforeEach(() => {
    writeContractMock.mockClear();
  });

  it('renders one checkbox per pending-yield row, all checked by default', async () => {
    await renderAndAutoSelectNft();

    const checkboxA = screen.getByTestId(
      `yield-funnel-include-checkbox-${STRATEGY_A}`,
    ) as HTMLInputElement;
    const checkboxB = screen.getByTestId(
      `yield-funnel-include-checkbox-${STRATEGY_B}`,
    ) as HTMLInputElement;

    expect(checkboxA).toBeInTheDocument();
    expect(checkboxB).toBeInTheDocument();
    expect(checkboxA.checked).toBe(true);
    expect(checkboxB.checked).toBe(true);
  });

  it('passes an empty exempt array as the third claim arg when all checkboxes remain checked', async () => {
    await renderAndAutoSelectNft();
    await triggerClaim();

    expect(writeContractMock).toHaveBeenCalledTimes(1);
    const callArgs = writeContractMock.mock.calls[0][0];
    expect(callArgs.functionName).toBe('claim');
    expect(callArgs.args).toEqual([0n, 0n, []]);
    expect(callArgs.address).toBe(ACCUMULATOR_ADDRESS);
  });

  it("unchecking a row puts that row's strategyAddress into the exempt array passed to claim", async () => {
    await renderAndAutoSelectNft();

    const checkboxA = screen.getByTestId(
      `yield-funnel-include-checkbox-${STRATEGY_A}`,
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.click(checkboxA);
    });
    expect(checkboxA.checked).toBe(false);

    await triggerClaim();

    expect(writeContractMock).toHaveBeenCalledTimes(1);
    expect(writeContractMock.mock.calls[0][0].args[2]).toEqual([STRATEGY_A]);
  });

  it('re-checking a previously-unchecked row removes its address from the exempt array', async () => {
    await renderAndAutoSelectNft();

    const checkboxB = screen.getByTestId(
      `yield-funnel-include-checkbox-${STRATEGY_B}`,
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.click(checkboxB);
    });
    expect(checkboxB.checked).toBe(false);
    await act(async () => {
      fireEvent.click(checkboxB);
    });
    expect(checkboxB.checked).toBe(true);

    await triggerClaim();

    expect(writeContractMock).toHaveBeenCalledTimes(1);
    expect(writeContractMock.mock.calls[0][0].args[2]).toEqual([]);
  });

  it('passes both strategy addresses when both checkboxes are unchecked', async () => {
    await renderAndAutoSelectNft();

    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`yield-funnel-include-checkbox-${STRATEGY_A}`),
      );
    });
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`yield-funnel-include-checkbox-${STRATEGY_B}`),
      );
    });

    await triggerClaim();

    expect(writeContractMock).toHaveBeenCalledTimes(1);
    // Order is insertion order — A clicked first, then B.
    expect(writeContractMock.mock.calls[0][0].args[2]).toEqual([
      STRATEGY_A,
      STRATEGY_B,
    ]);
  });
});
