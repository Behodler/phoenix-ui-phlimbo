import { useState, type CSSProperties, type ReactNode } from 'react';
import { log } from '../../../utils/logger';
import {
  HISTORY_PAGE_SIZE,
  etherscanAddressUrl,
  etherscanTxUrl,
  formatAge,
  formatUtc,
  shortAddress,
} from './historyFormat';

export type HistoryStatus = 'loading' | 'unavailable' | 'ready';

const DIVIDER = 'rgba(255,255,255,.10)';
const HEADER_RULE = 'rgba(255,255,255,.08)';
const ROW_RULE = 'rgba(255,255,255,.06)';
const LINK_ORANGE = '#FF8C42';

const STORAGE_PREFIX = 'history.open.';

function readStoredOpen(id: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + id) === '1';
  } catch (error) {
    log.warn('Unable to read history section state from localStorage:', error);
    return false;
  }
}

function writeStoredOpen(id: string, open: boolean): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + id, open ? '1' : '0');
  } catch (error) {
    log.warn('Unable to save history section state to localStorage:', error);
  }
}

export interface RecentHistorySectionProps {
  /** Stable id; also the localStorage key suffix for the open/closed state. */
  id: string;
  title: string;
  /** Optional icon left of the title (e.g. the NFT the whole section is about). */
  icon?: ReactNode;
  /** Optional muted line under the title. */
  subtitle?: ReactNode;
  status: HistoryStatus;
  /** Stat tiles and/or a summary line; visible even while collapsed. */
  summary?: ReactNode;
  /** Number of rows available; drives the empty state and "Show more". */
  total: number;
  emptyText: string;
  /** `history.json` generatedAt, for the "Updated …" footer. */
  generatedAt?: string;
  /** Renders the newest `visible` rows (desktop table + phone cards). */
  renderRows: (visible: number) => ReactNode;
  /** Top divider separating the section from the tool above it (default on). */
  divider?: boolean;
}

/**
 * Collapsible "Recent …" block that sits under a tool. Collapsed by default;
 * the open state is remembered per section. A failed fetch renders one muted
 * line and nothing else, so the host tool is never affected.
 */
export default function RecentHistorySection({
  id,
  title,
  icon,
  subtitle,
  status,
  summary,
  total,
  emptyText,
  generatedAt,
  renderRows,
  divider = true,
}: RecentHistorySectionProps) {
  const [open, setOpen] = useState(() => readStoredOpen(id));
  const [visible, setVisible] = useState(HISTORY_PAGE_SIZE);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    writeStoredOpen(id, next);
  };

  const heading = (
    <span className="flex min-w-0 items-center gap-2.5">
      {icon}
      <span className="flex min-w-0 flex-col">
        <span className="text-[14px] font-semibold text-pxusd-white">{title}</span>
        {subtitle && <span className="text-[12px] text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  );

  const listId = `history-${id}-list`;
  const updatedAt = generatedAt ? Date.parse(generatedAt) : NaN;

  return (
    <section
      data-testid={`history-${id}`}
      aria-label={title}
      className={`flex flex-col gap-2.5 ${divider ? 'border-t pt-3.5' : 'pt-2'}`}
      style={divider ? { borderColor: DIVIDER } : undefined}
    >
      {status === 'unavailable' ? (
        <>
          <div className="flex min-h-[44px] items-center">{heading}</div>
          <p className="text-[12px] text-muted-foreground" data-testid={`history-${id}-unavailable`}>
            History unavailable right now
          </p>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={listId}
            className="flex min-h-[44px] w-full items-center justify-between gap-2.5 text-left"
          >
            {heading}
            <span className="flex-shrink-0 text-[12px] text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
          </button>

          {status === 'loading' ? (
            <div className="flex flex-col gap-2" data-testid={`history-${id}-loading`} aria-busy="true">
              <div className="h-[52px] animate-pulse rounded-[10px] bg-pxusd-teal-700 motion-reduce:animate-none" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-pxusd-teal-700 motion-reduce:animate-none" />
            </div>
          ) : (
            <>
              {summary}
              {total === 0 ? (
                <p className="text-[12px] text-muted-foreground" data-testid={`history-${id}-empty`}>
                  {emptyText}
                </p>
              ) : (
                open && (
                  <div id={listId} className="flex flex-col">
                    {renderRows(Math.min(visible, total))}
                    {visible < total && (
                      <button
                        type="button"
                        onClick={() => setVisible((v) => v + HISTORY_PAGE_SIZE)}
                        className="flex min-h-[44px] items-center justify-center text-[13px] sm:min-h-0 sm:justify-start sm:pt-2.5 sm:text-[12px]"
                        style={{ color: LINK_ORANGE }}
                      >
                        Show more
                      </button>
                    )}
                  </div>
                )
              )}
              {Number.isFinite(updatedAt) && (
                <p className="text-[11px] text-muted-foreground">
                  Updated <span title={formatUtc(updatedAt / 1000)}>{formatAge(updatedAt / 1000, Date.now())}</span>
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

// ── Shared building blocks ───────────────────────────────────────────────────

export interface StatTile {
  label: string;
  value: ReactNode;
  color?: string;
}

/** 2–3 summary tiles on the teal card surface. */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map((tile) => (
        <div key={tile.label} className="min-w-0 rounded-[10px] bg-pxusd-teal-700 px-3 py-2.5">
          <div className="text-[11px] text-muted-foreground">{tile.label}</div>
          <div
            className="truncate font-mono text-[17px] font-semibold tabular-nums text-pxusd-white"
            style={tile.color ? { color: tile.color } : undefined}
          >
            {tile.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SummaryLine({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-muted-foreground">{children}</p>;
}

/** Shortened address linking to its Etherscan page. */
export function AddressLink({ address, className = '' }: { address: string; className?: string }) {
  return (
    <a
      href={etherscanAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className={`font-mono text-[12px] hover:underline ${className}`}
      style={{ color: LINK_ORANGE }}
    >
      {shortAddress(address)}
    </a>
  );
}

/** Relative age linking to the transaction; absolute UTC time in the tooltip. */
export function AgeLink({
  timestamp,
  txHash,
  nowMs,
  suffix,
}: {
  timestamp: number;
  txHash: string;
  nowMs: number;
  suffix?: ReactNode;
}) {
  return (
    <a
      href={etherscanTxUrl(txHash)}
      target="_blank"
      rel="noopener noreferrer"
      title={formatUtc(timestamp)}
      className="text-muted-foreground hover:underline"
    >
      {formatAge(timestamp, nowMs)}
      {suffix}
    </a>
  );
}

export interface HistoryColumn {
  label: string;
  align?: 'left' | 'right';
}

/** Desktop grid table (sm and up): uppercase 11 px header, one grid row per entry. */
export function HistoryTable({
  columns,
  template,
  children,
}: {
  columns: HistoryColumn[];
  /** CSS grid-template-columns shared by the header and every row. */
  template: string;
  children: ReactNode;
}) {
  return (
    <div className="hidden flex-col sm:flex" data-testid="history-table">
      <div
        className="grid gap-2 border-b py-1.5 text-[11px] uppercase tracking-[0.04em] text-muted-foreground"
        style={{ gridTemplateColumns: template, borderColor: HEADER_RULE }}
      >
        {columns.map((c) => (
          <span key={c.label} className={c.align === 'right' ? 'text-right' : undefined}>
            {c.label}
          </span>
        ))}
      </div>
      {children}
    </div>
  );
}

export function HistoryTableRow({ template, children }: { template: string; children: ReactNode }) {
  return (
    <div
      className="grid items-center gap-2 border-b py-2 text-[13px] tabular-nums"
      style={{ gridTemplateColumns: template, borderColor: ROW_RULE }}
      data-testid="history-table-row"
    >
      {children}
    </div>
  );
}

/** Phone list (below sm): stacked two-line cards. */
export function HistoryCardList({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:hidden" data-testid="history-cards">
      {children}
    </div>
  );
}

export interface HistoryRowCardProps {
  /** Optional leading visual (e.g. the NFT icon). */
  leading?: ReactNode;
  line1Left: ReactNode;
  line1Right?: ReactNode;
  line2Left: ReactNode;
  line2Right?: ReactNode;
}

/** One phone row: line 1 primary facts + amount, line 2 address + age. */
export function HistoryRowCard({ leading, line1Left, line1Right, line2Left, line2Right }: HistoryRowCardProps) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-[10px] bg-pxusd-teal-700 px-3 py-2.5"
      data-testid="history-card"
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2 text-[14px]">
          <span className="min-w-0 truncate">{line1Left}</span>
          {line1Right !== undefined && <span className="flex-shrink-0">{line1Right}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
          <span className="min-w-0 truncate">{line2Left}</span>
          {line2Right !== undefined && <span className="flex-shrink-0">{line2Right}</span>}
        </div>
      </div>
    </div>
  );
}

const PILL_STYLE: CSSProperties = { background: 'rgba(255,255,255,0.08)', color: '#D5E0E8' };

/** Small rounded pill, e.g. the "Forge" / "Stake" Via tag. */
export function HistoryPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full px-[7px] py-0.5 text-[11px]" style={PILL_STYLE}>
      {children}
    </span>
  );
}

/** Token symbol tag (USDC, DOLA, …) on the teal-600 surface. */
export function TokenTag({ children }: { children: ReactNode }) {
  return (
    <span className="ml-1 inline-block rounded-md bg-pxusd-teal-600 px-1.5 py-0.5 text-[11px] font-semibold text-[#D5E0E8]">
      {children}
    </span>
  );
}

/** NFT icon, or a generic placeholder for an unknown dispatcher index. */
export function NftIcon({ image, size }: { image: string | null; size: 30 | 36 }) {
  const radius = size === 36 ? 9 : 8;
  if (!image) {
    return (
      <span
        aria-hidden="true"
        data-testid="history-nft-generic-icon"
        className="flex flex-shrink-0 items-center justify-center bg-pxusd-teal-600 text-[11px] font-bold text-muted-foreground"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        NFT
      </span>
    );
  }
  return (
    <img
      src={image}
      alt=""
      aria-hidden="true"
      className="flex-shrink-0 object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  );
}
