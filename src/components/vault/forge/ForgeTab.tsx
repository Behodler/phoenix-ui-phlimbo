import { useState, type ReactNode } from 'react';
import ForgeAccordionRow from './ForgeAccordionRow';
import ForgeStatusPill from './ForgeStatusPill';
import AnnihilateTool from './AnnihilateTool';
import HarvestTool from './HarvestTool';
import BonfireTool from './BonfireTool';
import BonfireFlameIcon from './BonfireFlameIcon';
import { useBonfirePot, type BonfirePotClock } from './bonfirePotClock';
import { fmt2, fmtPot2, fmtSigned4 } from './forgeFormat';
import {
  FORGE_ALL_COLLAPSED,
  FORGE_DEFAULT_OPEN,
  FORGE_OPEN_ROW_STORAGE_KEY,
  type ForgeToolKey,
} from '../../../data/forgeMockData';
import { log } from '../../../utils/logger';
import { useForgeAnnihilate } from '../../../hooks/useForgeAnnihilate';
import { useForgeHarvest } from '../../../hooks/useForgeHarvest';
import { useForgeBonfire } from '../../../hooks/useForgeBonfire';
import antimatterIcon from '../../../assets/antimatter.png';
import ethereumIcon from '../../../assets/Ethereum.png';

export interface ForgeRowDef {
  /** A ForgeToolKey in production; any unique string in tests. */
  key: string;
  icon: ReactNode;
  title: string;
  tagline: string;
  metric: ReactNode;
  metricLabel: string;
  pill: ReactNode;
  body: ReactNode;
}

export interface ForgeTabProps {
  /**
   * Test seam: override the row list (e.g. to exercise single-open behaviour
   * with several rows independent of the built-in set). Production renders the
   * built-in rows.
   */
  rows?: ForgeRowDef[];
}

/**
 * Forge tab: a stack of unrelated one-transaction helpers, one accordion row
 * per tool, only one open at a time. Add a tool by appending to `rows`.
 *
 * Every row is live: `useForgeAnnihilate`, `useForgeHarvest` and
 * `useForgeBonfire` own the reads and writes; the row bodies are presentational.
 */
export default function ForgeTab({ rows: rowsOverride }: ForgeTabProps = {}) {
  const [openKey, setOpenKey] = useState<string | null>(readStoredOpenKey);
  const annihilate = useForgeAnnihilate();
  const harvest = useForgeHarvest();
  const bonfire = useForgeBonfire();

  const harvestDisplay = harvest.display;

  const builtInRows: (ForgeRowDef & { key: ForgeToolKey })[] = [
    {
      key: 'annihilate',
      icon: <img src={antimatterIcon} alt="" aria-hidden="true" className="h-9 w-9 rounded-full" />,
      title: 'Annihilate Antimatter',
      tagline: 'Antimatter + a stablecoin → twice the phUSD',
      metric: <span style={{ color: '#C4AEEA' }}>{fmt2(annihilate.walletAntimatter)}</span>,
      metricLabel: 'Your Antimatter',
      pill: !annihilate.active ? (
        <ForgeStatusPill tone="neutral">Not live</ForgeStatusPill>
      ) : annihilate.gateReason ? (
        <ForgeStatusPill tone="bad">Paused</ForgeStatusPill>
      ) : (
        <ForgeStatusPill tone="antimatter">Ready</ForgeStatusPill>
      ),
      body: <AnnihilateTool state={annihilate} />,
    },
    {
      key: 'harvest',
      icon: <img src={ethereumIcon} alt="" aria-hidden="true" className="h-9 w-9 rounded-full" />,
      title: 'Harvest Yield',
      tagline: 'Claim protocol yield, get paid in ETH',
      metric: harvestDisplay ? (
        <span className={harvestDisplay.profitable ? 'text-green-400' : 'text-pxusd-pink-400'}>
          {fmtSigned4(harvestDisplay.ethOut - harvestDisplay.gasEth)}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      metricLabel: 'Est. profit · ETH',
      pill: !harvest.active ? (
        <ForgeStatusPill tone="neutral">Not live</ForgeStatusPill>
      ) : !harvestDisplay ? (
        <ForgeStatusPill tone="neutral">No quote</ForgeStatusPill>
      ) : harvestDisplay.profitable ? (
        <ForgeStatusPill tone="good">Profitable</ForgeStatusPill>
      ) : (
        <ForgeStatusPill tone="bad">Not profitable</ForgeStatusPill>
      ),
      body: <HarvestTool state={harvest} />,
    },
    {
      key: 'bonfire',
      icon: <BonfireFlameIcon />,
      title: 'Burn NFTs for Antimatter',
      tagline: 'Burn an NFT, take the Antimatter pot',
      metric: bonfire.loaded ? (
        <BonfirePotMetric clock={bonfire.clock} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
      metricLabel: 'Pot · Antimatter',
      pill: !bonfire.active ? (
        <ForgeStatusPill tone="neutral">Not live</ForgeStatusPill>
      ) : bonfire.blocker === 'disabled' ? (
        <ForgeStatusPill tone="neutral">Off</ForgeStatusPill>
      ) : bonfire.paused ? (
        <ForgeStatusPill tone="bad">Paused</ForgeStatusPill>
      ) : (
        <ForgeStatusPill tone="fire">Burning</ForgeStatusPill>
      ),
      body: <BonfireTool state={bonfire} />,
    },
  ];
  const rows = rowsOverride ?? builtInRows;
  // A remembered key that no longer names a row (a renamed or removed tool)
  // falls back to the default rather than leaving every row shut.
  const effectiveOpenKey =
    openKey === null || rows.some((row) => row.key === openKey) ? openKey : FORGE_DEFAULT_OPEN;

  const toggleRow = (key: string) => {
    const next = effectiveOpenKey === key ? null : key;
    setOpenKey(next);
    writeStoredOpenKey(next);
  };

  return (
    <div className="p-5">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-foreground mb-2">Forge</h2>
        <p className="text-sm text-muted-foreground">Handy one-transaction actions. Each one is a single click.</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {rows.map((row) => (
          <ForgeAccordionRow
            key={row.key}
            icon={row.icon}
            title={row.title}
            tagline={row.tagline}
            metric={row.metric}
            metricLabel={row.metricLabel}
            pill={row.pill}
            expanded={effectiveOpenKey === row.key}
            onToggle={() => toggleRow(row.key)}
          >
            {row.body}
          </ForgeAccordionRow>
        ))}
      </div>
    </div>
  );
}

/**
 * The last open row, remembered across visits. `null` means the user collapsed
 * every row; a first visit (nothing stored) opens `FORGE_DEFAULT_OPEN`.
 */
function readStoredOpenKey(): string | null {
  try {
    const stored = localStorage.getItem(FORGE_OPEN_ROW_STORAGE_KEY);
    if (stored === null) return FORGE_DEFAULT_OPEN;
    return stored === FORGE_ALL_COLLAPSED ? null : stored;
  } catch (error) {
    // localStorage unavailable (private browsing, blocked storage).
    log.warn('Unable to read the Forge open row from localStorage:', error);
    return FORGE_DEFAULT_OPEN;
  }
}

function writeStoredOpenKey(key: string | null): void {
  try {
    localStorage.setItem(FORGE_OPEN_ROW_STORAGE_KEY, key ?? FORGE_ALL_COLLAPSED);
  } catch (error) {
    log.warn('Unable to save the Forge open row to localStorage:', error);
  }
}

/** Live Bonfire pot for the row header; reads the same clock as the row body. */
function BonfirePotMetric({ clock }: { clock: BonfirePotClock }) {
  const pot = useBonfirePot(clock);
  return (
    <span data-testid="bonfire-header-pot" style={{ color: '#FFD93D' }}>
      {fmtPot2(pot)}
    </span>
  );
}
