import type { NFTData } from '../../data/nftMockData';
import UnitSlider from './staking/UnitSlider';
import {
  BATCH_MINT_MAX_COUNT,
  BATCH_MINT_MIN_COUNT,
} from '../../utils/useBatchMintControls';

/**
 * Visual surface for the batch-mint flow: slider + (conditional) amount-to-approve textbox.
 *
 * The Approve / Mint / Cancel buttons live in the parent modal so the modal
 * shell (NFTCard at top, action row at bottom) remains untouched.
 */
export interface BatchMintControlsViewProps {
  nft: NFTData;
  count: number;
  displayValue: string;
  isInvalid: boolean;
  isApproved: boolean;
  isLoading: boolean;
  onSliderChange: (n: number) => void;
  onTextChange: (raw: string) => void;
}

export default function BatchMintControlsView({
  nft,
  count,
  displayValue,
  isInvalid,
  isApproved,
  isLoading,
  onSliderChange,
  onTextChange,
}: BatchMintControlsViewProps) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Mint count
        </div>
        <UnitSlider
          value={count}
          min={BATCH_MINT_MIN_COUNT}
          max={BATCH_MINT_MAX_COUNT}
          onChange={onSliderChange}
          disabled={isLoading}
        />
      </div>

      {!isApproved && (
        <div>
          <label
            htmlFor="batch-mint-approve-amount"
            className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block"
          >
            Amount to approve ({nft.tokenDisplayName})
          </label>
          <input
            id="batch-mint-approve-amount"
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={isLoading}
            className={
              'w-full rounded-md border bg-pxusd-teal-800 px-3 py-2 text-foreground font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-pxusd-orange-500 disabled:opacity-50 disabled:cursor-not-allowed ' +
              (isInvalid
                ? 'border-red-500 focus:ring-red-500'
                : 'border-border')
            }
          />
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            Defaults to the geometric sum of {count} mints. Manual edits persist until the slider moves.
          </p>
        </div>
      )}
    </div>
  );
}
