import { create } from 'zustand';

interface SystemState {
  kioskIsOpen: boolean;
  toggleKiosk: () => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  kioskIsOpen: true,
  toggleKiosk: () => set((state) => ({ kioskIsOpen: !state.kioskIsOpen })),
}));
