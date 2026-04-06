import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type Language } from '@/i18n/translations';

interface LocaleState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      language: 'es', // Spanish is the default for the kiosk
      setLanguage: (language) => set({ language }),
      toggleLanguage: () =>
        set((state) => ({
          language: state.language === 'es' ? 'en' : 'es',
        })),
    }),
    {
      name: 'kiki-locale-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
