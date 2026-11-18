import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MINTER = '0x3f4979F4B69CA913E6bc33111331CAd3A6983297';
const ZERO = '0x0000000000000000000000000000000000000000';

const state = vi.hoisted(() => ({
  minter: undefined as string | undefined,
  result: {} as { data?: unknown; isLoading?: boolean; isError?: boolean },
  calls: [] as { contracts: { functionName: string; address?: string }[]; query?: { enabled?: boolean; refetchInterval?: unknown }; allowFailure?: boolean }[],
  refetch: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useReadContracts: (config: (typeof state.calls)[number]) => {
    state.calls.push(config);
    // Mirrors wagmi: a disabled query never resolves data.
    if (config.query?.enabled === false) {
      return { data: undefined, isLoading: false, isError: false, refetch: state.refetch };
    }
    return { isLoading: false, isError: false, ...state.result, refetch: state.refetch };
  },
}));
vi.mock('../../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({
    addresses: state.minter === undefined ? {} : { NudgeDiscountBatchMinter: state.minter },
    networkType: 'local',
  }),
}));
vi.mock('../../contexts/PollingContext', () => ({ usePolling: () => ({ isPollingEnabled: true }) }));
vi.mock('../../utils/logger', () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import NudgeDiscountPendingBuyPanel from './NudgeDiscountPendingBuyPanel';
import { formatTokenAmount2dp } from '../../lib/formatTokenAmount2dp';

const ONE_PHUSD = 10n ** 18n;

beforeEach(() => {
  state.minter = MINTER;
  state.result = {};
  state.calls = [];
  state.refetch.mockReset();
});

describe('formatTokenAmount2dp', () => {
  it('floors to 2 dp with en-US separators, bigint only', () => {
    expect(formatTokenAmount2dp(1054071716n, 6)).toBe('1,054.07');
    expect(formatTokenAmount2dp(1234567890123456789012n, 18)).toBe('1,234.56');
    expect(formatTokenAmount2dp(0n, 6)).toBe('0.00');
    expect(formatTokenAmount2dp(9999n, 6)).toBe('0.00');
  });

  it('keeps precision past 2^53', () => {
    expect(formatTokenAmount2dp(123456789012345678n * ONE_PHUSD + 999n * 10n ** 15n, 18)).toBe(
      '123,456,789,012,345,678.99'
    );
  });
});

describe('NudgeDiscountPendingBuyPanel', () => {
  it('renders nothing and disables the read on a zero-address minter', () => {
    state.minter = ZERO;
    const { container } = render(<NudgeDiscountPendingBuyPanel />);
    expect(container).toBeEmptyDOMElement();
    expect(state.calls.length).toBeGreaterThan(0);
    expect(state.calls.every((c) => c.query?.enabled === false)).toBe(true);
  });

  it('renders nothing and disables the read when the minter address is undefined', () => {
    state.minter = undefined;
    const { container } = render(<NudgeDiscountPendingBuyPanel />);
    expect(container).toBeEmptyDOMElement();
    expect(state.calls.every((c) => c.query?.enabled === false)).toBe(true);
  });

  it('issues one multicall for the three getters with polling cadence', () => {
    state.result = { data: [0n, 0n, 50] };
    render(<NudgeDiscountPendingBuyPanel />);
    const call = state.calls[state.calls.length - 1];
    expect(call.contracts.map((c) => c.functionName)).toEqual([
      'pendingBuyUSDC',
      'pendingStakerPhUSD',
      'burnPercent',
    ]);
    expect(call.contracts.every((c) => c.address === MINTER)).toBe(true);
    expect(call.query?.enabled).toBe(true);
    expect(call.query?.refetchInterval).toBe(12_000);
  });

  it('shows a placeholder, never a zero, while loading', () => {
    state.result = { data: undefined, isLoading: true };
    const { container } = render(<NudgeDiscountPendingBuyPanel />);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b0(\.00)?\b/);
    expect(text).not.toContain('Nothing to buy');
    expect(screen.getAllByText('Loading…').length).toBe(3);
  });

  it('shows "Unavailable" on error, never a zero', () => {
    state.result = { data: undefined, isError: true };
    const { container } = render(<NudgeDiscountPendingBuyPanel />);
    const text = container.textContent ?? '';
    expect(screen.getAllByText('Unavailable').length).toBe(3);
    expect(text).not.toMatch(/\b0(\.00)?\b/);
    expect(text).not.toContain('Nothing to buy');
  });

  it('shows "Nothing to buy" muted when the reserve is zero', () => {
    state.result = { data: [0n, 0n, 50] };
    render(<NudgeDiscountPendingBuyPanel />);
    const el = screen.getByText('Nothing to buy');
    expect(el).toHaveClass('text-muted-foreground');
    expect(el).not.toHaveClass('text-accent');
  });

  it('highlights a non-zero reserve and renders staker phUSD at 18 dp and burn share', () => {
    state.result = { data: [1054071716n, 1234567890123456789012n, 75] };
    const { container } = render(<NudgeDiscountPendingBuyPanel />);
    const reserve = screen.getByText('1,054.07 USDC');
    expect(reserve).toHaveClass('text-accent');
    expect(reserve).toHaveClass('font-semibold');
    expect(screen.getByText('1,234.56 phUSD')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();

    const lower = (container.textContent ?? '').toLowerCase();
    for (const banned of [
      'npm',
      'phstaging2',
      'buy-and-burn',
      'forge',
      '0xcad1a7864a108dbff67f4b8af71fab0c7a86d0b6',
    ]) {
      expect(lower).not.toContain(banned);
    }
  });

  it('has no button other than Refresh, and Refresh calls refetch', async () => {
    state.result = { data: [1054071716n, ONE_PHUSD, 75] };
    render(<NudgeDiscountPendingBuyPanel />);
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Refresh');
    await userEvent.click(buttons[0]);
    expect(state.refetch).toHaveBeenCalledTimes(1);
  });

  it('neither the panel nor the hook imports useWriteContract', () => {
    const panel = readFileSync(resolve(__dirname, 'NudgeDiscountPendingBuyPanel.tsx'), 'utf8');
    const hook = readFileSync(resolve(__dirname, '../../hooks/useNudgeDiscountPendingBuy.ts'), 'utf8');
    expect(panel).not.toContain('useWriteContract');
    expect(hook).not.toContain('useWriteContract');
  });
});
