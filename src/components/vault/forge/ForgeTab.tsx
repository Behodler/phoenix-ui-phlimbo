import { useCallback, useState, type ReactNode } from 'react';
import ForgeAccordionRow from './ForgeAccordionRow';
import ForgeStatusPill from './ForgeStatusPill';
import AnnihilateTool from './AnnihilateTool';
import HarvestTool from './HarvestTool';
import BonfireTool, { type BonfireMockCall } from './BonfireTool';
import BonfireFlameIcon from './BonfireFlameIcon';
import { createBonfirePotClock, prefersReducedMotion, useBonfirePot, type BonfirePotClock } from './bonfirePotClock';
import { fmt2, fmtPot2, fmtSigned4, harvestQuote, isAnnihilateGated } from './forgeFormat';
import {
  FORGE_BONFIRE_MOCK,
  FORGE_DEFAULT_OPEN,
  FORGE_HARVEST_MIN_OUT_BPS,
  FORGE_HARVEST_MOCK,
  FORGE_HARVEST_SCENARIO,
  FORGE_MOCK_ANTIMATTER_BALANCE,
  FORGE_MOCK_NFT_HOLDINGS,
  FORGE_MOCK_PHUSD_PRICE,
  type ForgeToolKey,
} from '../../../data/forgeMockData';
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
 * MOCKED: every value comes from src/data/forgeMockData.ts; no Forge
 * component reads or writes the chain.
 */
export default function ForgeTab({ rows: rowsOverride }: ForgeTabProps = {}) {
  const [openKey, setOpenKey] = useState<string | null>(FORGE_DEFAULT_OPEN);
  // Claim-NFT holdings are shared by Harvest and Bonfire, so a mock burn also
  // updates the Harvest picker's count, and survive rows collapsing.
  const [nftHoldings, setNftHoldings] = useState<Record<number, number>>(() => ({ ...FORGE_MOCK_NFT_HOLDINGS }));
  // One pot ticker for the Bonfire header metric, panel and button.
  const [bonfireClock] = useState(() =>
    createBonfirePotClock(FORGE_BONFIRE_MOCK, { intervalMs: prefersReducedMotion() ? 1000 : 50 }),
  );
  const handleBonfireBurn = useCallback(({ tokenId }: BonfireMockCall) => {
    setNftHoldings((h) => ({ ...h, [tokenId]: Math.max(0, (h[tokenId] ?? 0) - 1) }));
  }, []);

  const annihilateGated = isAnnihilateGated(FORGE_MOCK_PHUSD_PRICE);
  const harvest = harvestQuote(FORGE_HARVEST_MOCK[FORGE_HARVEST_SCENARIO], FORGE_HARVEST_MIN_OUT_BPS);

  const builtInRows: (ForgeRowDef & { key: ForgeToolKey })[] = [
    {
      key: 'annihilate',
      icon: <img src={antimatterIcon} alt="" aria-hidden="true" className="h-9 w-9 rounded-full" />,
      title: 'Annihilate Antimatter',
      tagline: 'Antimatter + a stablecoin → twice the phUSD',
      metric: <span style={{ color: '#C4AEEA' }}>{fmt2(FORGE_MOCK_ANTIMATTER_BALANCE)}</span>,
      metricLabel: 'Your Antimatter',
      pill: annihilateGated ? (
        <ForgeStatusPill tone="bad">Paused</ForgeStatusPill>
      ) : (
        <ForgeStatusPill tone="antimatter">Ready</ForgeStatusPill>
      ),
      body: <AnnihilateTool />,
    },
    {
      key: 'harvest',
      icon: <img src={ethereumIcon} alt="" aria-hidden="true" className="h-9 w-9 rounded-full" />,
      title: 'Harvest Yield',
      tagline: 'Claim protocol yield, get paid in ETH',
      metric: (
        <span className={harvest.profitable ? 'text-green-400' : 'text-pxusd-pink-400'}>
          {fmtSigned4(harvest.profit)}
        </span>
      ),
      metricLabel: 'Est. profit · ETH',
      pill: harvest.profitable ? (
        <ForgeStatusPill tone="good">Profitable</ForgeStatusPill>
      ) : (
        <ForgeStatusPill tone="bad">Not profitable</ForgeStatusPill>
      ),
      body: <HarvestTool nftHoldings={nftHoldings} />,
    },
    {
      key: 'bonfire',
      icon: <BonfireFlameIcon />,
      title: 'NFT Bonfire',
      tagline: 'Burn an NFT, take the Antimatter pot',
      metric: <BonfirePotMetric clock={bonfireClock} />,
      metricLabel: 'Pot · Antimatter',
      pill: <ForgeStatusPill tone="fire">Burning</ForgeStatusPill>,
      body: <BonfireTool clock={bonfireClock} nftHoldings={nftHoldings} onBurn={handleBonfireBurn} />,
    },
  ];
  const rows = rowsOverride ?? builtInRows;

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
            expanded={openKey === row.key}
            onToggle={() => setOpenKey((current) => (current === row.key ? null : row.key))}
          >
            {row.body}
          </ForgeAccordionRow>
        ))}
      </div>
    </div>
  );
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
