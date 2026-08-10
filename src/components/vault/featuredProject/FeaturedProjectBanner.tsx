import { WHALE_DISCOUNT_CYAN } from '../../../data/nudgeTokenMeta';
import { FEATURED_PROJECT_VISIBLE } from '../../../config/featuredProject';
import kenduArt from '../../../assets/KENDUbanner.png';

/**
 * Featured project banner — a static promo card rendered under the Whale
 * Discount panel.
 *
 * The component is named generically because it is meant to carry a different
 * featured project later, but for now every string, link and image is
 * hardcoded to Kendu: the memecoin whose token is currently part of the
 * whale-mint nudge reward. There is deliberately no props/config/registry
 * layer yet — lifting the content out is a separate story.
 *
 * It reads no chain state and has no data hooks. Visibility is a single
 * build-time switch, `FEATURED_PROJECT_VISIBLE`, which defaults to false; the
 * gate is here rather than at the call site so the banner cannot be turned on
 * by accident from a new surface. Returning null on the first render (rather
 * than rendering hidden markup) is what guarantees no flash of the promo — no
 * banner element is ever created while the flag is off.
 *
 * Theme note (same as `WhaleDiscountPanel`): the `pxusd-*` colour tokens
 * resolve to raw hex CSS variables, so Tailwind opacity modifiers on them
 * (`bg-pxusd-teal-800/10`) emit no CSS at all. Every translucent fill, gradient
 * and mask below therefore uses an explicit `rgba()` arbitrary value or an
 * inline style.
 */
export default function FeaturedProjectBanner() {
  if (!FEATURED_PROJECT_VISIBLE) return null;

  return (
    <div className="mt-6" data-testid="featured-project-banner">
      <div className="bg-pxusd-teal-800 border border-pxusd-teal-600 rounded-lg overflow-hidden">
        {/* Hero band — art, gradient, hatch and the title stack. */}
        <div
          className="relative overflow-hidden"
          style={{
            height: 'clamp(150px, 26vw, 190px)',
            background:
              'linear-gradient(100deg, #0a1823 0%, #1c3346 45%, #0a1823 100%)',
          }}
          data-testid="featured-project-hero"
        >
          {/* Faint diagonal hatch, purely texture. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'repeating-linear-gradient(115deg, rgba(255,255,255,.035) 0 2px, transparent 2px 9px)',
            }}
          />

          {/*
            Decorative art: `alt=""` so screen readers skip it — the banner's
            meaning is entirely in the copy. The radial mask feathers the PNG's
            own square edge into the band instead of ending on a hard rectangle,
            and both the standard and `-webkit-` properties are set because
            WebKit still needs the prefixed form.
          */}
          <img
            src={kenduArt}
            alt=""
            className="featured-banner-drift absolute"
            style={{
              right: 'clamp(-14px, 1vw, 34px)',
              top: '48%',
              transform: 'translateY(-50%)',
              width: 'clamp(150px, 22vw, 200px)',
              filter: 'drop-shadow(0 14px 40px rgba(0,0,0,.6))',
              WebkitMaskImage:
                'radial-gradient(ellipse at 50% 50%, #000 64%, transparent 100%)',
              maskImage:
                'radial-gradient(ellipse at 50% 50%, #000 64%, transparent 100%)',
            }}
          />

          <div
            className="absolute flex flex-col"
            style={{
              left: 'clamp(20px, 3vw, 28px)',
              bottom: 'clamp(16px, 2.5vw, 22px)',
              gap: 'clamp(8px, 1vw, 10px)',
            }}
          >
            <span
              className="self-start rounded-full bg-phoenix-accent text-pxusd-teal-950 font-semibold uppercase px-2.5 py-[5px]"
              style={{
                fontSize: 'clamp(9px, 1.1vw, 10px)',
                letterSpacing: '.2em',
              }}
              data-testid="featured-project-pill"
            >
              Featured project
            </span>
            <h3
              className="m-0 font-extrabold text-[#F3F7FA]"
              style={{
                fontSize: 'clamp(36px, 6vw, 52px)',
                letterSpacing: '-.035em',
                lineHeight: '.95',
                textShadow: '0 6px 30px rgba(0,0,0,.55)',
              }}
              data-testid="featured-project-headline"
            >
              Kendu
            </h3>
            <span
              className="font-mono uppercase"
              style={{
                fontSize: 'clamp(10px, 1.2vw, 11px)',
                letterSpacing: '.19em',
                color: 'rgba(240,245,248,.6)',
              }}
              data-testid="featured-project-subline"
            >
              $KENDU · memecoin ecosystem · Ethereum &amp; Base
            </span>
          </div>

          {/*
            Bottom fade. Resolves to teal-800 — the card body's own colour — so
            the band dissolves into the body rather than ending on a seam.
          */}
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 bottom-0"
            style={{
              height: 64,
              background:
                'linear-gradient(180deg, transparent, var(--pxusd-teal-800))',
            }}
          />
        </div>

        {/*
          Body. Both columns are `flex: 1 1 <basis>` with no fixed width, so
          they sit side by side on desktop and wrap to a single stacked column
          once the container drops below roughly their combined basis — nothing
          here can force a horizontal scrollbar.
        */}
        <div
          className="flex flex-wrap items-start"
          style={{
            padding:
              'clamp(18px, 2.4vw, 22px) clamp(20px, 3vw, 28px) clamp(20px, 2.6vw, 24px)',
            gap: 'clamp(16px, 2.8vw, 26px)',
          }}
        >
          <p
            className="m-0"
            style={{
              flex: '1 1 460px',
              fontSize: 'clamp(14px, 1.6vw, 15px)',
              lineHeight: 1.7,
              color: 'rgba(240,245,248,.75)',
              textWrap: 'pretty',
            }}
            data-testid="featured-project-description"
          >
            Kendu is a memecoin ecosystem and social movement driven entirely by
            organic community effort — no paid marketing, no bots, no market
            makers. Members launch businesses, content and real-world promotion
            under a permissionless brand, so the project grows exactly as far as
            its people carry it.{' '}
            <span style={{ color: WHALE_DISCOUNT_CYAN }}>
              Mint a whale batch and KENDU lands with your NFTs.
            </span>
          </p>

          <div
            className="flex flex-col gap-[11px] min-w-0"
            style={{ flex: '1 1 200px' }}
          >
            <p
              className="m-0 text-[#F3F7FA]"
              style={{
                font: 'italic 600 clamp(15px, 1.8vw, 16px)/1.45 Georgia, serif',
              }}
              data-testid="featured-project-quote"
            >
              “We do not gamble, we work.”
            </p>
            <a
              href="https://www.coingecko.com/en/coins/kendu"
              target="_blank"
              rel="noopener noreferrer"
              className="self-start text-[12px] font-semibold text-pxusd-orange-400 no-underline hover:text-pxusd-orange-300"
              data-testid="featured-project-coingecko-link"
            >
              KENDU on CoinGecko →
            </a>
          </div>
        </div>
      </div>

      {/*
        Component-local styles rather than global CSS, matching
        `WhaleDiscountPanel`. The drift keyframe bakes the `translateY(-50%)`
        centring into its own transform — the inline `transform` is overridden
        the moment the animation starts, so dropping it here would snap the art
        down half its height on the first frame. Motion is dropped entirely
        under `prefers-reduced-motion`, where the static inline transform takes
        over again.
      */}
      <style>{`
        @keyframes featured-banner-drift {
          0%, 100% { transform: translate3d(0, -50%, 0) scale(1); }
          50%      { transform: translate3d(0, calc(-50% - 6px), 0) scale(1.04); }
        }
        .featured-banner-drift {
          animation: featured-banner-drift 9s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .featured-banner-drift { animation: none; }
        }
      `}</style>
    </div>
  );
}
