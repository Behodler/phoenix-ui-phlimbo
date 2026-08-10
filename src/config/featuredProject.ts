/**
 * Featured Project Banner Configuration
 *
 * Set FEATURED_PROJECT_VISIBLE to true to show the featured-project promo card
 * (currently Kendu) under the Whale Discount panel. Hidden by default: the
 * banner is a hand-curated promo, so it should only appear when someone has
 * deliberately turned it on for a live campaign.
 *
 * This is a build-time constant, not runtime state, and it is read inside
 * `FeaturedProjectBanner` itself. While it is false the component returns null
 * on its very first render, so the banner's markup never reaches the DOM —
 * there is no hidden-then-revealed element and therefore nothing that can
 * flash before hydration. (Phoenix is a client-rendered Vite SPA: `index.html`
 * ships an empty `#root`, so no banner HTML exists ahead of JS either way.)
 */
export const FEATURED_PROJECT_VISIBLE = false;
