import { useCallback, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import ActionButton from '../../ui/ActionButton';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import { nftStaticConfig } from '../../../data/nftMockData';
import type { BonfireBlocker, ForgeBonfireState } from '../../../hooks/useForgeBonfire';
import antimatterIcon from '../../../assets/antimatter.png';
import ForgeNftPicker from './ForgeNftPicker';
import ForgeNftPickerModal from './ForgeNftPickerModal';
import ForgeStatusPill from './ForgeStatusPill';
import { useBonfirePot } from './bonfirePotClock';
import { buildForgeNftOptions, floorTo, fmt2, fmtPot2, type ForgeNftOption } from './forgeFormat';

const ORANGE = '#FF8C42';
const YELLOW = '#FFD93D';

export interface BonfireToolProps {
  /** Live state from `useForgeBonfire`, owned by ForgeTab so the row header can share it. */
  state: ForgeBonfireState;
}

/** What the button says when a burn cannot be sent, keyed by the reason. */
const BLOCKER_LABEL: Record<Exclude<BonfireBlocker, null>, string> = {
  inactive: 'Not live on this network',
  disconnected: 'Connect your wallet',
  loading: 'Loading…',
  disabled: 'Burning is switched off',
  paused: 'Burning is paused',
  'no-nft': 'No NFT to burn',
  empty: 'The pot is empty',
};

/** Wei → Antimatter, floored to 2 dp so the guarantee shown never overstates what is signed. */
const minPayoutDisplay = (wei: bigint) => floorTo(Number(formatUnits(wei, 18)), 2);

/** Rate per day without trailing zeros, e.g. 10 → "10", 2.5 → "2.5". */
const fmtRate = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });

/**
 * Body of the Forge "Burn NFTs for Antimatter" row (`NFTBonfire`). Presentational: reads
 * and the burn itself live in `useForgeBonfire`. The pot ticks from the
 * hook's display-only clock; the burn's `minPayout` is the block-attested pot
 * less the haircut, frozen when the confirmation dialog opens.
 */
export default function BonfireTool({ state }: BonfireToolProps) {
  const { clock, loaded, ratePerDay, maxPayout, nftHoldings, selectedNftId, setSelectedNftId, minPayoutWei, blocker, pendingBurn } =
    state;
  const pot = useBonfirePot(clock);

  const nfts = useMemo(() => buildForgeNftOptions(nftStaticConfig, nftHoldings), [nftHoldings]);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Burn being confirmed. minPayout is frozen when the dialog opens so the
  // figure the user approves is exactly the one sent.
  const [confirming, setConfirming] = useState<{ nft: ForgeNftOption; minPayoutWei: bigint } | null>(null);

  const selectedNft = nfts.find((n) => n.id === selectedNftId) ?? nfts[0];
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const pot2 = loaded ? fmtPot2(pot) : '—';
  const pot6 = floorTo(pot, 6).toFixed(6);
  const capPct = maxPayout ? Math.min(100, (pot / maxPayout) * 100) : 0;
  const minPayoutNow = minPayoutWei === undefined ? null : minPayoutDisplay(minPayoutWei);

  const canBurn = blocker === null && minPayoutWei !== undefined && !pendingBurn;
  const buttonLabel = pendingBurn
    ? 'Burning…'
    : blocker !== null
      ? BLOCKER_LABEL[blocker]
      : `Burn ${selectedNft.name} → receive ${pot2} Antimatter`;

  const openConfirm = () => {
    if (!canBurn || minPayoutWei === undefined) return;
    setConfirming({ nft: selectedNft, minPayoutWei });
  };

  const handleConfirm = () => {
    if (!confirming) return;
    const { nft, minPayoutWei: frozen } = confirming;
    setConfirming(null);
    void state.burn(nft.id, frozen);
  };

  return (
    <>
      <p className="max-w-[68ch] text-[13px] leading-[1.55] text-muted-foreground">
        Antimatter builds up over time. Burn any NFT to claim it all.
      </p>

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        {/* Left: the pot */}
        <div
          data-testid="bonfire-pot-panel"
          className="min-w-0 rounded-2xl border p-4"
          style={{
            borderColor: 'rgba(255,140,66,.3)',
            background:
              'radial-gradient(120% 100% at 50% 120%, rgba(255,106,0,.22), rgba(255,77,109,.06) 55%, rgba(10,28,40,0) 80%)',
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-pxusd-orange-300">
                In the pot now
              </div>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span
                  data-testid="bonfire-pot"
                  className="font-mono text-[34px] font-light tracking-[-0.02em] tabular-nums text-pxusd-white"
                >
                  {loaded ? (
                    <>
                      {pot6.slice(0, -2)}
                      <span style={{ opacity: 0.45 }}>{pot6.slice(-2)}</span>
                    </>
                  ) : (
                    '—'
                  )}
                </span>
                <span className="text-sm text-muted-foreground">Antimatter</span>
              </div>
            </div>
            {loaded && <ForgeStatusPill tone="fire">+{fmtRate(ratePerDay)} / day</ForgeStatusPill>}
          </div>

          {maxPayout !== null ? (
            <div className="mt-4">
              <div
                role="img"
                aria-label={`Pot ${pot2} of a ${fmtRate(maxPayout)} Antimatter cap`}
                className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]"
              >
                <span
                  data-testid="bonfire-cap-fill"
                  className="block h-full rounded-full"
                  style={{ width: `${capPct}%`, background: 'var(--grad-accent)' }}
                />
              </div>
              <div className="mt-2 flex justify-between gap-3 text-[11.5px] text-muted-foreground">
                <span>0</span>
                <span className="text-right">Cap {fmtRate(maxPayout)} · anything over the cap is lost</span>
              </div>
            </div>
          ) : (
            loaded && <div className="mt-4 text-[11.5px] text-muted-foreground">No cap on the pot.</div>
          )}
        </div>

        {/* Right: NFT, warning, action */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              NFT to burn
            </span>
            <ForgeNftPicker nft={selectedNft} onClick={() => setPickerOpen(true)} />
          </div>

          <div
            className="rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
            style={{ borderColor: 'rgba(255,217,61,.3)', background: 'rgba(255,217,61,.06)' }}
          >
            <strong style={{ color: YELLOW }}>First burner takes it all.</strong> If someone burns before you in the
            same block, the pot is empty when your transaction lands. Your burn then reverts and your NFT is kept,
            because it only goes through if you receive at least{' '}
            {minPayoutNow === null ? 'the pot shown' : `${fmt2(minPayoutNow)} Antimatter`}.
          </div>

          <div className="-mt-3">
            <ActionButton
              disabled={!canBurn}
              onAction={openConfirm}
              label={buttonLabel}
            />
          </div>
        </div>
      </div>

      <ForgeNftPickerModal
        isOpen={pickerOpen}
        onClose={closePicker}
        title="Choose an NFT to burn"
        footer="All NFT types pay the same pot. Burn the one you value least."
        nfts={nfts}
        selectedId={selectedNft.id}
        onSelect={setSelectedNftId}
      />

      <ConfirmationDialog
        isOpen={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={handleConfirm}
        title="Confirm NFT burn"
        confirmLabel="Confirm Burn"
      >
        {confirming && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg bg-pxusd-teal-700 p-4">
              <div className="mb-2 text-xs text-muted-foreground">You're burning</div>
              <div className="flex items-center gap-3">
                <img
                  src={confirming.nft.image}
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-10 flex-shrink-0 rounded-[10px] object-cover"
                />
                <span className="min-w-0 truncate font-semibold text-foreground">
                  {confirming.nft.name} #{confirming.nft.id}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-pxusd-teal-700 p-4">
              <div className="mb-2 text-xs text-muted-foreground">You'll receive at least</div>
              <div className="flex items-center gap-3">
                <img src={antimatterIcon} alt="" aria-hidden="true" className="h-8 w-8 flex-shrink-0 rounded-full" />
                <span data-testid="bonfire-min-payout" className="font-mono font-semibold tabular-nums text-foreground">
                  {fmt2(minPayoutDisplay(confirming.minPayoutWei))} Antimatter
                </span>
              </div>
            </div>
            <p style={{ color: ORANGE }}>The NFT is destroyed. This can't be undone.</p>
          </div>
        )}
      </ConfirmationDialog>
    </>
  );
}
