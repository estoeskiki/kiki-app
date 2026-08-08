import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Lets code outside the navigator (the idle guard, mounted as a sibling of
// RootNavigator so its timers survive across screens) read the current route
// and trigger a reset without needing a screen's own `navigation` prop.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
