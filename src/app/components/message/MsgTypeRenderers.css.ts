import { globalStyle, style } from '@vanilla-extract/css';

// Bigger media: the box cross-stretches to the full attachment width and
// only its height is capped by the vh setting, so a taller-than-the cap
// image would be cropped by the default "object-fit: cover". Contain the
// media instead so the full picture stays visible (same as the original
// enhancement script's ".csd-box img/video { object-fit: contain }").
export const BiggerMediaBox = style({});

globalStyle(`${BiggerMediaBox} img, ${BiggerMediaBox} video`, {
  objectFit: 'contain',
});
