import { create } from 'zustand';

interface ThemeState {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDark: true, // dark mode default per KIKI brand
  toggleTheme: () => set((state) => ({ isDark: !state.isDark })),
  setDark: (dark: boolean) => set({ isDark: dark }),
}));
