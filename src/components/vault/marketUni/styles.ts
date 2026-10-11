/**
 * Shared class strings for the "Market (uni)" tab.
 *
 * Translucent fills use literal rgba(...) (inline style or arbitrary values):
 * `pxusd-*` tokens are hex behind var(), so Tailwind opacity modifiers on them
 * (e.g. `bg-pxusd-orange-400/20`) emit no CSS.
 */
export const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pxusd-orange-400';

/** Raised input box (You pay / You receive / Deposit). */
export const BOX = 'bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-[14px] px-4 py-3.5 flex flex-col gap-2';

/** Inset panel on the dark background (stats, route). */
export const INSET = 'rounded-xl bg-pxusd-teal-950 border border-pxusd-teal-600';

/** Ghost icon button (gear, close). */
export const GHOST_ICON_BTN = `w-11 h-11 rounded-xl inline-flex items-center justify-center bg-transparent hover:bg-white/[0.06] transition-colors ${FOCUS_RING}`;

/** Fixed phUSD chip fill/outline (translucent orange). */
export const PHUSD_CHIP_STYLE = { background: 'rgba(255,140,66,0.12)', border: '1px solid rgba(255,140,66,0.35)' } as const;
