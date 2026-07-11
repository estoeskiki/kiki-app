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
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/useTheme';
import { spacing, borderRadius } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

export function AuthScreen() {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa correo electrónico y contraseña.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Error al Iniciar Sesión', error.message);
    setLoading(false);
  };

  const shadowStyle = isDark
    ? { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12 }
    : { shadowColor: '#060e1d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Top header */}
      <Text style={styles.headerWordmark}>kiki</Text>

      <View style={[styles.card, shadowStyle, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Bienvenido de vuelta</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Inicia sesión para gestionar tu restaurante
        </Text>

        {/* Email */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>CORREO ELECTRÓNICO</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="admin@kikiapp.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>CONTRASEÑA</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.textPrimary }]}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.primary }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.onPrimary} />
            : <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Iniciar Sesión</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text style={[styles.footer, { color: colors.textMuted }]}>
        Powered by <Text style={{ color: colors.primary, fontFamily: fonts.heading, letterSpacing: -0.4 }}>kiki</Text>
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xl,
  },
  headerWordmark: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -1.5,
    textAlign: 'center',
    color: '#ccff00',
  },
  card: {
    borderRadius: borderRadius['2xl'],
    padding: spacing['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * 1.5,
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  },
  button: {
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    letterSpacing: -0.2,
  },
});
