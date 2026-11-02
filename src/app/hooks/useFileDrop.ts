import { useCallback, DragEventHandler, RefObject, useState, useEffect, useRef } from 'react';
import { getDataTransferFiles } from '../utils/dom';
import { useSetting } from '../state/hooks/settings';
import { settingsAtom } from '../state/settings';

export const useFileDropHandler = (onDrop: (file: File[]) => void): DragEventHandler =>
  useCallback(
    (evt) => {
      const files = getDataTransferFiles(evt.dataTransfer);
      if (files) onDrop(files);
    },
    [onDrop]
  );

export const useFileDropZone = (
  zoneRef: RefObject<HTMLElement>,
  onDrop: (file: File[]) => void
): boolean => {
  const [dragRescue] = useSetting(settingsAtom, 'enhDragRescue');
  const dragStateRef = useRef<'start' | 'leave' | 'over'>();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const target = zoneRef.current;
    const handleDrop = (evt: DragEvent) => {
      evt.preventDefault();
      dragStateRef.current = undefined;
      setActive(false);
      if (!evt.dataTransfer) return;
      const files = getDataTransferFiles(evt.dataTransfer);
      if (files) onDrop(files);
    };

    target?.addEventListener('drop', handleDrop);
    return () => {
      target?.removeEventListener('drop', handleDrop);
    };
  }, [zoneRef, onDrop]);

  // Legacy behavior: kept verbatim for when drag rescue is switched off.
  useEffect(() => {
    const target = zoneRef.current;
    if (!target || dragRescue) return undefined;

    const handleDragEnter = (evt: DragEvent) => {
      if (evt.dataTransfer?.types.includes('Files')) {
        dragStateRef.current = 'start';
        setActive(true);
      }
    };
    const handleDragLeave = () => {
      if (dragStateRef.current !== 'over') return;
      dragStateRef.current = 'leave';
      setActive(false);
    };
    const handleDragOver = (evt: DragEvent) => {
      evt.preventDefault();
      dragStateRef.current = 'over';
    };

    target.addEventListener('dragenter', handleDragEnter);
    target.addEventListener('dragleave', handleDragLeave);
    target.addEventListener('dragover', handleDragOver);
    return () => {
      target.removeEventListener('dragenter', handleDragEnter);
      target.removeEventListener('dragleave', handleDragLeave);
      target.removeEventListener('dragover', handleDragOver);
    };
  }, [zoneRef, dragRescue]);

  // Rescued behavior: only file drags summon the overlay (so pushing an image
  // around inside the timeline never does), and every way a drag can end clears
  // it: a dragleave counter, a dragover-silence watchdog (the one that covers
  // the drag ending outside the window), Escape, dragend and window blur.
  useEffect(() => {
    const target = zoneRef.current;
    if (!target || !dragRescue) return undefined;

    let depth = 0;
    let lastDragActivity = 0;
    let watchdog: ReturnType<typeof setInterval> | undefined;

    const hasFiles = (evt: DragEvent) =>
      !!evt.dataTransfer && Array.from(evt.dataTransfer.types).includes('Files');

    const stopWatchdog = () => {
      if (watchdog) {
        clearInterval(watchdog);
        watchdog = undefined;
      }
    };
    const clear = () => {
      depth = 0;
      dragStateRef.current = undefined;
      stopWatchdog();
      setActive(false);
    };

    const noteDragActivity = () => {
      lastDragActivity = Date.now();
      if (watchdog) return;
      // dragover keeps firing while a drag is live, even stationary. When it
      // goes quiet the drag is over, however it ended - including ending
      // outside the window, which is the case that strands the overlay.
      watchdog = setInterval(() => {
        if (Date.now() - lastDragActivity < 900) return;
        clear();
      }, 300);
    };

    const handleDragEnter = (evt: DragEvent) => {
      if (!hasFiles(evt)) return;
      depth += 1;
      dragStateRef.current = 'start';
      setActive(true);
      noteDragActivity();
    };
    const handleDragLeave = (evt: DragEvent) => {
      if (!hasFiles(evt)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        dragStateRef.current = 'leave';
        clear();
      }
    };
    const handleDragOver = (evt: DragEvent) => {
      if (!hasFiles(evt)) return;
      evt.preventDefault();
      dragStateRef.current = 'over';
      noteDragActivity();
    };
    const handleDragEnd = () => clear();
    const handleBlur = () => clear();
    const handleEscape = (evt: KeyboardEvent) => {
      if (evt.key !== 'Escape' || depth === 0) return;
      evt.stopPropagation();
      clear();
    };

    target.addEventListener('dragenter', handleDragEnter);
    target.addEventListener('dragleave', handleDragLeave);
    target.addEventListener('dragover', handleDragOver);
    document.addEventListener('dragend', handleDragEnd, true);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('keydown', handleEscape, true);
    return () => {
      stopWatchdog();
      target.removeEventListener('dragenter', handleDragEnter);
      target.removeEventListener('dragleave', handleDragLeave);
      target.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('dragend', handleDragEnd, true);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [zoneRef, dragRescue]);

  return active;
};
