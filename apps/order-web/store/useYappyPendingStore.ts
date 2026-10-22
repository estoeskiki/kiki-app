import { create } from 'zustand';
import { clearPending, readPending, writePending, type YappyPending } from '@/lib/yappy';

// The Yappy attempt the customer is currently waiting on. Mirrored to
// localStorage (lib/yappy.ts) so closing the tab mid-payment and coming back
// reopens the waiting overlay instead of inviting a second charge.
interface YappyPendingState {
  pending: YappyPending | null;
  // Status reported by the Yappy button itself (DENIED, CANCELLED…). Shown as
  // a hint only — the IPN is the source of truth.
  buttonHint: string | null;
  // Bumped when the customer chooses to retry, so checkout mints a new
  // checkoutKey (the old one belongs to the finished attempt).
  retryCount: number;
  hydrate: () => void;
  start: (pending: YappyPending) => void;
  setButtonHint: (hint: string | null) => void;
  finish: (opts?: { retry?: boolean }) => void;
}

export const useYappyPendingStore = create<YappyPendingState>((set) => ({
  pending: null,
  buttonHint: null,
  retryCount: 0,
  hydrate: () => set({ pending: readPending() }),
  start: (pending) => {
    writePending(pending);
    set({ pending, buttonHint: null });
  },
  setButtonHint: (buttonHint) => set({ buttonHint }),
  finish: (opts) => {
    clearPending();
    set((s) => ({ pending: null, buttonHint: null, retryCount: opts?.retry ? s.retryCount + 1 : s.retryCount }));
  },
}));
