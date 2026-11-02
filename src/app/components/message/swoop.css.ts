import { style } from '@vanilla-extract/css';

/*
 * Shop.app style ghost: a square box stepped by inline styles; the picture
 * fills it. Ported value-for-value from cinny-sane-downloader's stylesheet.
 */
export const SwoopShopGhost = style({
  position: 'fixed',
  zIndex: 2147482000,
  pointerEvents: 'none',
});

export const SwoopShopImg = style({
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: '20px',
  border: '0.5px solid rgba(255, 255, 255, 0.12)',
  boxShadow: '0 6px 16px rgba(0, 0, 0, 0.35)',
});

export const SwoopSpiralGhost = style({
  position: 'fixed',
  left: 0,
  top: 0,
  zIndex: 2147482000,
  pointerEvents: 'none',
  borderRadius: '6px',
  objectFit: 'cover',
  transformOrigin: 'center center',
  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
});
