import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BonfireTool from './BonfireTool';
import BonfireFlameIcon from './BonfireFlameIcon';
import { createBonfirePotClock } from './bonfirePotClock';
import type { ForgeBonfireState } from '../../../hooks/useForgeBonfire';

const WEI = 10n ** 18n;
// Attested pot 18.4062 AM → minPayout = 18.4062 × 98% = 18.038076 AM.
const MIN_PAYOUT_WEI = (184_062n * WEI * 9_800n) / (10_000n * 10_000n);

/** Clock frozen at `t` (ms) until the test moves it; the pot is then deterministic. */
function frozenClock(params = { potInitial: 18.4062, ratePerDay: 2.5, maxPayout: 50 }) {
  const time = { t: 0 };
  const clock = createBonfirePotClock(params, { now: () => time.t, intervalMs: 10 });
  return { clock, time };
}

function bonfireState(overrides: Partial<ForgeBonfireState> = {}): ForgeBonfireState {
  return {
    active: true,
    loaded: true,
    clock: frozenClock().clock,
    ratePerDay: 2.5,
    maxPayout: 50,
    paused: false,
    nftHoldings: { 6: 2, 1: 1, 5: 3, 2: 1, 3: 0, 4: 0 },
    selectedNftId: 1,
    setSelectedNftId: vi.fn(),
    minPayoutWei: MIN_PAYOUT_WEI,
    blocker: null,
    pendingBurn: false,
    burn: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const BURN_EYE = 'Burn EYE ignition → receive 18.40 Antimatter';

describe('BonfireTool', () => {
  it('renders the explainer, pot panel, cap legend, picker and attested minimum', () => {
    render(<BonfireTool state={bonfireState()} />);

    expect(screen.getByText(/Antimatter builds up over time\. Burn any NFT to claim it all\./)).toBeInTheDocument();
    expect(screen.getByText('In the pot now')).toBeInTheDocument();
    expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('18.406200');
    expect(screen.getByText('+2.5 / day')).toBeInTheDocument();
    expect(screen.getByText('Cap 50 · anything over the cap is lost')).toBeInTheDocument();
    expect(screen.getByTestId('bonfire-cap-fill').style.width).toBe('36.8124%');

    expect(screen.getByText('NFT to burn')).toBeInTheDocument();
    expect(screen.getByText('#1 · you hold 1')).toBeInTheDocument();
    expect(screen.getByText('First burner takes it all.')).toBeInTheDocument();
    // floor(18.038076, 2) = 18.03, from the attested pot rather than the ticker.
    expect(screen.getByText(/only goes through if you receive at least\s+18\.03 Antimatter\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BURN_EYE })).toBeEnabled();
  });

  it('shows "No cap on the pot." instead of the bar when maxPayout is unlimited', () => {
    render(<BonfireTool state={bonfireState({ maxPayout: null, clock: frozenClock({ potInitial: 18.4062, ratePerDay: 2.5, maxPayout: Infinity }).clock })} />);
    expect(screen.getByText('No cap on the pot.')).toBeInTheDocument();
    expect(screen.queryByTestId('bonfire-cap-fill')).not.toBeInTheDocument();
  });

  it('shows dashes before the first chain read', () => {
    render(<BonfireTool state={bonfireState({ loaded: false, minPayoutWei: undefined, blocker: 'loading' })} />);
    expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('—');
    expect(screen.queryByText(/\/ day/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('the picker opens the modal titled "Choose an NFT to burn" and reports the choice', async () => {
    const user = userEvent.setup();
    const state = bonfireState();
    render(<BonfireTool state={state} />);

    await user.click(screen.getByRole('button', { name: /EYE ignition #1, you hold 1/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose an NFT to burn' });
    expect(within(dialog).getByText('All NFT types pay the same pot. Burn the one you value least.')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Flax Wild Fire/ }));
    expect(state.setSelectedNftId).toHaveBeenCalledWith(5);
  });

  it('the button label follows the ticking pot', () => {
    vi.useFakeTimers();
    try {
      const { clock, time } = frozenClock();
      render(<BonfireTool state={bonfireState({ clock })} />);
      expect(screen.getByRole('button', { name: BURN_EYE })).toBeInTheDocument();
      act(() => {
        time.t = 86_400_000;
        vi.advanceTimersByTime(10);
      });
      expect(screen.getByRole('button', { name: 'Burn EYE ignition → receive 20.90 Antimatter' })).toBeInTheDocument();
      expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('20.906200');
      // The signed minimum does not tick: it stays on the attested pot.
      expect(screen.getByText(/at least\s+18\.03 Antimatter\./)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('confirm sends burn(configId, minPayoutWei) with the minimum frozen when the dialog opened', async () => {
    const user = userEvent.setup();
    const state = bonfireState({ selectedNftId: 5 });
    const { rerender } = render(<BonfireTool state={state} />);

    await user.click(screen.getByRole('button', { name: 'Burn Flax Wild Fire → receive 18.40 Antimatter' }));
    expect(screen.getByText('Confirm NFT burn')).toBeInTheDocument();
    expect(screen.getByText('Flax Wild Fire #5')).toBeInTheDocument();
    expect(screen.getByTestId('bonfire-min-payout')).toHaveTextContent('18.03 Antimatter');
    expect(screen.getByText("The NFT is destroyed. This can't be undone.")).toBeInTheDocument();

    // A poll lands while the dialog is open: the figure being approved must not move.
    rerender(<BonfireTool state={{ ...state, minPayoutWei: MIN_PAYOUT_WEI * 2n }} />);
    expect(screen.getByTestId('bonfire-min-payout')).toHaveTextContent('18.03 Antimatter');

    await user.click(screen.getByRole('button', { name: 'Confirm Burn' }));
    expect(state.burn).toHaveBeenCalledWith(5, MIN_PAYOUT_WEI);
    expect(screen.queryByText('Confirm NFT burn')).not.toBeInTheDocument();
  });

  it('Cancel sends nothing', async () => {
    const user = userEvent.setup();
    const state = bonfireState();
    render(<BonfireTool state={state} />);
    await user.click(screen.getByRole('button', { name: BURN_EYE }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Confirm NFT burn')).not.toBeInTheDocument();
    expect(state.burn).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive', 'Not live on this network'],
    ['disconnected', 'Connect your wallet'],
    ['disabled', 'Burning is switched off'],
    ['paused', 'Burning is paused'],
    ['no-nft', 'No NFT to burn'],
    ['empty', 'The pot is empty'],
  ] as const)('blocker %s disables the button as "%s"', (blocker, label) => {
    render(<BonfireTool state={bonfireState({ blocker })} />);
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  });

  it('shows "Burning…" and stays disabled while a burn is in flight', () => {
    render(<BonfireTool state={bonfireState({ pendingBurn: true })} />);
    expect(screen.getByRole('button', { name: 'Burning…' })).toBeDisabled();
  });
});

describe('BonfireFlameIcon', () => {
  it('gives every instance a unique gradient id that its path references', () => {
    const { container } = render(
      <>
        <BonfireFlameIcon />
        <BonfireFlameIcon />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('linearGradient')).map((g) => g.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) {
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
      expect(container.querySelector(`path[fill="url(#${id})"]`)).not.toBeNull();
    }
  });
});
