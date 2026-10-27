import type { ForgeNftOption } from './forgeFormat';

export interface ForgeNftPickerProps {
  nft: ForgeNftOption;
  onClick: () => void;
}

/**
 * Compact "selected NFT" button for Forge rows. Clicking opens
 * ForgeNftPickerModal (the caller owns the modal). Shared by Harvest Yield
 * (089) and NFT Bonfire (090).
 */
export default function ForgeNftPicker({ nft, onClick }: ForgeNftPickerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label={`${nft.name} #${nft.id}, you hold ${nft.held}. Change NFT`}
      // Hover tint is an arbitrary rgba value: opacity modifiers on the
      // bare-var pxusd-* tokens emit no CSS.
      className="flex w-full items-center gap-3 rounded-xl border border-pxusd-teal-600 bg-pxusd-teal-700 py-2 pl-2 pr-3 text-left transition-colors hover:border-[rgba(255,140,66,.5)] focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <img src={nft.image} alt="" aria-hidden="true" className="h-10 w-10 flex-shrink-0 rounded-[10px] object-cover" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{nft.name}</span>
        <span className="text-xs text-muted-foreground">
          #{nft.id} · you hold {nft.held}
        </span>
      </span>
      <span className="whitespace-nowrap text-[12.5px] font-semibold text-pxusd-orange-300">Change ›</span>
    </button>
  );
}
