import { useThemeStore } from '../store/useThemeStore';
import { darkTheme, lightTheme, type ThemeColors } from './themes';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const isDark = useThemeStore((s) => s.isDark);
  return {
    colors: isDark ? darkTheme : lightTheme,
    isDark,
  };
}
