import { Box, Icon, Icons, Text, as, color, toRem } from 'folds';
import { EventTimelineSet, MsgType, Room, EventType } from 'matrix-js-sdk';
import React, { MouseEventHandler, ReactNode, useCallback, useMemo } from 'react';
import classNames from 'classnames';
import { getMemberDisplayName, trimReplyFromBody } from '../../utils/room';
import { getMxIdLocalPart, mxcUrlToHttp } from '../../utils/matrix';
import { LinePlaceholder } from './placeholder';
import { randomNumberBetween } from '../../utils/common';
import * as css from './Reply.css';
import { MessageBadEncryptedContent, MessageDeletedContent, MessageFailedContent } from './content';
import { scaleSystemEmoji } from '../../plugins/react-custom-html-parser';
import { useRoomEvent } from '../../hooks/useRoomEvent';
import colorMXID from '../../../util/colorMXID';
import { GetMemberPowerTag } from '../../hooks/useMemberPowerTag';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useMediaAuthentication } from '../../hooks/useMediaAuthentication';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

type ReplyLayoutProps = {
  userColor?: string;
  username?: ReactNode;
};
export const ReplyLayout = as<'div', ReplyLayoutProps>(
  ({ username, userColor, className, children, ...props }, ref) => (
    <Box
      className={classNames(css.Reply, className)}
      alignItems="Center"
      gap="100"
      {...props}
      ref={ref}
    >
      <Box style={{ color: userColor, maxWidth: toRem(200) }} alignItems="Center" shrink="No">
        <Icon size="100" src={Icons.ReplyArrow} />
        {username}
      </Box>
      <Box grow="Yes" className={css.ReplyContent}>
        {children}
      </Box>
    </Box>
  )
);

export const ThreadIndicator = as<'div'>(({ ...props }, ref) => (
  <Box
    shrink="No"
    className={css.ThreadIndicator}
    alignItems="Center"
    gap="100"
    {...props}
    ref={ref}
  >
    <Icon size="50" src={Icons.Thread} />
    <Text size="L400">Thread</Text>
  </Box>
));

type ReplyProps = {
  room: Room;
  timelineSet?: EventTimelineSet | undefined;
  replyEventId: string;
  threadRootId?: string | undefined;
  onClick?: MouseEventHandler | undefined;
  getMemberPowerTag?: GetMemberPowerTag;
  accessibleTagColors?: Map<string, string>;
  legacyUsernameColor?: boolean;
};

export const Reply = as<'div', ReplyProps>(
  (
    {
      room,
      timelineSet,
      replyEventId,
      threadRootId,
      onClick,
      getMemberPowerTag,
      accessibleTagColors,
      legacyUsernameColor,
      ...props
    },
    ref
  ) => {
    const mx = useMatrixClient();
    const useAuthentication = useMediaAuthentication();
    const [replyThumbs] = useSetting(settingsAtom, 'enhReplyThumbs');
    const [replyThumbSize] = useSetting(settingsAtom, 'enhReplyThumbSize');

    const placeholderWidth = useMemo(() => randomNumberBetween(40, 400), []);
    const getFromLocalTimeline = useCallback(
      () => timelineSet?.findEventById(replyEventId),
      [timelineSet, replyEventId]
    );
    const replyEvent = useRoomEvent(room, replyEventId, getFromLocalTimeline);

    const { body } = replyEvent?.getContent() ?? {};

    // Reply thumbnail: quotes of pictures show a small server-generated
    // thumbnail in front of the quoted text. Silent fallback to no thumbnail
    // (missing/scrolled-out event, encrypted-only content, weird content).
    const replyThumb = useMemo(() => {
      if (!replyThumbs || !replyEvent) return undefined;
      const content = replyEvent.getContent();
      const isMedia =
        replyEvent.getType() === EventType.Sticker ||
        content.msgtype === MsgType.Image ||
        content.msgtype === MsgType.Video;
      if (!isMedia) return undefined;
      // Encrypted rooms carry only content.file; keep it simple and skip.
      if (typeof content.url !== 'string') return undefined;
      const displayPx = Math.max(12, Math.min(200, replyThumbSize || 36));
      // Ask for roughly twice the displayed size so it stays crisp on hidpi.
      // The cheap tier is square; 128 is the ceiling worth asking for.
      const want = displayPx <= 48 ? 96 : 128;
      const url = mxcUrlToHttp(mx, content.url, useAuthentication, want, want, 'scale', false);
      if (!url) return undefined;
      const info = content.info as { w?: number; h?: number } | undefined;
      const aspectRatio =
        want > 96 && info && info.w && info.h && info.w > 0 && info.h > 0
          ? `${info.w} / ${info.h}`
          : '1 / 1';
      return { url, displayPx, aspectRatio };
    }, [mx, replyEvent, replyThumbs, replyThumbSize, useAuthentication]);
    const sender = replyEvent?.getSender();
    const powerTag = sender ? getMemberPowerTag?.(sender) : undefined;
    const tagColor = powerTag?.color ? accessibleTagColors?.get(powerTag.color) : undefined;

    const usernameColor = legacyUsernameColor ? colorMXID(sender ?? replyEventId) : tagColor;

    const fallbackBody = replyEvent?.isRedacted() ? (
      <MessageDeletedContent />
    ) : (
      <MessageFailedContent />
    );

    const badEncryption = replyEvent?.getContent().msgtype === 'm.bad.encrypted';
    const bodyJSX = body ? scaleSystemEmoji(trimReplyFromBody(body)) : fallbackBody;

    return (
      <Box direction="Row" gap="200" alignItems="Center" {...props} ref={ref}>
        {threadRootId && (
          <ThreadIndicator as="button" data-event-id={threadRootId} onClick={onClick} />
        )}
        <ReplyLayout
          as="button"
          userColor={usernameColor}
          username={
            sender && (
              <Text size="T300" truncate>
                <b>{getMemberDisplayName(room, sender) ?? getMxIdLocalPart(sender)}</b>
              </Text>
            )
          }
          data-event-id={replyEventId}
          onClick={onClick}
        >
          {replyEvent !== undefined ? (
            <Box alignItems="Center" gap="100" style={{ minWidth: 0 }}>
              {replyThumb && (
                <img
                  src={replyThumb.url}
                  alt=""
                  loading="lazy"
                  style={{
                    display: 'block',
                    height: toRem(replyThumb.displayPx),
                    aspectRatio: replyThumb.aspectRatio,
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                />
              )}
              <Text size="T300" truncate>
                {badEncryption ? <MessageBadEncryptedContent /> : bodyJSX}
              </Text>
            </Box>
          ) : (
            <LinePlaceholder
              style={{
                backgroundColor: color.SurfaceVariant.ContainerActive,
                width: toRem(placeholderWidth),
                maxWidth: '100%',
              }}
            />
          )}
        </ReplyLayout>
      </Box>
    );
  }
);
