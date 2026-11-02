import React, {
  ChangeEventHandler,
  KeyboardEventHandler,
  MouseEventHandler,
  useState,
} from 'react';
import {
  Box,
  Button,
  Chip,
  Icon,
  IconButton,
  Icons,
  Input,
  Menu,
  MenuItem,
  PopOut,
  RectCords,
  Scroll,
  Switch,
  Text,
  config,
  toRem,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import { isKeyHotkey } from 'is-hotkey';
import { Page, PageContent, PageHeader } from '../../../components/page';
import { SequenceCard } from '../../../components/sequence-card';
import { SettingTile } from '../../../components/setting-tile';
import { useSetting } from '../../../state/hooks/settings';
import { Settings, settingsAtom } from '../../../state/settings';
import { SequenceCardStyle } from '../styles.css';
import {
  clearDownloadLog,
  getDownloadLogCount,
} from '../../../utils/downloadMemory';
import { stopPropagation } from '../../../utils/keyboard';

type NumberSettingProps<K extends keyof Settings> = {
  setting: K;
  min: number;
  max: number;
  width?: number;
  after?: string;
  /** 0 restores the default-disabled behavior for the owning feature. */
  allowZero?: boolean;
};

function NumberSettingInput<K extends keyof Settings>({
  setting,
  min,
  max,
  width = 72,
  after,
  allowZero = true,
}: NumberSettingProps<K>) {
  const [value, setValue] = useSetting(settingsAtom, setting);
  const [current, setCurrent] = useState(`${value}`);
  const handleChange: ChangeEventHandler<HTMLInputElement> = (evt) => {
    setCurrent(evt.target.value);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (evt) => {
    if (isKeyHotkey('escape', evt)) {
      evt.stopPropagation();
      setCurrent(`${value}`);
    }
    if (
      isKeyHotkey('enter', evt) &&
      'value' in evt.target &&
      typeof evt.target.value === 'string'
    ) {
      const num = parseInt(evt.target.value, 10);
      if (Number.isNaN(num)) return;
      const low = allowZero ? Math.min(0, min) : min;
      const safe = Math.max(low, Math.min(num, max));
      setValue(safe as Settings[K]);
      setCurrent(`${safe}`);
    }
  };

  return (
    <Input
      style={{ width: toRem(width) }}
      variant={`${value}` === current ? 'Secondary' : 'Success'}
      size="300"
      radii="300"
      type="number"
      min={allowZero ? Math.min(0, min) : min}
      max={max}
      value={current}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      after={after && <Text size="T300">{after}</Text>}
      outlined
    />
  );
}

function SwoopStyleSelect() {
  const [style, setStyle] = useSetting(settingsAtom, 'enhSwoopStyle');
  const [menuCords, setMenuCords] = useState<RectCords>();
  const styles: Array<{ value: Settings['enhSwoopStyle']; name: string }> = [
    { value: 'shop', name: 'Shop (drop, then slide)' },
    { value: 'shopSlide', name: 'Shop (slide, then drop)' },
    { value: 'spiral', name: 'Spiral' },
  ];

  const handleMenu: MouseEventHandler<HTMLButtonElement> = (evt) => {
    setMenuCords(evt.currentTarget.getBoundingClientRect());
  };

  return (
    <>
      <Button
        size="300"
        variant="Secondary"
        outlined
        fill="Soft"
        radii="300"
        after={<Icon size="300" src={Icons.ChevronBottom} />}
        onClick={handleMenu}
      >
        <Text size="T300">{styles.find((i) => i.value === style)?.name ?? style}</Text>
      </Button>
      <PopOut
        anchor={menuCords}
        offset={5}
        position="Bottom"
        align="End"
        content={
          <FocusTrap
            focusTrapOptions={{
              initialFocus: false,
              onDeactivate: () => setMenuCords(undefined),
              clickOutsideDeactivates: true,
              isKeyForward: (evt: KeyboardEvent) =>
                evt.key === 'ArrowDown' || evt.key === 'ArrowRight',
              isKeyBackward: (evt: KeyboardEvent) => evt.key === 'ArrowUp' || evt.key === 'ArrowLeft',
              escapeDeactivates: stopPropagation,
            }}
          >
            <Menu>
              <Box direction="Column" gap="100" style={{ padding: config.space.S100 }}>
                {styles.map((item) => (
                  <MenuItem
                    key={item.value}
                    size="300"
                    variant={style === item.value ? 'Primary' : 'Surface'}
                    radii="300"
                    onClick={() => {
                      setStyle(item.value);
                      setMenuCords(undefined);
                    }}
                  >
                    <Text size="T300">{item.name}</Text>
                  </MenuItem>
                ))}
              </Box>
            </Menu>
          </FocusTrap>
        }
      />
    </>
  );
}

function DownloadMemory() {
  const [rememberDownloads, setRememberDownloads] = useSetting(
    settingsAtom,
    'enhRememberDownloads'
  );
  const [count, setCount] = useState(() => getDownloadLogCount());

  return (
    <Box direction="Column" gap="100">
      <Text size="L400">Download Memory</Text>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Remember Downloads"
          description="Mark attachments you have already downloaded with a tick."
          after={
            <Switch variant="Primary" value={rememberDownloads} onChange={setRememberDownloads} />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title="Forget After (days)"
          description="0 keeps the memory forever."
          after={
            <NumberSettingInput setting="enhDownloadMemoryDays" min={0} max={3650} />
          }
        />
      </SequenceCard>
      <SequenceCard className={SequenceCardStyle} variant="SurfaceVariant" direction="Column">
        <SettingTile
          title={`Remembered: ${count} attachments`}
          description="Oldest entries are dropped past 4000."
          after={
            <Chip
              variant="Secondary"
              fill="Soft"
              radii="300"
              onClick={() => {
                clearDownloadLog();
                setCount(0);
              }}
            >
              <Text size="B300">Clear All</Text>
            </Chip>
          }
        />
      </SequenceCard>
    </Box>
  );
}

type EnhancementsProps = {
  requestClose: () => void;
};
export function Enhancements({ requestClose }: EnhancementsProps) {
  const [saneFilenames, setSaneFilenames] = useSetting(settingsAtom, 'enhSaneFilenames');
  const [mediaButtons, setMediaButtons] = useSetting(settingsAtom, 'enhMediaButtons');
  const [showCopyButton, setShowCopyButton] = useSetting(settingsAtom, 'enhShowCopyButton');
  const [includeVideo, setIncludeVideo] = useSetting(settingsAtom, 'enhIncludeVideo');
  const [includeStickers, setIncludeStickers] = useSetting(settingsAtom, 'enhIncludeStickers');
  const [includeFiles, setIncludeFiles] = useSetting(settingsAtom, 'enhIncludeFiles');
  const [swoop, setSwoop] = useSetting(settingsAtom, 'enhSwoop');
  const [captionOnSend, setCaptionOnSend] = useSetting(settingsAtom, 'enhCaptionOnSend');
  const [mergePickerButtons, setMergePickerButtons] = useSetting(
    settingsAtom,
    'enhMergePickerButtons'
  );
  const [pickerFill, setPickerFill] = useSetting(settingsAtom, 'enhPickerFill');
  const [biggerMedia, setBiggerMedia] = useSetting(settingsAtom, 'enhBiggerMedia');
  const [upscaleSmallMedia, setUpscaleSmallMedia] = useSetting(
    settingsAtom,
    'enhUpscaleSmallMedia'
  );
  const [expandStickers, setExpandStickers] = useSetting(settingsAtom, 'enhExpandStickers');
  const [replyThumbs, setReplyThumbs] = useSetting(settingsAtom, 'enhReplyThumbs');
  const [hideLightboxDownload, setHideLightboxDownload] = useSetting(
    settingsAtom,
    'enhHideLightboxDownload'
  );
  const [sidebarResize, setSidebarResize] = useSetting(settingsAtom, 'enhSidebarResize');
  const [dragRescue, setDragRescue] = useSetting(settingsAtom, 'enhDragRescue');

  return (
    <Page>
      <PageHeader outlined={false}>
        <Box grow="Yes" gap="200">
          <Box grow="Yes" alignItems="Center" gap="200">
            <Text size="H3" truncate>
              Enhancements
            </Text>
          </Box>
          <Box shrink="No">
            <IconButton onClick={requestClose} variant="Surface">
              <Icon src={Icons.Cross} />
            </IconButton>
          </Box>
        </Box>
      </PageHeader>
      <Box grow="Yes">
        <Scroll hideTrack visibility="Hover">
          <PageContent>
            <Box direction="Column" gap="700">
              <Box direction="Column" gap="100">
                <Text size="L400">Saving & Buttons</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Download & Copy Buttons"
                    description="Buttons under every timeline image and video."
                    after={
                      <Switch variant="Primary" value={mediaButtons} onChange={setMediaButtons} />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Copy Image Button"
                    after={
                      <Switch variant="Primary" value={showCopyButton} onChange={setShowCopyButton} />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Buttons on Videos"
                    after={<Switch variant="Primary" value={includeVideo} onChange={setIncludeVideo} />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Buttons on Stickers"
                    after={
                      <Switch
                        variant="Primary"
                        value={includeStickers}
                        onChange={setIncludeStickers}
                      />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Buttons on File Cards"
                    after={<Switch variant="Primary" value={includeFiles} onChange={setIncludeFiles} />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Minimum Image Height"
                    description="Skip tiny images so emotes don't get buttons."
                    after={<NumberSettingInput setting="enhMinImageHeight" min={1} max={1024} after="px" />}
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Filenames</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Sane Filenames"
                    description="Save downloads with the attachment's real filename; the extension comes from the file's own bytes."
                    after={
                      <Switch variant="Primary" value={saneFilenames} onChange={setSaneFilenames} />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Maximum Name Length"
                    after={<NumberSettingInput setting="enhMaxBaseName" min={8} max={200} />}
                  />
                </SequenceCard>
              </Box>

              <DownloadMemory />

              <Box direction="Column" gap="100">
                <Text size="L400">Animation</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Save Swoop"
                    description="Thumbnail flies into the download button when you save."
                    after={<Switch variant="Primary" value={swoop} onChange={setSwoop} />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile title="Swoop Style" after={<SwoopStyleSelect />} />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Hold (ms)"
                    after={<NumberSettingInput setting="enhSwoopHold" min={0} max={2000} after="ms" />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Speed"
                    description="100% as captured; 200% is twice as fast."
                    after={<NumberSettingInput setting="enhSwoopSpeed" min={10} max={400} after="%" />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Flight Speed"
                    after={
                      <NumberSettingInput setting="enhSwoopFlightSpeed" min={10} max={400} after="%" />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Ghost Size"
                    after={<NumberSettingInput setting="enhSwoopSize" min={40} max={600} after="px" />}
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Bigger Media</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Bigger Media"
                    description="Images and videos size to the chat column instead of 400px."
                    after={<Switch variant="Primary" value={biggerMedia} onChange={setBiggerMedia} />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Maximum Height"
                    after={
                      <NumberSettingInput setting="enhMediaMaxHeightVh" min={10} max={100} after="vh" />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Upscale Small Media"
                    description="Let media grow past its native dimensions."
                    after={
                      <Switch
                        variant="Primary"
                        value={upscaleSmallMedia}
                        onChange={setUpscaleSmallMedia}
                      />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Expand Stickers"
                    after={
                      <Switch variant="Primary" value={expandStickers} onChange={setExpandStickers} />
                    }
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Composer</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Image with Caption as One Message"
                    description="A single upload plus a typed message sends the text as the caption. Spoiler-marked uploads still send as two messages."
                    after={
                      <Switch variant="Primary" value={captionOnSend} onChange={setCaptionOnSend} />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Merged Picker Buttons"
                    description="One composer button: click for emoji, SHIFT+click or right-click for stickers."
                    after={
                      <Switch
                        variant="Primary"
                        value={mergePickerButtons}
                        onChange={setMergePickerButtons}
                      />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Picker Fills Chat Pane"
                    after={<Switch variant="Primary" value={pickerFill} onChange={setPickerFill} />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Picker Gap"
                    after={<NumberSettingInput setting="enhPickerGap" min={0} max={100} after="px" />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Picker Max Width (0 = fill)"
                    after={
                      <NumberSettingInput setting="enhPickerMaxWidth" min={0} max={2000} after="px" />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Emoji Tile Size (0 = default)"
                    after={
                      <NumberSettingInput setting="enhPickerEmojiSize" min={0} max={96} after="px" />
                    }
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Replies</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Reply Thumbnails"
                    description="Show a small thumbnail when quoting a picture or video."
                    after={<Switch variant="Primary" value={replyThumbs} onChange={setReplyThumbs} />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Thumbnail Size"
                    after={<NumberSettingInput setting="enhReplyThumbSize" min={12} max={200} after="px" />}
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Image Viewer</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Open Zoomed"
                    description="Zoom level when an image opens; 100% is stock."
                    after={<NumberSettingInput setting="enhLightboxZoom" min={100} max={500} after="%" />}
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Hide Download Button"
                    description="The media buttons under every image are right there anyway."
                    after={
                      <Switch
                        variant="Primary"
                        value={hideLightboxDownload}
                        onChange={setHideLightboxDownload}
                      />
                    }
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Room List</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Resizable Sidebar"
                    description="Drag the room list's right edge; double-click to reset."
                    after={
                      <Switch variant="Primary" value={sidebarResize} onChange={setSidebarResize} />
                    }
                  />
                </SequenceCard>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Compact Below"
                    description="Hide room avatars when the sidebar is narrower than this."
                    after={
                      <NumberSettingInput setting="enhSidebarCompactAt" min={0} max={400} after="px" />
                    }
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Reactions</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Reaction Emoji Size (0 = default)"
                    after={
                      <NumberSettingInput setting="enhReactionEmojiSize" min={0} max={64} after="px" />
                    }
                  />
                </SequenceCard>
              </Box>

              <Box direction="Column" gap="100">
                <Text size="L400">Drag & Drop</Text>
                <SequenceCard
                  className={SequenceCardStyle}
                  variant="SurfaceVariant"
                  direction="Column"
                >
                  <SettingTile
                    title="Drag Drop Rescue"
                    description="Only real file drags summon the drop overlay, and it always leaves: Escape, leaving the window, or dropping clears it."
                    after={<Switch variant="Primary" value={dragRescue} onChange={setDragRescue} />}
                  />
                </SequenceCard>
              </Box>
            </Box>
          </PageContent>
        </Scroll>
      </Box>
    </Page>
  );
}
