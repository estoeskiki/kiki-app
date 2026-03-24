import { useEffect, useRef, useCallback } from 'react';
import { PanResponder } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useCartStore } from '@/store/useCartStore';
import { useOrderStore } from '@/store/useOrderStore';
import { config } from '@/constants/config';

/**
 * Hook that resets the kiosk back to the Welcome screen
 * after `config.idleTimeout` ms of no touch events.
 *
 * Usage: call `useAutoReset()` in any screen where idle-reset
 * should be active (typically all screens except Welcome & ThankYou).
 *
 * Returns a PanResponder's `panHandlers` that should be spread
 * onto the root View of the screen so touch events reset the timer:
 *
 * ```tsx
 * const { panHandlers } = useAutoReset();
 * return <View {...panHandlers}>...</View>;
 * ```
 */
export function useAutoReset() {
    const navigation = useNavigation<any>();
    const clearCart = useCartStore((s) => s.clearCart);
    const resetOrder = useOrderStore((s) => s.resetOrder);

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isMounted = useRef(true);

    // Get the current route name so we can skip reset on Welcome/ThankYou
    const currentRoute = useNavigationState(
        (state) => state.routes[state.index]?.name,
    );

    const resetToWelcome = useCallback(() => {
        if (!isMounted.current) return;
        clearCart();
        resetOrder();
        navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
    }, [clearCart, resetOrder, navigation]);

    const restartTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current);

        // Don't auto-reset when already on Welcome or ThankYou (ThankYou has its own countdown)
        if (currentRoute === 'Welcome' || currentRoute === 'ThankYou') return;

        timerRef.current = setTimeout(resetToWelcome, config.idleTimeout);
    }, [currentRoute, resetToWelcome]);

    // Start / restart timer on mount and when the route changes
    useEffect(() => {
        isMounted.current = true;
        restartTimer();

        return () => {
            isMounted.current = false;
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [restartTimer]);

    // PanResponder that resets idle timer on any touch without capturing the gesture
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponderCapture: () => {
                restartTimer();
                return false; // don't steal touches from children
            },
            onMoveShouldSetPanResponderCapture: () => {
                restartTimer();
                return false;
            },
        }),
    ).current;

    return { panHandlers: panResponder.panHandlers, restartTimer };
}
