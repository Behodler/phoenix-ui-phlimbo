import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// The panel now reads from several hooks. Each test scenario tweaks the
// mutable `panelFixture` and re-renders to assert dynamic display state.

const BATCH_MINTER = '0xBatchMinter000000000000000000000000000000';
const USDS_ADDR = '0xUSDS0000000000000000000000000000000000000';
const NFT_MINTER = '0xNftMinter000000000000000000000000000000000';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

const panelFixture = vi.hoisted(() => ({
  // mutable state used by all the mock factories below
  state: {
    batchMinter: '0xBatchMinter000000000000000000000000000000' as string,
    nudgeSize: 40n as bigint | undefined,
    nudgePaymentToken:
      '0xUSDC0000000000000000000000000000000000000' as string | undefined,
    rewardPotRaw: 10_000_000n as bigint | undefined, // 10 USDC (6dp)
    lspPriceRaw: 12_003_400_000_000_000_000n as bigint, // 12.0034 USDS
    growthBasisPoints: 100,
    dispatcherIndex: 1,
    allowance: 0n as bigint | undefined,
    userUsdsBalance: 1_000_000_000_000_000_000_000n as bigint | undefined, // 1000 USDS
  },
  reset() {
    this.state.batchMinter = '0xBatchMinter000000000000000000000000000000';
    this.state.nudgeSize = 40n;
    this.state.nudgePaymentToken = '0xUSDC0000000000000000000000000000000000000';
    this.state.rewardPotRaw = 10_000_000n;
    this.state.lspPriceRaw = 12_003_400_000_000_000_000n;
    this.state.growthBasisPoints = 100;
    this.state.dispatcherIndex = 1;
    this.state.allowance = 0n;
    this.state.userUsdsBalance = 1_000_000_000_000_000_000_000n;
  },
}));

const addToastMock = vi.fn();
vi.mock('../ui/ToastProvider', () => ({
  useToast: () => ({ addToast: addToastMock }),
}));

vi.mock('../ui/ActionButton', () => ({
  LoadingSpinner: () => <span data-testid="loading-spinner" />,
}));

const writeContractAsyncMock = vi.fn();
const approveMock = vi.fn();

vi.mock('wagmi', async () => {
  const actual = await vi.importActual<typeof import('wagmi')>('wagmi');
  return {
    ...actual,
    useAccount: () => ({
      address: '0xWallet0000000000000000000000000000000000',
      isConnected: true,
    }),
    useReadContract: (config: { functionName?: string }) => {
      // Route on functionName since the panel calls useReadContract twice.
      if (config?.functionName === 'nudgeSize') {
        return { data: panelFixture.state.nudgeSize };
      }
      if (config?.functionName === 'nudgePaymentToken') {
        return { data: panelFixture.state.nudgePaymentToken };
      }
      return { data: undefined };
    },
    useWriteContract: () => ({ writeContractAsync: writeContractAsyncMock }),
    useWaitForTransactionReceipt: () => ({ isSuccess: false }),
  };
});

vi.mock('../../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: {
      BatchNFTMinter: panelFixture.state.batchMinter,
      USDS: USDS_ADDR,
    },
    nftPrimary: {
      NFTMinter: NFT_MINTER,
    },
  }),
}));

vi.mock('../../hooks/useMinterPageView', () => ({
  useMinterPageView: () => ({
    data:
      panelFixture.state.lspPriceRaw === undefined
        ? null
        : {
            USDS: {
              priceRaw: panelFixture.state.lspPriceRaw,
              growthBasisPoints: panelFixture.state.growthBasisPoints,
              dispatcherIndex: panelFixture.state.dispatcherIndex,
              allowanceRaw: 0n,
              balanceRaw: 0n,
              allowance: '0',
              price: '12.0034',
              balance: '0',
              nftBalance: 0,
            },
          },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../hooks/useContractInteractions', () => ({
  useTokenBalance: (
    owner: string | undefined,
    token: string | undefined,
  ): { balance: bigint | undefined; refetch: () => void } => {
    // Reward pot read: BatchNFTMinter is the owner.
    if (owner && owner.toLowerCase() === BATCH_MINTER.toLowerCase()) {
      return { balance: panelFixture.state.rewardPotRaw, refetch: vi.fn() };
    }
    // User USDS balance: any other owner reading USDS.
    if (token && token.toLowerCase() === USDS_ADDR.toLowerCase()) {
      return { balance: panelFixture.state.userUsdsBalance, refetch: vi.fn() };
    }
    return { balance: undefined, refetch: vi.fn() };
  },
  useTokenAllowance: () => ({
    allowance: panelFixture.state.allowance,
    refetch: vi.fn(),
  }),
  useTokenApproval: () => ({ approve: approveMock }),
}));

// IMPORTANT: import the component AFTER all vi.mock calls.
import WhaleMintPanel from './WhaleMintPanel';

describe('WhaleMintPanel', () => {
  beforeEach(() => {
    addToastMock.mockClear();
    writeContractAsyncMock.mockReset();
    approveMock.mockReset();
    panelFixture.reset();
  });

  describe('Happy path', () => {
    it('renders dynamic count, reward pot, mint cost, receive, and CTA from on-chain reads', () => {
      render(<WhaleMintPanel />);

      expect(screen.getByTestId('whale-mint-panel')).toBeInTheDocument();
      expect(screen.getByTestId('whale-mint-eyebrow')).toHaveTextContent(
        /Whale Mint · Phoenix ×40/i,
      );
      expect(screen.getByText('Claim the nudge reward')).toBeInTheDocument();

      // Pot: 10_000_000 (6dp) → "10.00"
      expect(screen.getByTestId('whale-mint-pot')).toHaveTextContent(/10\.00/);
      expect(screen.getByTestId('whale-mint-pot')).toHaveTextContent(/USDC/);

      // Cost: geometricSumRaw(12.0034e18, 100bp, 40) — large bigint, but
      // the key assertion is that the value isn't the old static 480.1360
      // and IS rendered with 4 decimals and USDS suffix.
      const hint = screen.getByTestId('whale-mint-cost-hint');
      expect(hint).toHaveTextContent(/Mint cost:/);
      expect(hint).toHaveTextContent(/USDS/);
      expect(hint).toHaveTextContent(/Receive:\s*40 NFTs/);
      expect(hint).toHaveTextContent(/Whale mint reward:\s*10\.00 USDC/);

      // CTA label
      expect(screen.getByTestId('whale-mint-cta')).toHaveTextContent(
        /Mint 40 — Claim Reward/,
      );
    });

    it('uses dynamic nudgeSize for the count (e.g. 25 instead of 40)', () => {
      panelFixture.state.nudgeSize = 25n;
      render(<WhaleMintPanel />);

      expect(screen.getByTestId('whale-mint-eyebrow')).toHaveTextContent(/×25/);
      expect(screen.getByTestId('whale-mint-cta')).toHaveTextContent(/Mint 25/);
    });

    it('does not render the modal until the CTA is clicked', () => {
      render(<WhaleMintPanel />);
      expect(screen.queryByTestId('whale-mint-modal')).not.toBeInTheDocument();
    });

    it('opens the modal with dynamic summary rows on CTA click', async () => {
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      const modal = screen.getByTestId('whale-mint-modal');
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveTextContent(/40 × Liquid Sky Phoenix/);
      expect(modal).toHaveTextContent(/10\.00 USDC/);
      expect(modal).toHaveTextContent(/40 NFTs \+ 10\.00 USDC/);
    });
  });

  describe('Loading & fallback states', () => {
    it('renders the skeleton while nudgeSize is unresolved', () => {
      panelFixture.state.nudgeSize = undefined;
      render(<WhaleMintPanel />);

      expect(screen.getByTestId('whale-mint-skeleton')).toBeInTheDocument();
      // No "×0" / "0.0000" leaks while loading.
      expect(screen.queryByTestId('whale-mint-eyebrow')).not.toBeInTheDocument();
      expect(screen.queryByTestId('whale-mint-pot')).not.toBeInTheDocument();
    });

    it('renders the skeleton while reward pot is unresolved', () => {
      panelFixture.state.rewardPotRaw = undefined;
      render(<WhaleMintPanel />);

      expect(screen.getByTestId('whale-mint-skeleton')).toBeInTheDocument();
    });

    it('renders the skeleton while LSP price is unresolved (priceRaw == 0n)', () => {
      panelFixture.state.lspPriceRaw = 0n;
      render(<WhaleMintPanel />);

      expect(screen.getByTestId('whale-mint-skeleton')).toBeInTheDocument();
    });

    it('hides the panel entirely when BatchNFTMinter is the zero address', () => {
      panelFixture.state.batchMinter = ZERO_ADDR;
      const { container } = render(<WhaleMintPanel />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('whale-mint-panel')).not.toBeInTheDocument();
    });

    it('hides the panel entirely when the nudge reward pot is zero', () => {
      panelFixture.state.rewardPotRaw = 0n;
      const { container } = render(<WhaleMintPanel />);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByTestId('whale-mint-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('whale-mint-skeleton')).not.toBeInTheDocument();
    });
  });

  describe('Modal interactions', () => {
    it('closes the modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      expect(screen.getByTestId('whale-mint-modal')).toBeInTheDocument();

      await user.click(screen.getByTestId('whale-mint-modal-cancel'));
      expect(screen.queryByTestId('whale-mint-modal')).not.toBeInTheDocument();
    });

    it('shows the Approve button when allowance is below mint cost', async () => {
      panelFixture.state.allowance = 0n;
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      expect(screen.getByTestId('whale-mint-modal-approve')).toBeInTheDocument();
      expect(screen.queryByTestId('whale-mint-modal-mint')).not.toBeInTheDocument();
    });

    it('shows the Mint button when allowance >= mint cost', async () => {
      panelFixture.state.allowance = 10n ** 30n; // huge
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      expect(screen.getByTestId('whale-mint-modal-mint')).toBeInTheDocument();
      expect(screen.queryByTestId('whale-mint-modal-approve')).not.toBeInTheDocument();
    });

    it('shows Insufficient USDS Balance when balance < mint cost (allowance ok)', async () => {
      panelFixture.state.allowance = 10n ** 30n;
      panelFixture.state.userUsdsBalance = 1n; // effectively zero
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      const insufficient = screen.getByTestId('whale-mint-modal-insufficient');
      expect(insufficient).toBeInTheDocument();
      expect(insufficient).toHaveTextContent(/Insufficient USDS Balance/i);
    });
  });

  describe('Write flow', () => {
    it('calls approve(USDS, BatchNFTMinter, mintCostRaw) on Approve click', async () => {
      panelFixture.state.allowance = 0n;
      approveMock.mockResolvedValue(
        '0xapproval0000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      );
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      await user.click(screen.getByTestId('whale-mint-modal-approve'));

      expect(approveMock).toHaveBeenCalledTimes(1);
      const [tokenArg, spenderArg, amountArg] = approveMock.mock.calls[0];
      expect(tokenArg).toBe(USDS_ADDR);
      expect(spenderArg).toBe(BATCH_MINTER);
      // mintCostRaw is the geometric sum — positive bigint
      expect(typeof amountArg).toBe('bigint');
      expect(amountArg > 0n).toBe(true);
    });

    it('calls batchMint with correct args when allowance suffices', async () => {
      panelFixture.state.allowance = 10n ** 30n;
      writeContractAsyncMock.mockResolvedValue(
        '0xmint00000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
      );
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      await user.click(screen.getByTestId('whale-mint-modal-mint'));

      expect(writeContractAsyncMock).toHaveBeenCalledTimes(1);
      const call = writeContractAsyncMock.mock.calls[0][0];
      expect(call.functionName).toBe('batchMint');
      expect(call.address).toBe(BATCH_MINTER);
      // NFTBatchMinter holds the NFT minter, payment token, and dispatcher
      // index in state now. args = [nudgeSize, walletAddress, mintCostRaw, minReward]
      // minReward is the displayed nudge reward pot.
      expect(call.args[0]).toBe(panelFixture.state.nudgeSize);
      expect(typeof call.args[2]).toBe('bigint');
      expect((call.args[2] as bigint) > 0n).toBe(true);
      expect(call.args[3]).toBe(panelFixture.state.rewardPotRaw);
    });

    it('toasts a cancellation when approve is rejected by the user', async () => {
      panelFixture.state.allowance = 0n;
      approveMock.mockRejectedValue(new Error('user rejected transaction'));
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      await user.click(screen.getByTestId('whale-mint-modal-approve'));

      // Last toast should be the cancellation.
      const cancellationCall = addToastMock.mock.calls.find(
        ([arg]) => arg?.title === 'Transaction Cancelled',
      );
      expect(cancellationCall).toBeDefined();
    });

    it('toasts a cancellation when mint is rejected by the user', async () => {
      panelFixture.state.allowance = 10n ** 30n;
      writeContractAsyncMock.mockRejectedValue(new Error('User denied transaction'));
      const user = userEvent.setup();
      render(<WhaleMintPanel />);

      await user.click(screen.getByTestId('whale-mint-cta'));
      await user.click(screen.getByTestId('whale-mint-modal-mint'));

      const cancellationCall = addToastMock.mock.calls.find(
        ([arg]) => arg?.title === 'Transaction Cancelled',
      );
      expect(cancellationCall).toBeDefined();
    });
  });
});
