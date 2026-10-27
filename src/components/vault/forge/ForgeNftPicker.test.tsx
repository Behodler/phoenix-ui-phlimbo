import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgeNftPicker from './ForgeNftPicker';
import ForgeNftPickerModal from './ForgeNftPickerModal';
import type { ForgeNftOption } from './forgeFormat';

const NFTS: ForgeNftOption[] = [
  { id: 1, name: 'EYE ignition', image: 'eye.webp', held: 1 },
  { id: 3, name: 'Smouldering Scarcity', image: 'scx.webp', held: 0 },
  { id: 6, name: 'Reservoir Ratchet', image: 'ratchet.webp', held: 2 },
];

describe('ForgeNftPicker', () => {
  it('shows the selected NFT name, id and holding, and is a dialog trigger', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ForgeNftPicker nft={NFTS[2]} onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /Reservoir Ratchet/ });
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByText('Reservoir Ratchet')).toBeInTheDocument();
    expect(screen.getByText('#6 · you hold 2')).toBeInTheDocument();
    expect(screen.getByText('Change ›')).toBeInTheDocument();
    await user.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ForgeNftPickerModal', () => {
  const renderModal = (overrides: Partial<ComponentProps<typeof ForgeNftPickerModal>> = {}) => {
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      title: 'Choose a claim NFT',
      footer: 'Footer note',
      nfts: NFTS,
      selectedId: 6,
      onSelect: vi.fn(),
      ...overrides,
    };
    render(<ForgeNftPickerModal {...props} />);
    return props;
  };

  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title, footer, every NFT with its count, and marks the selected one', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'Choose a claim NFT' })).toBeInTheDocument();
    expect(screen.getByText('Footer note')).toBeInTheDocument();
    expect(screen.getByText('×2')).toBeInTheDocument();
    expect(screen.getByText('×0')).toHaveClass('text-pxusd-pink-400');
    expect(screen.getByRole('button', { name: /Reservoir Ratchet/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /EYE ignition/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables NFTs the wallet does not hold', async () => {
    const user = userEvent.setup();
    const props = renderModal();
    const unheld = screen.getByRole('button', { name: /Smouldering Scarcity/ });
    expect(unheld).toBeDisabled();
    await user.click(unheld);
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('selecting a held NFT reports it and closes', async () => {
    const user = userEvent.setup();
    const props = renderModal();
    await user.click(screen.getByRole('button', { name: /EYE ignition/ }));
    expect(props.onSelect).toHaveBeenCalledWith(1);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape, on the × button and on a backdrop click', async () => {
    const user = userEvent.setup();
    const props = renderModal();
    await user.keyboard('{Escape}');
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
    await user.click(screen.getByRole('dialog'));
    expect(props.onClose).toHaveBeenCalledTimes(3);
  });
});
