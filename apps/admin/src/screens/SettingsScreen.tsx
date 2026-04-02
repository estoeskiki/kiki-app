import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { Header } from '../components/layout/Header';
import { useSystemStore } from '../store/useSystemStore';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

export default function SettingsScreen() {
  const { kioskIsOpen, toggleKiosk } = useSystemStore();
  const { signOut, user, orgId, restaurantId } = useAuthStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateToken = async () => {
    if (!orgId || !restaurantId) {
      Alert.alert('Error de Configuración', 'No se puede determinar tu sucursal actual. No se puede generar un token.');
      return;
    }

    setIsGenerating(true);
    const newToken = `kiosk-${Math.random().toString(36).substring(2, 8)}`;

    const { error } = await supabase.from('device_tokens').insert({
      org_id: orgId,
      restaurant_id: restaurantId,
      device_name: `Automated Gen ${new Date().toLocaleDateString()}`,
      token_hash: newToken,
      is_active: true,
    });

    setIsGenerating(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('¡Token Generado!', `Anota esto: ${newToken}\n\n¡Puedes usar este token para iniciar sesión inmediatamente en una tablet Kiosko física para esta sucursal!`);
    }
  };

  return (
    <ScreenWrapper>
      <Header title="Configuración" />
      <View style={styles.content}>
        
        {/* Kiosk Controls */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Estado del Kiosko</Text>
            <Switch
              value={kioskIsOpen}
              onValueChange={toggleKiosk}
              trackColor={{ false: colors.surfaceHighlight, true: colors.success }}
              thumbColor={colors.textPrimary}
            />
          </View>
          <Text style={styles.cardDesc}>
            {kioskIsOpen 
               ? 'El kiosko está aceptando nuevas órdenes actualmente.' 
               : 'El kiosko está cerrado y mostrará un mensaje de "Cerrado" a los clientes.'}
          </Text>
        </View>

        {/* Device Management */}
        <View style={[styles.card, { marginTop: spacing.xl }]}>
          <Text style={styles.cardTitle}>Dispositivos de Kiosko</Text>
          <Text style={styles.cardDesc}>Genera un token de hardware seguro para vincular un nuevo iPad o tablet Android a esta sucursal específica.</Text>
          
          <TouchableOpacity 
            style={[styles.primaryButton, isGenerating && { opacity: 0.5 }]} 
            onPress={handleGenerateToken}
            disabled={isGenerating}
            activeOpacity={0.8}
          >
            {isGenerating ? <ActivityIndicator color={colors.background} /> : <Text style={styles.primaryButtonText}>Generar Token de Kiosko</Text>}
          </TouchableOpacity>
        </View>

        {/* Account Details & Logout */}
        <View style={[styles.card, { marginTop: spacing.xl }]}>
          <Text style={styles.cardTitle}>Cuenta</Text>
          <Text style={styles.cardDesc}>Sesión iniciada como: {user?.email}</Text>
          
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={() => signOut()}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)', // pale red
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.base,
    color: '#ef4444', // solid red
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonText: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.base,
    color: colors.background,
  },
});
