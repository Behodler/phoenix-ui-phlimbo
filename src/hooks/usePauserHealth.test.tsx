import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import { usePauserHealth } from './usePauserHealth';
import PauserCoverageIndicator from '../components/vault/pauser/PauserCoverageIndicator';

// The repo convention is to vi.mock the wagmi surface: these tests cover the
// capability gate and the coverage arithmetic, not RPC plumbing.

const a = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as `0x${string}`;
const PAUSER = a(0x9999);

type ReadResult = { data?: unknown; error?: Error | null; isLoading?: boolean };
let reads: Record<string, ReadResult>;
const readCalls: { functionName: string; query?: Record<string, unknown> }[] = [];

vi.mock('wagmi', () => ({
  useReadContract: ({ functionName, address, query }: { functionName: string; address?: string; query?: Record<string, unknown> }) => {
    readCalls.push({ functionName, query });
    if (query?.enabled === false || !address) return { data: undefined, error: null, isLoading: false, refetch: vi.fn() };
    const r = reads[functionName] ?? {};
    return { data: r.data, error: r.error ?? null, isLoading: !!r.isLoading, refetch: vi.fn() };
  },
}));

vi.mock('../contexts/ContractAddressContext', () => ({
  useContractAddresses: () => ({ addresses: { Pauser: PAUSER, PhlimboV3: a(2) }, networkType: 'local' }),
}));

const registered = [a(1), a(2), a(3), a(4)];

beforeEach(() => {
  readCalls.length = 0;
  reads = {};
});

describe('usePauserHealth', () => {
  it('V2: reports supported with N, M and categories', () => {
    reads = {
      health: { data: [[a(2)], [a(3)], [a(4)], []] },
      getPausableContracts: { data: registered },
    };
    const { result } = renderHook(() => usePauserHealth());
    expect(result.current.supported).toBe(true);
    expect(result.current.registered).toBe(4);
    // noPausedGetter (a(4)) is informational; only a(2) and a(3) count.
    expect(result.current.reachable).toBe(2);
    expect(result.current.notPauser).toEqual([a(2)]);
    expect(result.current.noPausedGetter).toEqual([a(4)]);
  });

  it('V1: a failing health() read gives supported=false and fails fast (retry: false)', () => {
    reads = {
      health: { data: undefined, error: new Error('execution reverted') },
      getPausableContracts: { data: registered },
    };
    const { result } = renderHook(() => usePauserHealth());
    expect(result.current.supported).toBe(false);
    expect(result.current.coverage).toBeNull();
    const healthCall = readCalls.find((c) => c.functionName === 'health');
    expect(healthCall?.query?.retry).toBe(false);
    // The registry is not read when V2 is absent.
    const registryCall = readCalls.find((c) => c.functionName === 'getPausableContracts');
    expect(registryCall?.query?.enabled).toBe(false);
  });

  it('malformed health() data is treated as V2 absent', () => {
    reads = { health: { data: [[], []] }, getPausableContracts: { data: registered } };
    const { result } = renderHook(() => usePauserHealth());
    expect(result.current.supported).toBe(false);
  });
});

describe('PauserCoverageIndicator', () => {
  it('renders nothing against a V1 Pauser', () => {
    reads = { health: { error: new Error('execution reverted') } };
    const { container } = render(<PauserCoverageIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows M of M when healthy, with no details toggle', () => {
    reads = { health: { data: [[], [], [], []] }, getPausableContracts: { data: registered } };
    render(<PauserCoverageIndicator />);
    expect(screen.getByText('Emergency stop reaches 4 of 4 registered contracts')).toBeInTheDocument();
    expect(screen.queryByText('Show details')).toBeNull();
  });

  it('flags problems grouped by category behind a collapsed toggle', () => {
    reads = { health: { data: [[a(2)], [], [], [a(3)]] }, getPausableContracts: { data: registered } };
    render(<PauserCoverageIndicator />);
    expect(screen.getByText('Emergency stop reaches 2 of 4 registered contracts')).toBeInTheDocument();
    expect(screen.queryByText('Not pauser')).toBeNull();
    fireEvent.click(screen.getByText('Show details'));
    expect(screen.getByText('Not pauser')).toBeInTheDocument();
    expect(screen.getByText('Unreachable')).toBeInTheDocument();
    expect(screen.queryByText('Already paused')).toBeNull();
    // Known-name label from the addresses map.
    expect(screen.getByText('PhlimboV3')).toBeInTheDocument();
  });
});
