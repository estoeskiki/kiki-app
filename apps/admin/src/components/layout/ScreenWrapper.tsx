import { ReactNode } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/useTheme';

interface ScreenWrapperProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  safeArea?: boolean;
}

export function ScreenWrapper({
  children,
  style,
  safeArea = true,
}: ScreenWrapperProps) {
  const { colors } = useTheme();
  const Wrapper = safeArea ? SafeAreaView : View;

  return (
    <Wrapper style={[styles.container, { backgroundColor: colors.background }, style]}>
      {children}
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
