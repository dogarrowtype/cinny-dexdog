import { style } from '@vanilla-extract/css';
import { color, toRem } from 'folds';

export const SidebarResizeHandle = style({
  position: 'absolute',
  top: 0,
  bottom: 0,
  right: toRem(-5),
  width: toRem(9),
  cursor: 'col-resize',
  zIndex: 1,
  borderRight: `${toRem(2)} solid transparent`,
  selectors: {
    '&:hover, &:active': {
      borderRightColor: color.SurfaceVariant.ContainerActive,
    },
  },
});
