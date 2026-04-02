import * as Haptics from 'expo-haptics';

/**
 * Light tap — for subtle UI feedback (button taps, selections).
 */
export async function lightTap(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics not available on this device
  }
}

/**
 * Medium tap — for more prominent interactions (add to cart, confirm).
 */
export async function mediumTap(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Haptics not available on this device
  }
}

/**
 * Success notification — for order confirmed, payment success.
 */
export async function successNotification(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics not available on this device
  }
}

/**
 * Error notification — for payment failures, validation errors.
 */
export async function errorNotification(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Haptics not available on this device
  }
}
