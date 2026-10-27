import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BonfireTool from './BonfireTool';
import BonfireFlameIcon from './BonfireFlameIcon';
import { createBonfirePotClock } from './bonfirePotClock';
import { FORGE_BONFIRE_DEFAULT_NFT_ID, FORGE_BONFIRE_MOCK } from '../../../data/forgeMockData';

const { addToast } = vi.hoisted(() => ({ addToast: vi.fn() }));

vi.mock('../../ui/ToastProvider', () => ({
  useToast: () => ({ addToast }),
}));

/** Clock frozen at `t` (ms) until the test moves it; the pot is then deterministic. */
function frozenClock() {
  const time = { t: 0 };
  const clock = createBonfirePotClock(FORGE_BONFIRE_MOCK, { now: () => time.t, intervalMs: 10 });
  return { clock, time };
}

const BURN_EYE = 'Burn EYE ignition → receive 18.40 Antimatter';

describe('BonfireTool', () => {
  beforeEach(() => {
    addToast.mockClear();
  });

  it('renders the explainer, pot panel, cap legend, picker and live warning', () => {
    const { clock } = frozenClock();
    render(<BonfireTool clock={clock} />);

    expect(screen.getByText(/Antimatter piles up in the Bonfire at a steady rate\./)).toBeInTheDocument();
    expect(screen.getByText('In the pot now')).toBeInTheDocument();
    // 6 dp, floored: 18.406200
    expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('18.406200');
    expect(screen.getByText('+2.5 / day')).toBeInTheDocument();
    expect(screen.getByText('Cap 50 · anything over the cap is lost')).toBeInTheDocument();
    // 18.4062 / 50 = 36.8124%
    expect(screen.getByTestId('bonfire-cap-fill').style.width).toBe('36.8124%');

    expect(screen.getByText('NFT to burn')).toBeInTheDocument();
    expect(FORGE_BONFIRE_DEFAULT_NFT_ID).toBe(1);
    expect(screen.getByText('#1 · you hold 1')).toBeInTheDocument();

    expect(screen.getByText('First burner takes it all.')).toBeInTheDocument();
    // floor(18.4062 × 98%, 2) = 18.03
    expect(screen.getByText(/only goes through if you receive at least 18\.03 Antimatter\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: BURN_EYE })).toBeEnabled();
  });

  it('the picker opens the modal titled "Choose an NFT to burn", and choosing updates the button', async () => {
    const user = userEvent.setup();
    const { clock } = frozenClock();
    render(<BonfireTool clock={clock} />);

    await user.click(screen.getByRole('button', { name: /EYE ignition #1, you hold 1/ }));
    const dialog = screen.getByRole('dialog', { name: 'Choose an NFT to burn' });
    expect(within(dialog).getByText('All NFT types pay the same pot. Burn the one you value least.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Flax Wild Fire/ }));
    expect(screen.queryByRole('dialog', { name: 'Choose an NFT to burn' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Burn Flax Wild Fire → receive 18.40 Antimatter' })).toBeInTheDocument();
  });

  it('the button label follows the live pot', () => {
    vi.useFakeTimers();
    try {
      const { clock, time } = frozenClock();
      render(<BonfireTool clock={clock} />);
      expect(screen.getByRole('button', { name: BURN_EYE })).toBeInTheDocument();
      // One day later: 20.9062 → 20.90; the clock's next tick picks it up.
      act(() => {
        time.t = 86_400_000;
        vi.advanceTimersByTime(10);
      });
      expect(screen.getByRole('button', { name: 'Burn EYE ignition → receive 20.90 Antimatter' })).toBeInTheDocument();
      expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('20.906200');
      expect(screen.getByText(/at least 20\.48 Antimatter\./)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('click opens "Confirm NFT burn" with the floored minimum payout; confirm burns, resets the pot and toasts', async () => {
    const user = userEvent.setup();
    const { clock } = frozenClock();
    const onBurn = vi.fn();
    render(<BonfireTool clock={clock} onBurn={onBurn} />);

    // Burn from a stack of 3 so the decrement is visible on the picker.
    await user.click(screen.getByRole('button', { name: /EYE ignition #1/ }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Flax Wild Fire/ }));
    expect(screen.getByText('#5 · you hold 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Burn Flax Wild Fire → receive 18.40 Antimatter' }));
    expect(screen.getByText('Confirm NFT burn')).toBeInTheDocument();
    expect(screen.getByText("You're burning")).toBeInTheDocument();
    expect(screen.getByText('Flax Wild Fire #5')).toBeInTheDocument();
    expect(screen.getByText("You'll receive at least")).toBeInTheDocument();
    expect(screen.getByTestId('bonfire-min-payout')).toHaveTextContent('18.03 Antimatter');
    expect(screen.getByText("The NFT is destroyed. This can't be undone.")).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Confirm Burn' }));

    expect(onBurn).toHaveBeenCalledWith({ tokenId: 5, minPayout: 18.03 });
    expect(screen.queryByText('Confirm NFT burn')).not.toBeInTheDocument();
    expect(screen.getByText('#5 · you hold 2')).toBeInTheDocument();
    expect(clock.getSnapshot()).toBe(0);
    expect(screen.getByTestId('bonfire-pot')).toHaveTextContent('0.000000');
    expect(screen.getByRole('button', { name: 'Burn Flax Wild Fire → receive 0.00 Antimatter' })).toBeInTheDocument();
    expect(addToast).toHaveBeenCalledWith({
      type: 'info',
      title: 'Preview only',
      description: 'Burning is mocked on this page. Nothing was sent.',
    });
  });

  it('burning the last unit of the selected NFT selects the next held one', async () => {
    const user = userEvent.setup();
    const { clock } = frozenClock();
    render(<BonfireTool clock={clock} />);

    // Default EYE ignition #1 is held ×1.
    await user.click(screen.getByRole('button', { name: BURN_EYE }));
    await user.click(screen.getByRole('button', { name: 'Confirm Burn' }));

    // Next held after #1 in config order is #2 (Liquid Sky Phoenix ×1).
    expect(screen.getByText('#2 · you hold 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Burn Liquid Sky Phoenix → receive 0.00 Antimatter' })).toBeEnabled();
  });

  it('Cancel leaves state unchanged', async () => {
    const user = userEvent.setup();
    const { clock } = frozenClock();
    const onBurn = vi.fn();
    render(<BonfireTool clock={clock} onBurn={onBurn} />);

    await user.click(screen.getByRole('button', { name: BURN_EYE }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Confirm NFT burn')).not.toBeInTheDocument();
    expect(onBurn).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
    expect(screen.getByText('#1 · you hold 1')).toBeInTheDocument();
    expect(clock.getSnapshot()).toBeCloseTo(18.4062, 10);
    expect(screen.getByRole('button', { name: BURN_EYE })).toBeInTheDocument();
  });

  it('with no NFTs held the button is disabled as "No NFT to burn" and the picker is still shown', () => {
    const { clock } = frozenClock();
    render(<BonfireTool clock={clock} nftHoldings={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }} />);
    expect(screen.getByRole('button', { name: 'No NFT to burn' })).toBeDisabled();
    expect(screen.getByText('#1 · you hold 0')).toBeInTheDocument();
  });

  it('in controlled mode the parent owns the holdings (no local decrement)', async () => {
    const user = userEvent.setup();
    const { clock } = frozenClock();
    const onBurn = vi.fn();
    render(<BonfireTool clock={clock} nftHoldings={{ 1: 2 }} onBurn={onBurn} />);
    await user.click(screen.getByRole('button', { name: BURN_EYE }));
    await user.click(screen.getByRole('button', { name: 'Confirm Burn' }));
    expect(onBurn).toHaveBeenCalledWith({ tokenId: 1, minPayout: 18.03 });
    expect(screen.getByText('#1 · you hold 2')).toBeInTheDocument();
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
