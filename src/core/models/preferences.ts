export type ThemeMode = 'dark' | 'light' | 'system';
export type FontSize = 'small' | 'medium' | 'large';

export interface UserPreferences {
  theme: ThemeMode;
  extensionEnabled: boolean;
  fontSize: FontSize;
  hideOriginalPage: boolean;
  autoCopyExampleOnClick: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'dark',
  extensionEnabled: true,
  fontSize: 'medium',
  hideOriginalPage: true,
  autoCopyExampleOnClick: true,
};
