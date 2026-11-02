/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import React, { useEffect, useRef } from 'react';
import FileSaver from 'file-saver';
import classNames from 'classnames';
import { Box, Chip, Header, Icon, IconButton, Icons, Text, as } from 'folds';
import * as css from './ImageViewer.css';
import { useZoom } from '../../hooks/useZoom';
import { usePan } from '../../hooks/usePan';
import { downloadMedia } from '../../utils/matrix';
import { MediaEventContent, saveMatrixMedia } from '../../utils/saneDownload';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';

export type ImageViewerProps = {
  alt: string;
  src: string;
  content?: MediaEventContent;
  requestClose: () => void;
};

export const ImageViewer = as<'div', ImageViewerProps>(
  ({ className, alt, src, content, requestClose, ...props }, ref) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [saneFilenames] = useSetting(settingsAtom, 'enhSaneFilenames');
    const [maxBaseName] = useSetting(settingsAtom, 'enhMaxBaseName');
    const [lightboxZoom] = useSetting(settingsAtom, 'enhLightboxZoom');
    const [hideLightboxDownload] = useSetting(settingsAtom, 'enhHideLightboxDownload');
    const { zoom, zoomIn, zoomOut, setZoom } = useZoom(0.2);
    const { pan, cursor, onMouseDown } = usePan(zoom !== 1);

    const initialZoomApplied = useRef(false);
    useEffect(() => {
      if (!initialZoomApplied.current && lightboxZoom > 100) {
        initialZoomApplied.current = true;
        setZoom(lightboxZoom / 100);
      }
    }, [lightboxZoom, setZoom]);

    const handleDownload = async () => {
      if (saneFilenames && content) {
        await saveMatrixMedia({
          mx,
          src,
          content,
          altText: alt,
          useAuthentication,
          maxBaseName,
        });
        return;
      }
      const fileContent = await downloadMedia(src);
      FileSaver.saveAs(fileContent, alt);
    };

    return (
      <Box
        className={classNames(css.ImageViewer, className)}
        direction="Column"
        {...props}
        ref={ref}
      >
        <Header className={css.ImageViewerHeader} size="400">
          <Box grow="Yes" alignItems="Center" gap="200">
            <IconButton size="300" radii="300" onClick={requestClose}>
              <Icon size="50" src={Icons.ArrowLeft} />
            </IconButton>
            <Text size="T300" truncate>
              {alt}
            </Text>
          </Box>
          <Box shrink="No" alignItems="Center" gap="200">
            <IconButton
              variant={zoom < 1 ? 'Success' : 'SurfaceVariant'}
              outlined={zoom < 1}
              size="300"
              radii="Pill"
              onClick={zoomOut}
              aria-label="Zoom Out"
            >
              <Icon size="50" src={Icons.Minus} />
            </IconButton>
            <Chip variant="SurfaceVariant" radii="Pill" onClick={() => setZoom(zoom === 1 ? 2 : 1)}>
              <Text size="B300">{Math.round(zoom * 100)}%</Text>
            </Chip>
            <IconButton
              variant={zoom > 1 ? 'Success' : 'SurfaceVariant'}
              outlined={zoom > 1}
              size="300"
              radii="Pill"
              onClick={zoomIn}
              aria-label="Zoom In"
            >
              <Icon size="50" src={Icons.Plus} />
            </IconButton>
            {!hideLightboxDownload && (
              <Chip
                variant="Primary"
                onClick={handleDownload}
                radii="300"
                before={<Icon size="50" src={Icons.Download} />}
              >
                <Text size="B300">Download</Text>
              </Chip>
            )}
          </Box>
        </Header>
        <Box
          grow="Yes"
          className={css.ImageViewerContent}
          justifyContent="Center"
          alignItems="Center"
        >
          <img
            className={css.ImageViewerImg}
            style={{
              cursor,
              transform: `scale(${zoom}) translate(${pan.translateX}px, ${pan.translateY}px)`,
            }}
            src={src}
            alt={alt}
            onMouseDown={onMouseDown}
          />
        </Box>
      </Box>
    );
  }
);
