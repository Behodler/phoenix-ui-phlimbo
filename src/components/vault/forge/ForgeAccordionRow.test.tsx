import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import ForgeAccordionRow from './ForgeAccordionRow';
import ForgeStatusPill from './ForgeStatusPill';

function renderRow(expanded: boolean, onToggle = vi.fn()) {
  return render(
    <ForgeAccordionRow
      icon={<span>icon</span>}
      title="Test Tool"
      tagline="Does a thing"
      metric="12.34"
      metricLabel="Metric"
      pill={<ForgeStatusPill tone="good">Ready</ForgeStatusPill>}
      expanded={expanded}
      onToggle={onToggle}
    >
      <div>Row body</div>
    </ForgeAccordionRow>
  );
}

function StatefulRow() {
  const [expanded, setExpanded] = useState(false);
  return (
    <ForgeAccordionRow
      icon={<span>icon</span>}
      title="Test Tool"
      tagline="Does a thing"
      metric="12.34"
      metricLabel="Metric"
      pill={<ForgeStatusPill tone="good">Ready</ForgeStatusPill>}
      expanded={expanded}
      onToggle={() => setExpanded((e) => !e)}
    >
      <div>Row body</div>
    </ForgeAccordionRow>
  );
}

describe('ForgeAccordionRow', () => {
  it('is collapsed when not expanded: aria-expanded=false and no body', () => {
    renderRow(false);
    expect(screen.getByRole('button', { name: 'Test Tool' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Row body')).not.toBeInTheDocument();
  });

  it('renders the body only when expanded', () => {
    renderRow(true);
    expect(screen.getByRole('button', { name: 'Test Tool' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Row body')).toBeInTheDocument();
  });

  it('calls onToggle when the header is clicked', async () => {
    const onToggle = vi.fn();
    renderRow(false, onToggle);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test Tool' }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('toggles aria-expanded and the body through onToggle', async () => {
    const user = userEvent.setup();
    render(<StatefulRow />);
    const header = screen.getByRole('button', { name: 'Test Tool' });

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Row body')).toBeInTheDocument();

    await user.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Row body')).not.toBeInTheDocument();
  });

  it('shows the pill on the mobile line only, alongside the metric', () => {
    renderRow(false);
    const mobileLine = screen.getByTestId('forge-row-mobile-line');
    expect(mobileLine).toHaveClass('sm:hidden');
    expect(mobileLine).toHaveTextContent('Ready');
    expect(mobileLine).toHaveTextContent('12.34');
    expect(screen.getAllByText('Ready')).toHaveLength(1);
  });
});

describe('ForgeStatusPill', () => {
  it.each([
    ['good', 'rgb(74, 222, 128)'],
    ['bad', 'rgb(255, 77, 109)'],
    ['antimatter', 'rgb(196, 174, 234)'],
    ['fire', 'rgb(255, 217, 61)'],
  ] as const)('applies the %s tone colour inline', (tone, color) => {
    render(<ForgeStatusPill tone={tone}>Label</ForgeStatusPill>);
    expect(screen.getByText('Label')).toHaveStyle({ color });
  });
});
