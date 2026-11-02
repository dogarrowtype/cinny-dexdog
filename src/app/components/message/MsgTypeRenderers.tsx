import React, { CSSProperties, ReactNode, useRef } from 'react';
import { Box, Chip, Icon, Icons, Text, toRem } from 'folds';
import { IContent } from 'matrix-js-sdk';
import { JUMBO_EMOJI_REG, URL_REG } from '../../utils/regex';
import { trimReplyFromBody } from '../../utils/room';
import { MessageTextBody } from './layout';
import {
  MessageBadEncryptedContent,
  MessageBrokenContent,
  MessageDeletedContent,
  MessageEditedContent,
  MessageUnsupportedContent,
} from './content';
import {
  IAudioContent,
  IAudioInfo,
  IEncryptedFile,
  IFileContent,
  IFileInfo,
  IImageContent,
  IImageInfo,
  IThumbnailContent,
  IVideoContent,
  IVideoInfo,
  MATRIX_SPOILER_PROPERTY_NAME,
  MATRIX_SPOILER_REASON_PROPERTY_NAME,
} from '../../../types/matrix/common';
import { FALLBACK_MIMETYPE, getBlobSafeMimeType } from '../../utils/mimeTypes';
import { parseGeoUri, scaleYDimension } from '../../utils/common';
import { Attachment, AttachmentBox, AttachmentContent, AttachmentHeader } from './attachment';
import { FileHeader, FileDownloadButton } from './FileHeader';
import { MediaActions } from './MediaActions';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';
import * as msgTypeCss from './MsgTypeRenderers.css';

export function MBadEncrypted() {
  return (
    <Text>
      <MessageBadEncryptedContent />
    </Text>
  );
}

type RedactedContentProps = {
  reason?: string;
};
export function RedactedContent({ reason }: RedactedContentProps) {
  return (
    <Text>
      <MessageDeletedContent reason={reason} />
    </Text>
  );
}

export function UnsupportedContent() {
  return (
    <Text>
      <MessageUnsupportedContent />
    </Text>
  );
}

export function BrokenContent() {
  return (
    <Text>
      <MessageBrokenContent />
    </Text>
  );
}

type RenderBodyProps = {
  body: string;
  customBody?: string;
};
type MTextProps = {
  edited?: boolean;
  content: Record<string, unknown>;
  renderBody: (props: RenderBodyProps) => ReactNode;
  renderUrlsPreview?: (urls: string[]) => ReactNode;
  style?: CSSProperties;
};
export function MText({ edited, content, renderBody, renderUrlsPreview, style }: MTextProps) {
  const { body, formatted_body: customBody } = content;

  if (typeof body !== 'string') return <BrokenContent />;
  const trimmedBody = trimReplyFromBody(body);
  const urlsMatch = renderUrlsPreview && trimmedBody.match(URL_REG);
  const urls = urlsMatch ? [...new Set(urlsMatch)] : undefined;

  return (
    <>
      <MessageTextBody
        preWrap={typeof customBody !== 'string'}
        jumboEmoji={JUMBO_EMOJI_REG.test(trimmedBody)}
        style={style}
      >
        {renderBody({
          body: trimmedBody,
          customBody: typeof customBody === 'string' ? customBody : undefined,
        })}
        {edited && <MessageEditedContent />}
      </MessageTextBody>
      {renderUrlsPreview && urls && urls.length > 0 && renderUrlsPreview(urls)}
    </>
  );
}

type MEmoteProps = {
  displayName: string;
  edited?: boolean;
  content: Record<string, unknown>;
  renderBody: (props: RenderBodyProps) => ReactNode;
  renderUrlsPreview?: (urls: string[]) => ReactNode;
};
export function MEmote({
  displayName,
  edited,
  content,
  renderBody,
  renderUrlsPreview,
}: MEmoteProps) {
  const { body, formatted_body: customBody } = content;

  if (typeof body !== 'string') return <BrokenContent />;
  const trimmedBody = trimReplyFromBody(body);
  const urlsMatch = renderUrlsPreview && trimmedBody.match(URL_REG);
  const urls = urlsMatch ? [...new Set(urlsMatch)] : undefined;

  return (
    <>
      <MessageTextBody
        emote
        preWrap={typeof customBody !== 'string'}
        jumboEmoji={JUMBO_EMOJI_REG.test(trimmedBody)}
      >
        <b>{`${displayName} `}</b>
        {renderBody({
          body: trimmedBody,
          customBody: typeof customBody === 'string' ? customBody : undefined,
        })}
        {edited && <MessageEditedContent />}
      </MessageTextBody>
      {renderUrlsPreview && urls && urls.length > 0 && renderUrlsPreview(urls)}
    </>
  );
}

type MNoticeProps = {
  edited?: boolean;
  content: Record<string, unknown>;
  renderBody: (props: RenderBodyProps) => ReactNode;
  renderUrlsPreview?: (urls: string[]) => ReactNode;
};
export function MNotice({ edited, content, renderBody, renderUrlsPreview }: MNoticeProps) {
  const { body, formatted_body: customBody } = content;

  if (typeof body !== 'string') return <BrokenContent />;
  const trimmedBody = trimReplyFromBody(body);
  const urlsMatch = renderUrlsPreview && trimmedBody.match(URL_REG);
  const urls = urlsMatch ? [...new Set(urlsMatch)] : undefined;

  return (
    <>
      <MessageTextBody
        notice
        preWrap={typeof customBody !== 'string'}
        jumboEmoji={JUMBO_EMOJI_REG.test(trimmedBody)}
      >
        {renderBody({
          body: trimmedBody,
          customBody: typeof customBody === 'string' ? customBody : undefined,
        })}
        {edited && <MessageEditedContent />}
      </MessageTextBody>
      {renderUrlsPreview && urls && urls.length > 0 && renderUrlsPreview(urls)}
    </>
  );
}

type RenderImageContentProps = {
  body: string;
  filename?: string;
  info?: IImageInfo & IThumbnailContent;
  mimeType?: string;
  url: string;
  encInfo?: IEncryptedFile;
  markedAsSpoiler?: boolean;
  spoilerReason?: string;
};
type MImageProps = {
  content: IImageContent;
  renderImageContent: (props: RenderImageContentProps) => ReactNode;
  outlined?: boolean;
  mEventId?: string;
};
export function MImage({ content, renderImageContent, outlined, mEventId }: MImageProps) {
  const [mediaButtons] = useSetting(settingsAtom, 'enhMediaButtons');
  const [minImageHeight] = useSetting(settingsAtom, 'enhMinImageHeight');
  const [biggerMedia] = useSetting(settingsAtom, 'enhBiggerMedia');
  const [mediaMaxHeightVh] = useSetting(settingsAtom, 'enhMediaMaxHeightVh');
  const [upscaleSmallMedia] = useSetting(settingsAtom, 'enhUpscaleSmallMedia');
  const mediaRef = useRef<HTMLDivElement>(null);
  const imgInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  if (typeof mxcUrl !== 'string') {
    return <BrokenContent />;
  }
  const height = scaleYDimension(imgInfo?.w || 400, 400, imgInfo?.h || 400);
  const showActions =
    mediaButtons && (typeof imgInfo?.h !== 'number' || imgInfo.h >= minImageHeight);

  // Bigger media: widen the attachment past the 400px column cap and let
  // Cinny's own max-width:100% clamp it back, then size the box with the
  // event's aspect ratio and a vh-height cap instead of the fixed 400px-wide
  // height. Without upscaling, native dimensions are the ceiling.
  const natW = imgInfo?.w;
  const natH = imgInfo?.h;
  let biggerBoxStyle: CSSProperties | undefined;
  let biggerAttachmentStyle: CSSProperties | undefined;
  if (biggerMedia) {
    let maxWidth = '100%';
    if (!upscaleSmallMedia && natW) maxWidth = `min(100%, ${natW}px)`;
    biggerBoxStyle = {
      width: 'auto',
      height: 'auto',
      maxWidth: '100%',
      maxHeight: `${mediaMaxHeightVh}vh`,
      aspectRatio: natW && natH ? `${natW} / ${natH}` : undefined,
    };
    biggerAttachmentStyle = {
      width: '100vw',
      maxWidth,
      backgroundColor: 'transparent',
    };
  }

  return (
    <Attachment outlined={outlined} style={biggerAttachmentStyle}>
      <AttachmentBox
        ref={mediaRef}
        className={biggerMedia ? msgTypeCss.BiggerMediaBox : undefined}
        style={
          biggerBoxStyle ?? {
            height: toRem(height < 48 ? 48 : height),
          }
        }
      >
        {renderImageContent({
          body: content.body || 'Image',
          filename: content.filename,
          info: imgInfo,
          mimeType: imgInfo?.mimetype,
          url: mxcUrl,
          encInfo: content.file,
          markedAsSpoiler: content[MATRIX_SPOILER_PROPERTY_NAME],
          spoilerReason: content[MATRIX_SPOILER_REASON_PROPERTY_NAME],
        })}
      </AttachmentBox>
      {showActions && (
        <MediaActions
          mEventId={mEventId}
          content={content}
          mxcUrl={mxcUrl}
          mimeType={imgInfo?.mimetype ?? FALLBACK_MIMETYPE}
          encInfo={content.file}
          altText={content.body}
          mediaRef={mediaRef}
          copyable
        />
      )}
    </Attachment>
  );
}

type RenderVideoContentProps = {
  body: string;
  info: IVideoInfo & IThumbnailContent;
  mimeType: string;
  url: string;
  encInfo?: IEncryptedFile;
  markedAsSpoiler?: boolean;
  spoilerReason?: string;
};
type MVideoProps = {
  content: IVideoContent;
  renderAsFile: () => ReactNode;
  renderVideoContent: (props: RenderVideoContentProps) => ReactNode;
  outlined?: boolean;
  mEventId?: string;
};
export function MVideo({ content, renderAsFile, renderVideoContent, outlined, mEventId }: MVideoProps) {
  const [mediaButtons] = useSetting(settingsAtom, 'enhMediaButtons');
  const [includeVideo] = useSetting(settingsAtom, 'enhIncludeVideo');
  const [biggerMedia] = useSetting(settingsAtom, 'enhBiggerMedia');
  const [mediaMaxHeightVh] = useSetting(settingsAtom, 'enhMediaMaxHeightVh');
  const [upscaleSmallMedia] = useSetting(settingsAtom, 'enhUpscaleSmallMedia');
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  const safeMimeType = getBlobSafeMimeType(videoInfo?.mimetype ?? '');

  if (!videoInfo || !safeMimeType.startsWith('video') || typeof mxcUrl !== 'string') {
    if (mxcUrl) {
      return renderAsFile();
    }
    return <BrokenContent />;
  }

  const height = scaleYDimension(videoInfo.w || 400, 400, videoInfo.h || 400);

  const filename = content.filename ?? content.body ?? 'Video';

  const natW = videoInfo.w;
  const natH = videoInfo.h;
  let biggerBoxStyle: CSSProperties | undefined;
  let biggerAttachmentStyle: CSSProperties | undefined;
  if (biggerMedia) {
    let maxWidth = '100%';
    if (!upscaleSmallMedia && natW) maxWidth = `min(100%, ${natW}px)`;
    biggerBoxStyle = {
      width: 'auto',
      height: 'auto',
      maxWidth: '100%',
      maxHeight: `${mediaMaxHeightVh}vh`,
      aspectRatio: natW && natH ? `${natW} / ${natH}` : undefined,
    };
    biggerAttachmentStyle = {
      width: '100vw',
      maxWidth,
      backgroundColor: 'transparent',
    };
  }

  return (
    <Attachment outlined={outlined} style={biggerAttachmentStyle}>
      <AttachmentHeader>
        <FileHeader
          body={filename}
          mimeType={safeMimeType}
          after={
            <FileDownloadButton
              filename={filename}
              url={mxcUrl}
              mimeType={safeMimeType}
              encInfo={content.file}
              content={content}
            />
          }
        />
      </AttachmentHeader>
      <AttachmentBox
        ref={mediaRef}
        className={biggerMedia ? msgTypeCss.BiggerMediaBox : undefined}
        style={
          biggerBoxStyle ?? {
            height: toRem(height < 48 ? 48 : height),
          }
        }
      >
        {renderVideoContent({
          body: content.body || 'Video',
          info: videoInfo,
          mimeType: safeMimeType,
          url: mxcUrl,
          encInfo: content.file,
          markedAsSpoiler: content[MATRIX_SPOILER_PROPERTY_NAME],
          spoilerReason: content[MATRIX_SPOILER_REASON_PROPERTY_NAME],
        })}
      </AttachmentBox>
      {mediaButtons && includeVideo && (
        <MediaActions
          mEventId={mEventId}
          content={content}
          mxcUrl={mxcUrl}
          mimeType={safeMimeType}
          encInfo={content.file}
          altText={content.body}
          mediaRef={mediaRef}
        />
      )}
    </Attachment>
  );
}

type RenderAudioContentProps = {
  info: IAudioInfo;
  mimeType: string;
  url: string;
  encInfo?: IEncryptedFile;
};
type MAudioProps = {
  content: IAudioContent;
  renderAsFile: () => ReactNode;
  renderAudioContent: (props: RenderAudioContentProps) => ReactNode;
  outlined?: boolean;
};
export function MAudio({ content, renderAsFile, renderAudioContent, outlined }: MAudioProps) {
  const audioInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  const safeMimeType = getBlobSafeMimeType(audioInfo?.mimetype ?? '');

  if (!audioInfo || !safeMimeType.startsWith('audio') || typeof mxcUrl !== 'string') {
    if (mxcUrl) {
      return renderAsFile();
    }
    return <BrokenContent />;
  }

  const filename = content.filename ?? content.body ?? 'Audio';
  return (
    <Attachment outlined={outlined}>
      <AttachmentHeader>
        <FileHeader
          body={filename}
          mimeType={safeMimeType}
          after={
            <FileDownloadButton
              filename={filename}
              url={mxcUrl}
              mimeType={safeMimeType}
              encInfo={content.file}
              content={content}
            />
          }
        />
      </AttachmentHeader>
      <AttachmentBox>
        <AttachmentContent>
          {renderAudioContent({
            info: audioInfo,
            mimeType: safeMimeType,
            url: mxcUrl,
            encInfo: content.file,
          })}
        </AttachmentContent>
      </AttachmentBox>
    </Attachment>
  );
}

type RenderFileContentProps = {
  body: string;
  content: IFileContent;
  info: IFileInfo & IThumbnailContent;
  mimeType: string;
  url: string;
  encInfo?: IEncryptedFile;
};
type MFileProps = {
  content: IFileContent;
  renderFileContent: (props: RenderFileContentProps) => ReactNode;
  outlined?: boolean;
  mEventId?: string;
};
export function MFile({ content, renderFileContent, outlined, mEventId }: MFileProps) {
  const [mediaButtons] = useSetting(settingsAtom, 'enhMediaButtons');
  const [includeFiles] = useSetting(settingsAtom, 'enhIncludeFiles');
  const fileInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;

  if (typeof mxcUrl !== 'string') {
    return <BrokenContent />;
  }

  return (
    <Attachment outlined={outlined}>
      <AttachmentHeader>
        <FileHeader
          body={content.filename ?? content.body ?? 'Unnamed File'}
          mimeType={fileInfo?.mimetype ?? FALLBACK_MIMETYPE}
        />
      </AttachmentHeader>
      <AttachmentBox>
        <AttachmentContent>
          {renderFileContent({
            body: content.filename ?? content.body ?? 'File',
            content,
            info: fileInfo ?? {},
            mimeType: fileInfo?.mimetype ?? FALLBACK_MIMETYPE,
            url: mxcUrl,
            encInfo: content.file,
          })}
          {mediaButtons && includeFiles && (
            <MediaActions
              mEventId={mEventId}
              content={content}
              mxcUrl={mxcUrl}
              mimeType={fileInfo?.mimetype ?? FALLBACK_MIMETYPE}
              encInfo={content.file}
              altText={content.body}
            />
          )}
        </AttachmentContent>
      </AttachmentBox>
    </Attachment>
  );
}

type MLocationProps = {
  content: IContent;
};
export function MLocation({ content }: MLocationProps) {
  const geoUri = content.geo_uri;
  if (typeof geoUri !== 'string') return <BrokenContent />;
  const location = parseGeoUri(geoUri);
  if (!location) return <BrokenContent />;

  return (
    <Box direction="Column" alignItems="Start" gap="100">
      <Text size="T400">{geoUri}</Text>
      <Chip
        as="a"
        size="400"
        href={`https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`}
        target="_blank"
        rel="noreferrer noopener"
        variant="Primary"
        radii="Pill"
        before={<Icon src={Icons.External} size="50" />}
      >
        <Text size="B300">Open Location</Text>
      </Chip>
    </Box>
  );
}

type MStickerProps = {
  content: IImageContent;
  renderImageContent: (props: RenderImageContentProps) => ReactNode;
  mEventId?: string;
};
export function MSticker({ content, renderImageContent, mEventId }: MStickerProps) {
  const [mediaButtons] = useSetting(settingsAtom, 'enhMediaButtons');
  const [includeStickers] = useSetting(settingsAtom, 'enhIncludeStickers');
  const [expandStickers] = useSetting(settingsAtom, 'enhExpandStickers');
  const [mediaMaxHeightVh] = useSetting(settingsAtom, 'enhMediaMaxHeightVh');
  const [upscaleSmallMedia] = useSetting(settingsAtom, 'enhUpscaleSmallMedia');
  const mediaRef = useRef<HTMLDivElement>(null);
  const imgInfo = content?.info;
  const mxcUrl = content.file?.url ?? content.url;
  if (typeof mxcUrl !== 'string') {
    return <MessageBrokenContent />;
  }
  const height = scaleYDimension(imgInfo?.w || 152, 152, imgInfo?.h || 152);

  const natW = imgInfo?.w;
  const natH = imgInfo?.h;
  const expandStyle: CSSProperties | undefined =
    expandStickers && natW && natH
      ? {
          width: 'auto',
          height: 'auto',
          maxWidth: upscaleSmallMedia ? '100%' : `min(100%, ${natW}px)`,
          maxHeight: `${mediaMaxHeightVh}vh`,
          aspectRatio: `${natW} / ${natH}`,
        }
      : undefined;

  return (
    <Box direction="Column" alignItems="Start">
      <AttachmentBox
        ref={mediaRef}
        style={
          expandStyle ?? {
            height: toRem(height < 48 ? 48 : height),
            width: toRem(152),
          }
        }
      >
        {renderImageContent({
          body: content.body || 'Sticker',
          info: imgInfo,
          mimeType: imgInfo?.mimetype,
          url: mxcUrl,
          encInfo: content.file,
        })}
      </AttachmentBox>
      {mediaButtons && includeStickers && (
        <MediaActions
          mEventId={mEventId}
          content={content}
          mxcUrl={mxcUrl}
          mimeType={imgInfo?.mimetype ?? FALLBACK_MIMETYPE}
          encInfo={content.file}
          altText={content.body}
          mediaRef={mediaRef}
          copyable
        />
      )}
    </Box>
  );
}
