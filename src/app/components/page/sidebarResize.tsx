import React, { CSSProperties, useCallback, useRef } from 'react';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import * as css from './sidebarResize.css';

const STOCK_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 140;
const toPx = (width: number) => `${width}px`;

/**
 * Resizable room-list sidebar: a drag handle on the nav's right edge sets an
 * inline override width (min 140, max 50vw), persisted to enhSidebarWidth;
 * double-click resets back to the stock recipe width (0). When the effective
 * width drops below enhSidebarCompactAt the consumer can tag the nav with
 * data-enh-sidebar-compact, which static CSS uses to hide room avatars.
 */
export function useSidebarResize(): {
  active: boolean;
  width?: number;
  compact: boolean;
  navStyle: CSSProperties;
  onPointerDown: (evt: React.PointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
} {
  const screenSize = useScreenSizeContext();
  const [resizeEnabled] = useSetting(settingsAtom, 'enhSidebarResize');
  const [sidebarWidth, setSidebarWidth] = useSetting(settingsAtom, 'enhSidebarWidth');
  const [compactAt] = useSetting(settingsAtom, 'enhSidebarCompactAt');

  const active = resizeEnabled && screenSize !== ScreenSize.Mobile;

  const clamp = useCallback(
    (width: number) =>
      Math.max(MIN_SIDEBAR_WIDTH, Math.min(Math.round(width), window.innerWidth / 2)),
    []
  );

  const width =
    active && sidebarWidth > 0
      ? clamp(sidebarWidth)
      : undefined;

  const compact = active && (width ?? STOCK_SIDEBAR_WIDTH) < compactAt;

  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (evt: React.PointerEvent<HTMLElement>) => {
      evt.preventDefault();
      const handle = evt.currentTarget;
      dragRef.current = {
        startX: evt.clientX,
        startWidth: width ?? STOCK_SIDEBAR_WIDTH,
      };
      handle.setPointerCapture(evt.pointerId);

      const handleMove = (moveEvt: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        setSidebarWidth(clamp(drag.startWidth + moveEvt.clientX - drag.startX));
      };
      const handleUp = (upEvt: PointerEvent) => {
        dragRef.current = null;
        if (handle.hasPointerCapture(upEvt.pointerId)) handle.releasePointerCapture(upEvt.pointerId);
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [width, clamp, setSidebarWidth]
  );

  const onDoubleClick = useCallback(() => {
    setSidebarWidth(0);
  }, [setSidebarWidth]);

  const navStyle: CSSProperties = {
    position: 'relative',
    ...(width ? { width: toPx(width) } : {}),
  };

  return { active, width, compact, navStyle, onPointerDown, onDoubleClick };
}

export function SidebarResizeHandle() {
  const { active, onPointerDown, onDoubleClick } = useSidebarResize();
  if (!active) return null;
  return (
    <div
      className={css.SidebarResizeHandle}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    />
  );
}
