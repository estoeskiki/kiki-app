import { create } from 'zustand';

interface LanguageModalState {
  visible: boolean;
  open: () => void;
  close: () => void;
}

export const useLanguageModalStore = create<LanguageModalState>((set) => ({
  visible: false,
  open: () => set({ visible: true }),
  close: () => set({ visible: false }),
}));
