import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder } from 'react-native';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { config } from '@/constants/config';
import { navigationRef } from '@/navigation/navigationRef';

// Screens with their own idle/countdown behavior — Welcome has nothing to
// abandon, and ThankYou already runs its own auto-reset countdown.
const EXCLUDED_ROUTES = new Set(['Welcome', 'ThankYou']);

/**
 * Two-stage idle guard for the whole ordering flow (Directory, Menu, the
 * item customization modal, Checkout): after `idleWarningTimeout` of no
 * touch, shows a "¿Sigues ahí?" confirmation. If unanswered for another
 * `idleConfirmGracePeriod`, clears the cart/order and returns to Welcome.
 *
 * Mounted once at the app root (sibling of RootNavigator, see App.tsx) —
 * not per-screen — so a single timer pair survives navigation between
 * screens and nothing can be missed by forgetting to wire a screen up.
 *
 * Usage:
 * ```tsx
 * const { panHandlers, showModal, secondsLeft, confirmStillHere } = useIdleGuard();
 * return (
 *   <View {...panHandlers} style={{ flex: 1 }}>
 *     <RootNavigator />
 *     <IdleConfirmModal visible={showModal} secondsLeft={secondsLeft} onConfirm={confirmStillHere} />
 *   </View>
 * );
 * ```
 */
export function useIdleGuard() {
  const clearCart = useCartStore((s) => s.clearCart);
  const resetOrder = useOrderStore((s) => s.resetOrder);

  const [showModal, setShowModal] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted = useRef(true);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    warningTimerRef.current = null;
    graceIntervalRef.current = null;
  }, []);

  const resetToWelcome = useCallback(() => {
    clearAllTimers();
    if (!isMounted.current) return;
    setShowModal(false);
    clearCart();
    resetOrder();
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }
  }, [clearAllTimers, clearCart, resetOrder]);

  const startWarningTimer = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => {
      const routeName = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
      if (!routeName || EXCLUDED_ROUTES.has(routeName)) {
        // Not in the ordering flow right now (e.g. sitting on Welcome) —
        // keep watching instead of popping a confirmation nobody needs.
        startWarningTimer();
        return;
      }
      if (!isMounted.current) return;
      setShowModal(true);
      let remaining = Math.round(config.idleConfirmGracePeriod / 1000);
      setSecondsLeft(remaining);
      graceIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (!isMounted.current) return;
        setSecondsLeft(remaining);
        if (remaining <= 0) resetToWelcome();
      }, 1000);
    }, config.idleWarningTimeout);
  }, [resetToWelcome]);

  // A native <Modal> (see IdleConfirmModal) intercepts all touches while
  // presented — the PanResponder below simply never fires during that
  // window, so there's no need to special-case "ignore touches while the
  // modal is up" here.
  const registerActivity = useCallback(() => {
    startWarningTimer();
  }, [startWarningTimer]);

  const confirmStillHere = useCallback(() => {
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    graceIntervalRef.current = null;
    setShowModal(false);
    startWarningTimer();
  }, [startWarningTimer]);

  useEffect(() => {
    isMounted.current = true;
    startWarningTimer();
    return () => {
      isMounted.current = false;
      clearAllTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // PanResponder that resets the idle timer on any touch without capturing
  // the gesture (returns false so children still receive the touch).
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        registerActivity();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        registerActivity();
        return false;
      },
    }),
  ).current;

  return { panHandlers: panResponder.panHandlers, showModal, secondsLeft, confirmStillHere };
}
