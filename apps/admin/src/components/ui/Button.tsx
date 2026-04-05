import { ReactNode } from 'react';
import { Text, StyleSheet, StyleProp, ViewStyle, TextStyle, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: ReactNode;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const variantStyle: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary:   { bg: colors.primary,                        text: colors.onPrimary },
    secondary: { bg: 'transparent',                         text: colors.primary,    border: colors.primary },
    ghost:     { bg: 'transparent',                         text: colors.primary },
    danger:    { bg: colors.error,                          text: '#ffffff' },
  };

  const vs = variantStyle[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        sizeStyles[size],
        {
          backgroundColor: vs.bg,
          borderWidth: vs.border ? 1.5 : 0,
          borderColor: vs.border,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.text} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              textSizeStyles[size],
              { color: vs.text },
              icon ? styles.textWithIcon : null,
              textStyle,
            ]}
          >
            {children}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
  },
  fullWidth: { width: '100%' },
  disabled: { opacity: 0.5 },
  text: {
    fontFamily: fonts.bodySemiBold,
    textAlign: 'center',
  },
  textWithIcon: { marginLeft: spacing.sm },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingVertical: spacing.sm,   paddingHorizontal: spacing.base, minHeight: 40 },
  md: { paddingVertical: spacing.md,   paddingHorizontal: spacing.lg,   minHeight: 48 },
  lg: { paddingVertical: spacing.base, paddingHorizontal: spacing.xl,   minHeight: 56 },
  xl: { paddingVertical: spacing.lg,   paddingHorizontal: spacing['2xl'], minHeight: 72 },
});

const textSizeStyles = StyleSheet.create({
  sm: { fontSize: fontSizes.sm },
  md: { fontSize: fontSizes.base },
  lg: { fontSize: fontSizes.md },
  xl: { fontSize: fontSizes.lg },
});
