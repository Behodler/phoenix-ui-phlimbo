import { useMemo, useState } from 'react';
import type { NFTData } from '../data/nftMockData';
import { geometricSumRaw, parseUsdsInput } from './batchMintMath';
import { bigIntToDecimalString } from './bigIntDisplay';

export const BATCH_MINT_MIN_COUNT = 1;
export const BATCH_MINT_MAX_COUNT = 20;

/**
 * Slider + textbox state hook for the batch-mint flow. The modal consumes the
 * returned values and owns the Approve / Mint / Cancel buttons directly so the
 * modal shell (NFTCard at top, action row at bottom) remains untouched.
 *
 * Slider-precedence semantics: any slider change wipes the manual text override.
 * Manual text edits persist until the slider moves again.
 */
export function useBatchMintControls(nft: NFTData) {
  const [count, setCount] = useState<number>(BATCH_MINT_MIN_COUNT);
  const [manualOverride, setManualOverride] = useState<bigint | null>(null);
  const [textInput, setTextInput] = useState<string>(''); // controlled textbox value
  const [isInvalid, setIsInvalid] = useState<boolean>(false);

  const computedRaw = useMemo(
    () => geometricSumRaw(nft.priceRaw, nft.growthBasisPoints, count),
    [nft.priceRaw, nft.growthBasisPoints, count],
  );

  const requiredRaw = manualOverride ?? computedRaw;

  // The displayed textbox value: when the user has typed something, show that
  // raw input verbatim (so partial entries like "30." don't snap back). When
  // the slider drives, show the formatted computed value.
  const displayValue =
    manualOverride !== null
      ? textInput
      : bigIntToDecimalString(computedRaw, nft.decimals);

  const onSliderChange = (next: number) => {
    const clamped = Math.min(BATCH_MINT_MAX_COUNT, Math.max(BATCH_MINT_MIN_COUNT, next));
    setCount(clamped);
    setManualOverride(null);
    setTextInput('');
    setIsInvalid(false);
  };

  const onTextChange = (raw: string) => {
    setTextInput(raw);
    const parsed = parseUsdsInput(raw, nft.decimals);
    if (parsed !== null) {
      setManualOverride(parsed);
      setIsInvalid(false);
    } else {
      // Keep the previous valid override; visually flag the invalid input.
      setIsInvalid(true);
    }
  };

  return {
    count,
    requiredRaw,
    displayValue,
    isInvalid,
    onSliderChange,
    onTextChange,
  };
}
