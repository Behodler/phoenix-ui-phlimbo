import { useCallback, useMemo, useState } from 'react';
import { useToast } from '../../ui/ToastProvider';
import ActionButton from '../../ui/ActionButton';
import ConfirmationDialog from '../../ui/ConfirmationDialog';
import {
  FORGE_BONFIRE_DEFAULT_NFT_ID,
  FORGE_BONFIRE_MIN_PAYOUT_BPS,
  FORGE_BONFIRE_MOCK,
  FORGE_MOCK_NFT_HOLDINGS,
} from '../../../data/forgeMockData';
import { nftStaticConfig } from '../../../data/nftMockData';
import antimatterIcon from '../../../assets/antimatter.png';
import ForgeNftPicker from './ForgeNftPicker';
import ForgeNftPickerModal from './ForgeNftPickerModal';
import ForgeStatusPill from './ForgeStatusPill';
import { createBonfirePotClock, useBonfirePot, type BonfirePotClock } from './bonfirePotClock';
import {
  bonfireMinPayout,
  buildForgeNftOptions,
  floorTo,
  fmt2,
  fmtPot2,
  nextHeldNftId,
  type ForgeNftOption,
} from './forgeFormat';

const ORANGE = '#FF8C42';
const YELLOW = '#FFD93D';

/** Arguments of `NFTBonfire.burn`, in human units. The live-wiring story converts minPayout to wei. */
export interface BonfireMockCall {
  tokenId: number;
  minPayout: number;
}

export interface BonfireToolProps {
  /** Shared pot ticker. ForgeTab passes the one its header metric reads; defaults to a private clock. */
  clock?: BonfirePotClock;
  /**
   * Wallet NFT holdings, tokenId → units. When given, the parent owns them and must apply `onBurn`;
   * when omitted, the tool keeps a local copy of FORGE_MOCK_NFT_HOLDINGS and decrements it itself.
   */
  nftHoldings?: Record<number, number>;
  /** Called with the mock burn() arguments after the user confirms. */
  onBurn?: (call: BonfireMockCall) => void;
}

/**
 * Body of the Forge "NFT Bonfire" row. MOCKED: no contract reads or writes.
 * Confirming a burn decrements the local NFT count, resets the pot to zero
 * and toasts that nothing was sent.
 */
export default function BonfireTool({ clock: clockProp, nftHoldings, onBurn }: BonfireToolProps) {
  const { addToast } = useToast();
  const [ownClock] = useState(() => clockProp ?? createBonfirePotClock(FORGE_BONFIRE_MOCK));
  const clock = clockProp ?? ownClock;
  const pot = useBonfirePot(clock);

  const [localHoldings, setLocalHoldings] = useState<Record<number, number>>(() => ({ ...FORGE_MOCK_NFT_HOLDINGS }));
  const holdings = nftHoldings ?? localHoldings;
  const nfts = useMemo(() => buildForgeNftOptions(nftStaticConfig, holdings), [holdings]);

  const [selectedNftId, setSelectedNftId] = useState(() => {
    const initial = buildForgeNftOptions(nftStaticConfig, holdings);
    const preferred = initial.find((n) => n.id === FORGE_BONFIRE_DEFAULT_NFT_ID);
    if (preferred && preferred.held > 0) return preferred.id;
    return nextHeldNftId(initial, FORGE_BONFIRE_DEFAULT_NFT_ID) ?? FORGE_BONFIRE_DEFAULT_NFT_ID;
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  // Burn being confirmed. minPayout is frozen when the dialog opens so the
  // figure the user approves is exactly the one sent.
  const [pendingBurn, setPendingBurn] = useState<{ nft: ForgeNftOption; minPayout: number } | null>(null);

  const selectedNft = nfts.find((n) => n.id === selectedNftId) ?? nfts[0];
  const canBurn = selectedNft.held > 0;
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const pot2 = fmtPot2(pot);
  const minPayoutNow = bonfireMinPayout(pot, FORGE_BONFIRE_MIN_PAYOUT_BPS);
  const pot6 = floorTo(pot, 6).toFixed(6);
  const capPct = Math.min(100, (pot / clock.maxPayout) * 100);

  const openConfirm = () => {
    if (!canBurn) return;
    setPendingBurn({ nft: selectedNft, minPayout: bonfireMinPayout(pot, FORGE_BONFIRE_MIN_PAYOUT_BPS) });
  };

  const handleConfirm = () => {
    if (!pendingBurn) return;
    // Mirrors NFTBonfire.burn(tokenId, minPayout): burns from msg.sender, no approval needed.
    const call: BonfireMockCall = { tokenId: pendingBurn.nft.id, minPayout: pendingBurn.minPayout };
    const remaining = Math.max(0, (holdings[call.tokenId] ?? 0) - 1);
    if (nftHoldings === undefined) {
      setLocalHoldings((h) => ({ ...h, [call.tokenId]: Math.max(0, (h[call.tokenId] ?? 0) - 1) }));
    }
    if (remaining === 0) {
      const after = nfts.map((n) => (n.id === call.tokenId ? { ...n, held: 0 } : n));
      setSelectedNftId(nextHeldNftId(after, call.tokenId) ?? call.tokenId);
    }
    clock.reset();
    onBurn?.(call);
    setPendingBurn(null);
    addToast({
      type: 'info',
      title: 'Preview only',
      description: 'Burning is mocked on this page. Nothing was sent.',
    });
  };

  return (
    <>
      <p className="max-w-[68ch] text-[13px] leading-[1.55] text-muted-foreground">
        Antimatter piles up in the Bonfire at a steady rate. Burn one NFT to take the whole pot, and the pot starts
        again from zero. Every NFT counts the same.
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
                  {pot6.slice(0, -2)}
                  <span style={{ opacity: 0.45 }}>{pot6.slice(-2)}</span>
                </span>
                <span className="text-sm text-muted-foreground">Antimatter</span>
              </div>
            </div>
            <ForgeStatusPill tone="fire">+{clock.ratePerDay} / day</ForgeStatusPill>
          </div>

          <div className="mt-4">
            <div
              role="img"
              aria-label={`Pot ${pot2} of a ${clock.maxPayout} Antimatter cap`}
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
              <span className="text-right">Cap {clock.maxPayout} · anything over the cap is lost</span>
            </div>
          </div>
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
            because it only goes through if you receive at least {fmt2(minPayoutNow)} Antimatter.
          </div>

          <div className="-mt-3">
            <ActionButton
              disabled={!canBurn}
              onAction={openConfirm}
              label={canBurn ? `Burn ${selectedNft.name} → receive ${pot2} Antimatter` : 'No NFT to burn'}
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
        isOpen={pendingBurn !== null}
        onClose={() => setPendingBurn(null)}
        onConfirm={handleConfirm}
        title="Confirm NFT burn"
        confirmLabel="Confirm Burn"
      >
        {pendingBurn && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="rounded-lg bg-pxusd-teal-700 p-4">
              <div className="mb-2 text-xs text-muted-foreground">You're burning</div>
              <div className="flex items-center gap-3">
                <img
                  src={pendingBurn.nft.image}
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-10 flex-shrink-0 rounded-[10px] object-cover"
                />
                <span className="min-w-0 truncate font-semibold text-foreground">
                  {pendingBurn.nft.name} #{pendingBurn.nft.id}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-pxusd-teal-700 p-4">
              <div className="mb-2 text-xs text-muted-foreground">You'll receive at least</div>
              <div className="flex items-center gap-3">
                <img src={antimatterIcon} alt="" aria-hidden="true" className="h-8 w-8 flex-shrink-0 rounded-full" />
                <span data-testid="bonfire-min-payout" className="font-mono font-semibold tabular-nums text-foreground">
                  {fmt2(pendingBurn.minPayout)} Antimatter
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
