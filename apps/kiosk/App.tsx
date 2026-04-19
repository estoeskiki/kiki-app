import 'react-native-reanimated';
import { useCallback, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Syne_400Regular,
  Syne_600SemiBold,
  Syne_700Bold,
} from '@expo-google-fonts/syne';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from '@/navigation/RootNavigator';
import { DeviceAuthScreen } from '@/screens/AuthScreen';
import { useAuthStore } from '@/store/useAuthStore';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import { LanguageModal } from '@/components/layout/LanguageModal';
import { StoreClosedOverlay } from '@/components/layout/StoreClosedOverlay';
import { useRestaurantStore } from '@/store/useRestaurantStore';

SplashScreen.preventAutoHideAsync();

// Inner component so it can read theme from context
function AppInner() {
  const { colors, isDark } = useTheme();
  const { deviceToken, isLoading, initialize } = useAuthStore();
  const { isOpen } = useRestaurantStore();

  useEffect(() => { initialize(); }, [initialize]);

  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.primary,
    },
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {deviceToken ? (
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
          {!isOpen && <StoreClosedOverlay />}
        </NavigationContainer>
      ) : (
        <DeviceAuthScreen />
      )}
      <LanguageModal />
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Syne_400Regular,
    Syne_600SemiBold,
    Syne_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <View style={styles.fullScreen} onLayout={onLayoutRootView}>
      <ThemeProvider>
        <AppInner />
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  container: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
