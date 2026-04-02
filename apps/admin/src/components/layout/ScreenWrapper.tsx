import { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface ScreenWrapperProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  safeArea?: boolean;
}

export function ScreenWrapper({
  children,
  style,
  padded = true,
  safeArea = true,
}: ScreenWrapperProps) {
  const Wrapper = safeArea ? SafeAreaView : View;

  return (
    <Wrapper style={[styles.container, padded && styles.padded, style]}>
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.lg,
  },
});
