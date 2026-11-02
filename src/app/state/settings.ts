import { atom } from 'jotai';

const STORAGE_KEY = 'settings';
export type DateFormat =
  | 'D MMM YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY/MM/DD'
  | 'YYYY-MM-DD'
  | '';
export type MessageSpacing = '0' | '100' | '200' | '300' | '400' | '500';
export enum MessageLayout {
  Modern = 0,
  Compact = 1,
  Bubble = 2,
}

export interface Settings {
  themeId?: string;
  useSystemTheme: boolean;
  lightThemeId?: string;
  darkThemeId?: string;
  monochromeMode?: boolean;
  isMarkdown: boolean;
  editorToolbar: boolean;
  twitterEmoji: boolean;
  pageZoom: number;
  hideActivity: boolean;

  isPeopleDrawer: boolean;
  memberSortFilterIndex: number;
  enterForNewline: boolean;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  hideMembershipEvents: boolean;
  hideNickAvatarEvents: boolean;
  mediaAutoLoad: boolean;
  urlPreview: boolean;
  encUrlPreview: boolean;
  showHiddenEvents: boolean;
  legacyUsernameColor: boolean;

  showNotifications: boolean;
  isNotificationSounds: boolean;

  hour24Clock: boolean;
  dateFormatString: string;

  developerTools: boolean;

  // Enhancements (ported from cinny-sane-downloader userscript)
  enhSaneFilenames: boolean;
  enhMediaButtons: boolean;
  enhShowCopyButton: boolean;
  enhIncludeVideo: boolean;
  enhIncludeStickers: boolean;
  enhIncludeFiles: boolean;
  enhMinImageHeight: number;
  enhMaxBaseName: number;
  enhRememberDownloads: boolean;
  enhDownloadMemoryDays: number;
  enhSwoop: boolean;
  enhSwoopStyle: 'shop' | 'shopSlide' | 'spiral';
  enhSwoopHold: number;
  enhSwoopFlightSpeed: number;
  enhSwoopSpeed: number;
  enhSwoopSize: number;
  enhCaptionOnSend: boolean;
  enhDragRescue: boolean;
  enhBiggerMedia: boolean;
  enhMediaMaxHeightVh: number;
  enhUpscaleSmallMedia: boolean;
  enhExpandStickers: boolean;
  enhPickerFill: boolean;
  enhPickerGap: number;
  enhPickerMaxWidth: number;
  enhPickerEmojiSize: number;
  enhMergePickerButtons: boolean;
  enhReplyThumbs: boolean;
  enhReplyThumbSize: number;
  enhLightboxZoom: number;
  enhHideLightboxDownload: boolean;
  enhSidebarResize: boolean;
  enhSidebarWidth: number;
  enhSidebarCompactAt: number;
  enhReactionEmojiSize: number;
}

const defaultSettings: Settings = {
  themeId: undefined,
  useSystemTheme: true,
  lightThemeId: undefined,
  darkThemeId: undefined,
  monochromeMode: false,
  isMarkdown: true,
  editorToolbar: false,
  twitterEmoji: false,
  pageZoom: 100,
  hideActivity: false,

  isPeopleDrawer: true,
  memberSortFilterIndex: 0,
  enterForNewline: false,
  messageLayout: 0,
  messageSpacing: '400',
  hideMembershipEvents: false,
  hideNickAvatarEvents: true,
  mediaAutoLoad: true,
  urlPreview: true,
  encUrlPreview: false,
  showHiddenEvents: false,
  legacyUsernameColor: false,

  showNotifications: true,
  isNotificationSounds: true,

  hour24Clock: false,
  dateFormatString: 'D MMM YYYY',

  developerTools: false,

  enhSaneFilenames: true,
  enhMediaButtons: true,
  enhShowCopyButton: true,
  enhIncludeVideo: true,
  enhIncludeStickers: false,
  enhIncludeFiles: false,
  enhMinImageHeight: 64,
  enhMaxBaseName: 96,
  enhRememberDownloads: true,
  enhDownloadMemoryDays: 0,
  enhSwoop: false,
  enhSwoopStyle: 'shop',
  enhSwoopHold: 200,
  enhSwoopFlightSpeed: 100,
  enhSwoopSpeed: 100,
  enhSwoopSize: 200,
  enhCaptionOnSend: true,
  enhDragRescue: true,
  enhBiggerMedia: true,
  enhMediaMaxHeightVh: 80,
  enhUpscaleSmallMedia: false,
  enhExpandStickers: false,
  enhPickerFill: false,
  enhPickerGap: 16,
  enhPickerMaxWidth: 0,
  enhPickerEmojiSize: 0,
  enhMergePickerButtons: true,
  enhReplyThumbs: true,
  enhReplyThumbSize: 36,
  enhLightboxZoom: 200,
  enhHideLightboxDownload: true,
  enhSidebarResize: true,
  enhSidebarWidth: 0,
  enhSidebarCompactAt: 200,
  enhReactionEmojiSize: 0,
};

export const getSettings = () => {
  const settings = localStorage.getItem(STORAGE_KEY);
  if (settings === null) return defaultSettings;
  return {
    ...defaultSettings,
    ...(JSON.parse(settings) as Settings),
  };
};

export const setSettings = (settings: Settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const baseSettings = atom<Settings>(getSettings());
export const settingsAtom = atom<Settings, [Settings], undefined>(
  (get) => get(baseSettings),
  (get, set, update) => {
    set(baseSettings, update);
    setSettings(update);
  }
);
