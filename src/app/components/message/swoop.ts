import * as css from './swoop.css';

/*
 * The save swoop, ported from cinny-sane-downloader's SAVE SWOOP section: a
 * thumbnail flies out of the picture into the Download button. Pure decoration
 * - but a download that leaves no trace is easy to repeat by accident, and
 * this makes the act memorable.
 *
 * The sable-enhancements improvement is included: the caller passes the media
 * frame, and for videos the poster/blur image rendered inside it is used
 * instead of bailing on a VIDEO element. When the frame holds no <img>, there
 * is no swoop.
 */

export type SwoopStyle = 'shop' | 'shopSlide' | 'spiral';

export type SwoopSettings = {
  style: SwoopStyle;
  hold: number;
  flightSpeed: number;
  speed: number;
  size: number;
};

/*
 * The speed settings, as duration multipliers. Both are "speed" in the UI
 * (100% = as captured, 200% = twice as fast), so a duration is divided by
 * them. Overall scales every part; flight scales only the journey, on top.
 */
function swoopTiming(s: SwoopSettings) {
  const pct = (v: number) => Math.min(400, Math.max(10, Number(v) || 100));
  const all = 100 / pct(s.speed);
  return { all, flight: all * (100 / pct(s.flightSpeed)) };
}

const mediaSrc = (el: HTMLImageElement): string => el.currentSrc || el.src || '';

/*
 * Shop.app's add-to-cart animation, ported value for value. A square ghost
 * pops up over the middle of the picture with a springy overshoot, holds for
 * a beat, then flies to just above the button and drops the last half-button
 * into it while the button bounces.
 *
 * It is one element stepped through five phases by rewriting its inline
 * transition and position, exactly as Shop does it. Position is left/top,
 * size is scale() about the centre, so left + half is always the middle.
 * The curve comes from left and top getting different durations and
 * opposite easings: whichever axis gets the short ease-out settles first,
 * and the other starts slow and then whooshes. Shop gives the quick one to
 * the vertical, which under a picture reads as "drops, then slides";
 * slideFirst hands it to the horizontal instead.
 *
 * Timers, not requestAnimationFrame - rAF never runs in a background tab, and
 * each phase's start state is committed with a forced layout instead.
 */
const SWOOP_EASE_QUICK = 'cubic-bezier(0,0.6,0.3,1)'; // 340ms, settles early
const SWOOP_EASE_WHOOSH = 'cubic-bezier(0.6,0,0.15,1)'; // 440ms, slow then fast

function swoopShop(media: HTMLImageElement, button: HTMLElement, slideFirst: boolean, s: SwoopSettings) {
  const src = mediaSrc(media);
  if (!src) return;

  const from = media.getBoundingClientRect();
  const to = button.getBoundingClientRect();
  if (!from.width || !to.width) return;

  const edge = Math.max(40, Number(s.size) || 200);
  const half = edge / 2;
  const sx = from.left + from.width / 2;
  const sy = from.top + from.height / 2;
  const tx = to.left + to.width / 2;

  /*
   * Shop lands a 150px ghost at 0.2 (30px) above a 48px cart, then 0.1 (15px)
   * inside it - 0.625 and 0.31 of the icon. Same proportions against whatever
   * this button measures, so it arrives as something rather than nothing.
   */
  const aboveScale = Math.min(0.4, Math.max(0.06, (Math.min(to.width, to.height) * 0.625) / edge));
  const inScale = aboveScale / 2;

  const { all, flight } = swoopTiming(s);
  const ms = (n: number) => Math.round(n);
  const hold = Math.max(0, Number(s.hold) || 0) * all;
  const quick = 340 * flight;
  const whoosh = 440 * flight;
  const shrink = 400 * flight;
  // Shop moves on when the shrink ends (402ms), cutting its 440ms left at
  // ~99.9%. Sliding first, the long curve is the vertical one - the part you
  // watch - so wait it out instead.
  const flightLen = slideFirst ? whoosh + 2 * flight : 402 * flight;

  const tSettle1 = 351 * all;
  const tSwoop = tSettle1 + hold;
  const tSettle2 = tSwoop + flightLen;
  const tDrop = tSettle2 + 18 * all;
  const tFade = tDrop + 183 * all;
  const tGone = tFade + 302 * all;

  const ghost = document.createElement('div');
  ghost.className = css.SwoopShopGhost;
  const img = document.createElement('img');
  img.alt = '';
  img.src = src;
  img.className = css.SwoopShopImg;
  ghost.appendChild(img);
  Object.assign(ghost.style, {
    width: `${edge}px`,
    height: `${edge}px`,
    left: `${sx - half}px`,
    top: `${sy - half}px`,
    opacity: '0',
    transform: 'scale(0.5)',
    transition: 'none',
  });
  document.body.appendChild(ghost);

  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (t: number, fn: () => void) => timers.push(setTimeout(fn, ms(t)));
  const clean = () => {
    timers.forEach(clearTimeout);
    ghost.remove();
  };
  const step = (transition: string, props: Partial<CSSStyleDeclaration>) => {
    ghost.style.transition = transition;
    Object.assign(ghost.style, props);
  };
  const settle = () => {
    const g = ghost.style;
    g.transition = 'none';
    // Reading offsetHeight commits the phase's start state (forced layout).
    if (ghost.offsetHeight < 0) clean();
  };

  const leftMove = `left ${ms(slideFirst ? quick : whoosh)}ms ${
    slideFirst ? SWOOP_EASE_QUICK : SWOOP_EASE_WHOOSH
  }`;
  const topMove = `top ${ms(slideFirst ? whoosh : quick)}ms ${
    slideFirst ? SWOOP_EASE_WHOOSH : SWOOP_EASE_QUICK
  }`;

  // Shop waits for the ghost's picture before popping it (~40ms once cached,
  // which the timeline image always is). Capped: img.decode() never settles
  // in a hidden tab (measured), which left an invisible ghost parked on the
  // page that played late whenever you came back.
  const decoded = typeof img.decode === 'function' ? img.decode() : Promise.resolve();
  const ready = Promise.race([
    decoded,
    new Promise((r) => {
      setTimeout(r, 250);
    }),
  ]);
  ready.then(() => {
    // Reading offsetHeight commits the pop's start state (forced layout).
    if (ghost.offsetHeight < 0) clean();
    step(
      `transform ${ms(350 * all)}ms cubic-bezier(0.34,1.56,0.64,1), opacity ${ms(
        140 * all
      )}ms ease-out`,
      { opacity: '1', transform: 'scale(1)' }
    ); // pop
    at(tSettle1, settle);
    at(tSwoop, () =>
      step(
        `${leftMove}, ${topMove}, transform ${ms(shrink)}ms cubic-bezier(0.45,0,0.15,1)`,
        {
          left: `${tx - half}px`,
          top: `${to.top - half}px`,
          transform: `scale(${aboveScale})`,
        }
      )
    ); // swoop
    at(tSettle2, settle);
    at(tDrop, () =>
      step(
        `top ${ms(180 * all)}ms cubic-bezier(0.4,0,1,1), transform ${ms(180 * all)}ms cubic-bezier(0.4,0,1,1), opacity ${ms(180 * all)}ms ease-in`,
        {
          top: `${to.top + to.height / 2 - half}px`,
          transform: `scale(${inScale})`,
          opacity: '0.3',
        }
      )
    ); // drop in
    at(tFade, () => {
      step(`opacity ${ms(200 * all)}ms ease-in`, { opacity: '0' }); // fade
      if (typeof button.animate === 'function') {
        button.animate(
          [
            { transform: 'scale(1)', easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
            { transform: 'scale(1.3)', easing: 'cubic-bezier(0.34,1.56,0.64,1)' },
            { transform: 'scale(1)' },
          ],
          { duration: ms(400 * all) }
        ); // Shop's cartBounce
      }
    });
    at(tGone, clean);
  }, clean);
}

/*
 * A thumbnail lifts out of the picture, pauses, then sweeps clockwise into the
 * Download button and shrinks away.
 */
function swoopSpiral(media: HTMLImageElement, button: HTMLElement, s: SwoopSettings) {
  const src = mediaSrc(media);
  if (!src || typeof media.animate !== 'function') return;

  const from = media.getBoundingClientRect();
  const to = button.getBoundingClientRect();
  if (!from.width || !to.width) return;

  const max = Math.max(40, Number(s.size) || 200);
  const natW = media.naturalWidth || from.width;
  const natH = media.naturalHeight || from.height;
  const k = Math.min(max / natW, max / natH);
  const w = Math.max(24, Math.round(natW * k));
  const h = Math.max(24, Math.round(natH * k));

  const ghost = document.createElement('img');
  ghost.className = css.SwoopSpiralGhost;
  ghost.src = src;
  ghost.alt = '';
  ghost.style.width = `${w}px`;
  ghost.style.height = `${h}px`;
  document.body.appendChild(ghost);

  const start = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const end = { x: to.left + to.width / 2, y: to.top + to.height / 2 };

  const at = (x: number, y: number, scale: number) =>
    `translate(${Math.round(x - w / 2)}px, ${Math.round(y - h / 2)}px) scale(${scale})`;

  /*
   * A logarithmic spiral - the shape a nautilus shell makes - unwinding
   * clockwise from the middle of the picture and landing on the button.
   *
   *   r(t) = R * (e^(k*t) - 1) / (e^k - 1)
   *
   * which is 0 at the centre and exactly R at the end, so the last point IS
   * the button rather than something the animation has to be nudged towards.
   * The angle is offset by (bearing to the button - total sweep), which makes
   * the final approach come in straight at it.
   *
   * The path is sampled into many small steps instead of being described by a
   * handful of waypoints. Four waypoints with easing between them is what made
   * the first version turn square corners: the browser interpolates in a
   * straight line between whatever you give it, so curvature has to come from
   * the sampling, not from the easing.
   */
  const TURNS = 1.35;
  const SWEEP = TURNS * 2 * Math.PI;
  const TIGHTNESS = 2.6; // how sharply the spiral opens out
  const STEPS = 120;

  const span = Math.hypot(end.x - start.x, end.y - start.y);
  // y grows downward on screen, so an increasing angle reads as clockwise.
  const bearing = Math.atan2(end.y - start.y, end.x - start.x);
  const phase = bearing - SWEEP;
  const growth = Math.exp(TIGHTNESS) - 1;

  /*
   * Slow out of the beat, quick through the middle, easing into the button.
   * The samples are spaced evenly along the CURVE and it is their timing that
   * is eased - not the other way around.
   */
  const unglide = (u: number) =>
    u < 0.5 ? Math.cbrt(u / 4) : 1 - Math.cbrt(2 * (1 - u)) / 2;

  /*
   * It arrives as something, not as nothing. The thumbnail settles at roughly
   * the size of the button it is landing in rather than vanishing to a point,
   * so the end of the animation reads as the picture going INTO the button.
   */
  const endEdge = Math.max(12, Math.min(to.width, to.height) * 0.9);
  const endScale = Math.min(0.4, Math.max(0.06, endEdge / Math.max(w, h)));

  /*
   * The fade is held back until it is practically touching the button: 0.88 of
   * the animation's clock is 95% of the distance and 150ms from the end. At
   * both speeds on 100% that is the original 1250ms: 325ms of lift and bounce,
   * 925ms of travel, fading over the last 150ms.
   */
  const { all, flight } = swoopTiming(s);
  const liftMs = 325 * all;
  const travelMs = 925 * flight;
  const total = liftMs + travelMs;
  const FADE_FROM = 1 - (150 * flight) / total;

  const BEAT = liftMs / total; // the lift and bounce happen before any travel
  const frames: Keyframe[] = [
    { offset: 0, transform: at(start.x, start.y, 0.85), opacity: 0 },
    { offset: (125 * all) / total, transform: at(start.x, start.y, 1.1), opacity: 1 },
    { offset: (225 * all) / total, transform: at(start.x, start.y, 1), opacity: 1 },
    { offset: BEAT, transform: at(start.x, start.y, 1), opacity: 1 },
  ];

  for (let n = 1; n <= STEPS; n += 1) {
    const u = n / STEPS; // position along the spiral
    const theta = SWEEP * u;
    const radius = (span * (Math.exp(TIGHTNESS * u) - 1)) / growth;
    const x = start.x + radius * Math.cos(theta + phase);
    const y = start.y + radius * Math.sin(theta + phase);
    // Shrinking on the same curve as the travel keeps the two in step, so it
    // reads as receding rather than as two effects running side by side.
    const scale = 1 - (1 - endScale) * u;
    const offset = BEAT + (1 - BEAT) * unglide(u);
    frames.push({
      offset,
      transform: at(x, y, scale),
      opacity: offset > FADE_FROM ? Math.max(0, (1 - offset) / (1 - FADE_FROM)) : 1,
    });
  }
  frames[frames.length - 1] = {
    offset: 1,
    transform: at(end.x, end.y, endScale),
    opacity: 0,
  };

  const animation = ghost.animate(frames, {
    duration: Math.round(total),
    easing: 'linear',
    fill: 'forwards',
  });
  const clean = () => ghost.remove();
  animation.finished.then(clean, clean);
}

export function swoopToButton(media: HTMLElement, button: HTMLElement, s: SwoopSettings) {
  // No prefers-reduced-motion check: the toggle above IS the choice, made
  // deliberately, and a system-wide setting meant for the whole web should not
  // quietly override a switch you flipped for this one feature.
  if (document.hidden) return; // nobody to see it, and hidden tabs stall it (see swoopShop)
  const img = media instanceof HTMLImageElement ? media : media.querySelector('img');
  if (!img) return;
  if (s.style === 'spiral') swoopSpiral(img, button, s);
  else swoopShop(img, button, s.style === 'shopSlide', s);
}
