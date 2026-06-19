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

// Hoisted mutable fixture for the yield-funnel hook so individual tests can
// override the pending-yield list (e.g., empty for the regression-guard test).
// `vi.hoisted` runs before `vi.mock` factories, satisfying mock-hoisting rules.
const yieldDataFixture = vi.hoisted(() => {
  const defaultPending = [
    {
      strategyAddress: '0xStrategyAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      tokenAddress: '0xTokenA',
      symbol: 'USDS',
      name: 'Sky Dollar',
      amount: 1n,
      amountFormatted: '1.00',
      decimals: 18,
    },
    {
      strategyAddress: '0xStrategyBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      tokenAddress: '0xTokenB',
      symbol: 'USDe',
      name: 'Ethena USDe',
      amount: 2n,
      amountFormatted: '2.00',
      decimals: 18,
    },
  ];
  return {
    // Cost-per-claim mock: 1.5 USDC for full set (1_500_000 in 6dp).
    // Picked so proportional cost gives whole cents at every uncheck step
    // (3.00 total / 1.50 cost → 1.00 / 0.50 after toggles).
    state: {
      pendingYield: defaultPending,
      claimAmount: 1_500_000n,
      claimAmountFormatted: '1.50',
      totalYieldFormatted: '3.00',
      profitFormatted: '1.50',
    },
    defaultPending,
    reset() {
      this.state.pendingYield = defaultPending;
      this.state.claimAmount = 1_500_000n;
      this.state.claimAmountFormatted = '1.50';
      this.state.totalYieldFormatted = '3.00';
      this.state.profitFormatted = '1.50';
    },
  };
});

vi.mock('../../hooks/useYieldFunnelData', () => ({
  // Mirrors the contract: claimAmount reflects the cost for the non-exempt
  // strategies only. Uses linear scaling against the fixture's full cost so
  // the same arithmetic in the test comments still holds (full $1.50,
  // uncheck $1 row → cost $1.00, etc.).
  useYieldFunnelData: (exemptStrategies: readonly `0x${string}`[] = []) => {
    const pending = yieldDataFixture.state.pendingYield;
    const fullTotalUsd = pending.reduce(
      (sum, row) => sum + parseFloat(row.amountFormatted),
      0,
    );
    const selectedTotalUsd = pending
      .filter((row) => !exemptStrategies.includes(row.strategyAddress as `0x${string}`))
      .reduce((sum, row) => sum + parseFloat(row.amountFormatted), 0);
    const fullCost = Number(yieldDataFixture.state.claimAmount);
    const scaledClaimAmount = fullTotalUsd > 0
      ? BigInt(Math.round(fullCost * (selectedTotalUsd / fullTotalUsd)))
      : 0n;
    return {
      pendingYield: pending,
      discountPercent: 5,
      claimAmount: scaledClaimAmount,
      claimAmountFormatted: yieldDataFixture.state.claimAmountFormatted,
      totalYieldFormatted: yieldDataFixture.state.totalYieldFormatted,
      profitFormatted: yieldDataFixture.state.profitFormatted,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  },
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
      // Reservoir Ratchet (USDC, 6-decimal). dispatcherIndex 7 mirrors the
      // on-chain MintPageView USDC row — never hardcoded as 6. Owned
      // (nftBalance 1) so the ratchet-claim test can select and keep it.
      USDC: {
        allowanceRaw: 0n,
        priceRaw: 0n,
        balanceRaw: 0n,
        allowance: '0',
        price: '0',
        growthBasisPoints: 0,
        balance: '0',
        nftBalance: 1,
        dispatcherIndex: 7,
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
type NftStub = { nftBalance: number; tokenPrefix?: string };
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
    // Expose an explicit per-NFT select button so tests can pick a specific
    // NFT (e.g. Reservoir Ratchet / USDC) regardless of auto-select order.
    return (
      <div data-testid="nft-selector-stub">
        {nfts.map((n) => (
          <button
            key={n.tokenPrefix}
            data-testid={`nft-select-${n.tokenPrefix}`}
            onClick={() => onSelect(n)}
          />
        ))}
      </div>
    );
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
    yieldDataFixture.reset();
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

  it('claims with the live Reservoir Ratchet dispatcher index (7) when ratchet is selected', async () => {
    // Reservoir Ratchet is UI config id 6 but its on-chain dispatcher index is
    // 7 (read from the MintPageView USDC row, never hardcoded). Selecting it
    // must forward 7n as the first claim arg.
    await renderAndAutoSelectNft();

    await act(async () => {
      fireEvent.click(screen.getByTestId('nft-select-USDC'));
    });

    await triggerClaim();

    expect(writeContractMock).toHaveBeenCalledTimes(1);
    const callArgs = writeContractMock.mock.calls[0][0];
    expect(callArgs.functionName).toBe('claim');
    expect(callArgs.args[0]).toBe(7n);
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

  it('blocks claim submission when both checkboxes are unchecked (UI guard, story 063)', async () => {
    // Story 062 wired exemptStrategies as the third claim arg; story 063
    // adds a UI guard that disables the supply button when every checkbox
    // is unchecked (so the claim with both exempted is unreachable through
    // the UI). The underlying claim path still accepts a full exempt array
    // if invoked programmatically — see the "Select a Yield Source"
    // empty-state test below for the disabled-button assertion.
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

    const btn = screen.getByTestId('action-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.dataset.label).toBe('Select a Yield Source');

    // Clicking the disabled button must not fire the claim transaction.
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(writeContractMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Story 063: Selected totals + all-unchecked empty state
// ---------------------------------------------------------------------------
//
// Fixture math (set in `yieldDataFixture`):
//   - Strategy A: 1.00 USD
//   - Strategy B: 2.00 USD
//   - Full total: 3.00 USD
//   - Full cost (claimAmount = 1_500_000 in 6dp): 1.50 USDC
//   - Full profit: 1.50 USD
//
// Proportional reductions:
//   - Uncheck A → selected = 2.00, cost = 1.50 * 2/3 = 1.00, profit = 1.00
//   - Uncheck B → selected = 1.00, cost = 1.50 * 1/3 = 0.50, profit = 0.50

describe('YieldFunnelTab — selected totals + empty selection', () => {
  beforeEach(() => {
    writeContractMock.mockClear();
    yieldDataFixture.reset();
  });

  /**
   * Find the results panel by locating the "Total Selected Yield Value:" label
   * and walking up to the panel container. Returns null when the panel is
   * absent from the DOM (all-unchecked case).
   */
  function findResultsPanel(): HTMLElement | null {
    const label = screen.queryByText('Total Selected Yield Value:');
    if (!label) return null;
    return label.closest('.bg-pxusd-teal-700') as HTMLElement | null;
  }

  it('renders the panel with the renamed "Total Selected Yield Value:" label', async () => {
    await renderAndAutoSelectNft();

    expect(screen.getByText('Total Selected Yield Value:')).toBeInTheDocument();
    expect(screen.queryByText('Total Yield Value:')).not.toBeInTheDocument();
  });

  it('shows the full total / cost / profit when every checkbox is checked', async () => {
    await renderAndAutoSelectNft();

    const panel = findResultsPanel();
    expect(panel).not.toBeNull();
    // All-checked totals come from summing amountFormatted (per-row stable=$1).
    expect(panel!).toHaveTextContent('$3.00');
    expect(panel!).toHaveTextContent('1.50 USDC');
    // Profit row reads "$1.50" — the dollar sign disambiguates it from cost.
    const profitRow = screen.getByText('Your Profit:').closest('div');
    expect(profitRow).toHaveTextContent('$1.50');
  });

  it('unchecking one row reduces total, cost, and profit proportionally', async () => {
    await renderAndAutoSelectNft();

    // Uncheck Strategy A (1.00 USD) → selected total drops to 2.00, cost to 1.00.
    await act(async () => {
      fireEvent.click(
        screen.getByTestId(`yield-funnel-include-checkbox-${STRATEGY_A}`),
      );
    });

    const panel = findResultsPanel();
    expect(panel).not.toBeNull();
    expect(panel!).toHaveTextContent('$2.00');
    expect(panel!).toHaveTextContent('1.00 USDC');
    const profitRow = screen.getByText('Your Profit:').closest('div');
    expect(profitRow).toHaveTextContent('$1.00');
  });

  it('unchecking every row hides the results panel and disables the button with "Select a Yield Source"', async () => {
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

    // Panel is removed entirely from the DOM.
    expect(screen.queryByText('Total Selected Yield Value:')).not.toBeInTheDocument();
    expect(screen.queryByText('Your Cost:')).not.toBeInTheDocument();
    expect(screen.queryByText('Your Profit:')).not.toBeInTheDocument();

    const btn = screen.getByTestId('action-button') as HTMLButtonElement;
    expect(btn.dataset.label).toBe('Select a Yield Source');
    expect(btn.disabled).toBe(true);
  });

  it('re-checking at least one row restores the panel and the supply button', async () => {
    await renderAndAutoSelectNft();

    // Uncheck both, then re-check B.
    const checkboxA = screen.getByTestId(
      `yield-funnel-include-checkbox-${STRATEGY_A}`,
    ) as HTMLInputElement;
    const checkboxB = screen.getByTestId(
      `yield-funnel-include-checkbox-${STRATEGY_B}`,
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.click(checkboxA);
    });
    await act(async () => {
      fireEvent.click(checkboxB);
    });
    // Sanity: button reads "Select a Yield Source" right now.
    expect(
      (screen.getByTestId('action-button') as HTMLButtonElement).dataset.label,
    ).toBe('Select a Yield Source');

    await act(async () => {
      fireEvent.click(checkboxB);
    });

    // Panel is back and reflects only Strategy B's 2.00 USD.
    const panel = findResultsPanel();
    expect(panel).not.toBeNull();
    expect(panel!).toHaveTextContent('$2.00');
    expect(panel!).toHaveTextContent('1.00 USDC');

    // Button is back to the supply label (approval not needed in fixture).
    const btn = screen.getByTestId('action-button') as HTMLButtonElement;
    expect(btn.dataset.label).toMatch(/^Supply /);
    expect(btn.disabled).toBe(false);
  });

  it('empty pendingYield still shows the existing "No yield available" button (regression guard)', async () => {
    yieldDataFixture.state.pendingYield = [];
    yieldDataFixture.state.claimAmount = 0n;
    yieldDataFixture.state.claimAmountFormatted = '0.00';
    yieldDataFixture.state.totalYieldFormatted = '0.00';
    yieldDataFixture.state.profitFormatted = '0.00';

    render(<YieldFunnelTab />);

    // The empty-state path renders a static panel with the old "Total Yield Value:"
    // label and disables the button with "No yield available" — that branch is
    // out of scope for this story, so it stays untouched.
    await waitFor(() => {
      const btn = screen.getByTestId('action-button') as HTMLButtonElement;
      expect(btn.dataset.label).toBe('No yield available');
      expect(btn.disabled).toBe(true);
    });
    // The new "Select a Yield Source" override must NOT fire when there are no
    // pending yield rows (allUnchecked is guarded by `pendingYield.length > 0`).
    expect(screen.queryByText('Select a Yield Source')).not.toBeInTheDocument();
  });
});
