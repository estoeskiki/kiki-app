import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (value: boolean) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      isDark: false, // Light mode default for kiosk
      toggleTheme: () => set((s) => ({ isDark: !s.isDark })),
      setDark: (value) => set({ isDark: value }),
    }),
    {
      name: 'kiosk-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
