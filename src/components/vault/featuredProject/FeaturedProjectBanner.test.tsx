import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FeaturedProjectBanner from './FeaturedProjectBanner';

// ---------------------------------------------------------------------------
// The banner is static presentation: zero props, no hooks, no chain reads, so
// there is nothing to mock. Assertions go through `data-testid` rather than
// class names, matching `WhaleDiscountPanel.test.tsx`.
// ---------------------------------------------------------------------------
describe('FeaturedProjectBanner', () => {
  it('renders the card', () => {
    render(<FeaturedProjectBanner />);

    expect(screen.getByTestId('featured-project-banner')).toBeInTheDocument();
  });

  it('shows the featured-project pill, the headline and the token sub-line', () => {
    render(<FeaturedProjectBanner />);

    expect(screen.getByTestId('featured-project-pill')).toHaveTextContent(
      'Featured project'
    );
    expect(screen.getByTestId('featured-project-headline')).toHaveTextContent(
      'Kendu'
    );
    expect(screen.getByTestId('featured-project-subline')).toHaveTextContent(
      '$KENDU · memecoin ecosystem · Ethereum & Base'
    );
  });

  it('closes the description with the whale-batch reward sentence', () => {
    render(<FeaturedProjectBanner />);

    expect(screen.getByTestId('featured-project-description')).toHaveTextContent(
      'Mint a whale batch and KENDU lands with your NFTs.'
    );
  });

  it('shows the pull-quote', () => {
    render(<FeaturedProjectBanner />);

    expect(screen.getByTestId('featured-project-quote')).toHaveTextContent(
      'We do not gamble, we work.'
    );
  });

  it('links out to CoinGecko in a new tab, without leaking the opener', () => {
    render(<FeaturedProjectBanner />);

    const link = screen.getByTestId('featured-project-coingecko-link');
    expect(link).toHaveAttribute(
      'href',
      'https://www.coingecko.com/en/coins/kendu'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('does not link to kenduinu.com — that site is down', () => {
    render(<FeaturedProjectBanner />);

    const hrefs = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((href) => href.includes('kenduinu'))).toBe(false);
    expect(
      screen.getByTestId('featured-project-banner').textContent
    ).not.toContain('kenduinu');
  });

  it('treats the art as decorative so screen readers skip it', () => {
    render(<FeaturedProjectBanner />);

    // No accessible image: the art carries `alt=""`.
    expect(screen.queryAllByRole('img')).toHaveLength(0);
  });
});
