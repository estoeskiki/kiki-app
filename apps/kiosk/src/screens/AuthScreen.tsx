import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '@/context/ThemeContext';
import { spacing, borderRadius } from '@/theme/spacing';
import { fonts, fontSizes } from '@/theme/typography';

export function DeviceAuthScreen() {
  const [token, setToken] = useState('');
  const { authenticate, isLoading, error } = useAuthStore();
  const { colors } = useTheme();

  const handleLinkDevice = async () => {
    if (!token.trim()) {
      Alert.alert('Error', 'Please enter a device token.');
      return;
    }
    const success = await authenticate(token.trim());
    if (!success) {
      Alert.alert(
        'Linking Failed',
        error || 'Invalid token. Please check the admin dashboard for valid tokens.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.inner}>
        {/* Wordmark */}
        <View style={styles.brand}>
          <Text style={[styles.wordmark, { color: colors.textPrimary }]}>KIKI</Text>
          <View style={[styles.brandBar, { backgroundColor: colors.primary }]} />
          <Text style={[styles.brandSub, { color: colors.textMuted }]}>Kiosk Setup</Text>
        </View>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Link This Device</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
            Enter the device token from your Kiki admin dashboard to activate this kiosk.
          </Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Device Token</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceContainer,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder="e.g. kiosk-abc123"
            placeholderTextColor={colors.textMuted}
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {error ? (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.button,
              { backgroundColor: colors.primary },
              isLoading && styles.buttonDisabled,
            ]}
            onPress={handleLinkDevice}
            disabled={isLoading}
            activeOpacity={0.82}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Link Device</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  inner: {
    paddingHorizontal: spacing['2xl'],
    gap: spacing['2xl'],
  },
  brand: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  wordmark: {
    fontFamily: fonts.heading,
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  brandBar: {
    width: 36,
    height: 3,
    borderRadius: 2,
  },
  brandSub: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  card: {
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    gap: spacing.md,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * 1.55,
    marginBottom: spacing.sm,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: -spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  },
  errorText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  button: {
    height: 56,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
    shadowColor: '#ccff00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.md,
    letterSpacing: -0.2,
  },
});
