import { style } from '@vanilla-extract/css';

// Hidden when the room-list sidebar is cranked below its compact threshold
// (data-enh-sidebar-compact on the nav), leaving just the room names.
export const CompactAvatar = style({
  selectors: {
    '[data-enh-sidebar-compact] &': {
      display: 'none',
    },
  },
});
