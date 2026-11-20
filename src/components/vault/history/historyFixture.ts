// Test-only: a schema-v1 history.json fixture shaped like the live file.
import type { EventHistory } from '../../../hooks/useEventHistory';

export const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const DOLA = '0x865377367054516E17014CcdED1e7d814EDC9ce4';
export const USDS = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';
export const UNKNOWN_STABLE = '0x1111111111111111111111111111111111111111';

export const ALICE = `0x3f2a${'0'.repeat(32)}a91c`;
export const BOB = `0x91bd${'0'.repeat(32)}07e4`;

/** 2026-11-19T00:00:00Z. Tests freeze `Date.now()` here. */
export const FIXTURE_NOW_MS = Date.UTC(2026, 10, 19, 0, 0, 0);
const NOW_S = FIXTURE_NOW_MS / 1000;
const HOUR = 3600;
const DAY = 24 * HOUR;

const E18 = 10n ** 18n;

const tx = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;

export function makeHistoryFixture(overrides: Partial<EventHistory> = {}): EventHistory {
  return {
    version: 1,
    chainId: 1,
    generatedAt: new Date(FIXTURE_NOW_MS - 2 * HOUR * 1000).toISOString(),
    tokens: {
      [USDC.toLowerCase()]: { symbol: 'USDC', decimals: 6 },
      [DOLA.toLowerCase()]: { symbol: 'DOLA', decimals: 18 },
      [USDS.toLowerCase()]: { symbol: 'USDS', decimals: 18 },
    },
    // Ascending by (blockNumber, logIndex), as the indexer writes them.
    bonfireBurns: [
      // 10 days old: outside the 7d window.
      { txHash: tx(1), logIndex: 1, blockNumber: 100, timestamp: NOW_S - 10 * DAY, burner: ALICE, tokenId: '7', payout: (5n * E18).toString() },
      { txHash: tx(2), logIndex: 3, blockNumber: 200, timestamp: NOW_S - 3 * DAY, burner: BOB, tokenId: '4', payout: '12500000000000000000' },
      { txHash: tx(3), logIndex: 2, blockNumber: 300, timestamp: NOW_S - 5 * HOUR, burner: ALICE, tokenId: '99', payout: '18666666666666666666' },
    ],
    annihilations: [
      // Forge, USDC (6 dp).
      { txHash: tx(10), logIndex: 5, blockNumber: 400, timestamp: NOW_S - 2 * DAY, user: ALICE, source: 'forge', stable: USDC, amount: '12015200000000000000', stableAmount: '12015200', phUSDAmount: '24030400000000000000' },
      // Stake-tab, DOLA (18 dp).
      { txHash: tx(11), logIndex: 1, blockNumber: 500, timestamp: NOW_S - 9 * HOUR, user: BOB, source: 'stake', stable: DOLA, amount: (1000n * E18).toString(), stableAmount: '1000480000000000000000', phUSDAmount: '2000480000000000000000' },
      // Forge, USDS (18 dp).
      { txHash: tx(12), logIndex: 7, blockNumber: 600, timestamp: NOW_S - 2 * HOUR, user: ALICE, source: 'forge', stable: USDS, amount: '75500000000000000000', stableAmount: '75530000000000000000', phUSDAmount: '151030000000000000000' },
    ],
    batchMints: [
      { txHash: tx(20), logIndex: 0, blockNumber: 700, timestamp: NOW_S - DAY, recipient: BOB, payer: BOB, free: '15', paid: '15', paidCost: '1980500000000000000000', potReservedUSDC: '0', owedAdded: '0' },
      { txHash: tx(21), logIndex: 0, blockNumber: 800, timestamp: NOW_S - 6 * HOUR, recipient: ALICE, payer: ALICE, free: '12', paid: '18', paidCost: '2412000000000000000000', potReservedUSDC: '0', owedAdded: '0' },
    ],
    ...overrides,
  };
}

/** A `fetch` stub that answers every call with `body` as JSON. */
export function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.ok === false ? 'Error' : 'OK',
    json: async () => body,
  } as unknown as Response;
}
