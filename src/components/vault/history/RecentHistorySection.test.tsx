import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecentHistorySection, { type RecentHistorySectionProps } from './RecentHistorySection';

const ROWS = Array.from({ length: 12 }, (_, i) => `row ${i + 1}`);

function renderSection(overrides: Partial<RecentHistorySectionProps> = {}) {
  return render(
    <RecentHistorySection
      id="test"
      title="Recent things"
      status="ready"
      summary={<p>summary text</p>}
      total={ROWS.length}
      emptyText="Nothing yet."
      renderRows={(visible) => (
        <ul>
          {ROWS.slice(0, visible).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {...overrides}
    />
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('RecentHistorySection', () => {
  it('is collapsed by default with the summary still visible', () => {
    renderSection();
    const toggle = screen.getByRole('button', { name: /Recent things/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveTextContent('Show');
    expect(screen.getByText('summary text')).toBeInTheDocument();
    expect(screen.queryByText('row 1')).not.toBeInTheDocument();
  });

  it('expands to 5 rows, and "Show more" reveals 5 more at a time', async () => {
    const user = userEvent.setup();
    renderSection();
    await user.click(screen.getByRole('button', { name: /Recent things/ }));

    expect(screen.getByRole('button', { name: /Recent things/ })).toHaveTextContent('Hide');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Recent things/ }));
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('remembers the open state per section across mounts', async () => {
    const user = userEvent.setup();
    const first = renderSection();
    await user.click(screen.getByRole('button', { name: /Recent things/ }));
    first.unmount();

    renderSection();
    expect(screen.getByRole('button', { name: /Recent things/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByRole('listitem')).toHaveLength(5);

    // A different section id is unaffected.
    renderSection({ id: 'other', title: 'Other things' });
    expect(screen.getByRole('button', { name: /Other things/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives the toggle a 44 px minimum height', () => {
    renderSection();
    expect(screen.getByRole('button', { name: /Recent things/ }).className).toContain('min-h-[44px]');
  });

  it('shows skeleton lines while loading', () => {
    renderSection({ status: 'loading' });
    expect(screen.getByTestId('history-test-loading')).toBeInTheDocument();
    expect(screen.queryByText('summary text')).not.toBeInTheDocument();
  });

  it('shows one muted line when history is unavailable', () => {
    renderSection({ status: 'unavailable' });
    expect(screen.getByTestId('history-test-unavailable')).toHaveTextContent('History unavailable right now');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('summary text')).not.toBeInTheDocument();
  });

  it('shows the empty text when there are no rows', () => {
    renderSection({ total: 0 });
    expect(screen.getByTestId('history-test-empty')).toHaveTextContent('Nothing yet.');
    expect(screen.getByText('summary text')).toBeInTheDocument();
  });
});
