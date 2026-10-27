import { useState, type ReactNode } from 'react';
import ForgeAccordionRow from './ForgeAccordionRow';
import ForgeStatusPill from './ForgeStatusPill';
import AnnihilateTool from './AnnihilateTool';
import { fmt2, isAnnihilateGated } from './forgeFormat';
import {
  FORGE_DEFAULT_OPEN,
  FORGE_MOCK_ANTIMATTER_BALANCE,
  FORGE_MOCK_PHUSD_PRICE,
  type ForgeToolKey,
} from '../../../data/forgeMockData';
import antimatterIcon from '../../../assets/antimatter.png';

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
   * with several rows before 089/090 add theirs). Production renders the
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

  const annihilateGated = isAnnihilateGated(FORGE_MOCK_PHUSD_PRICE);

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
