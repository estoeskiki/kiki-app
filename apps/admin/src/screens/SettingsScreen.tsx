import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import {
  Store, Smartphone, LogOut, Moon, Sun, ChevronRight, Copy,
} from 'lucide-react-native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { TablesSection } from '../components/settings/TablesSection';
import { useSystemStore } from '../store/useSystemStore';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import { useTheme } from '../theme/useTheme';
import { supabase } from '../lib/supabase';
import { spacing, borderRadius } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[sStyles.sectionLabel, { color: colors.textMuted }]}>{label}</Text>
  );
}

function SettingsRow({
  icon,
  label,
  sublabel,
  right,
  onPress,
  destructive,
  first,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  first?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        sStyles.row,
        {
          backgroundColor: colors.surface,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.borderLight,
          borderRadius: first && last ? borderRadius.lg : first ? 0 : last ? 0 : 0,
        },
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[sStyles.iconWrap, { backgroundColor: destructive ? 'rgba(239,68,68,0.1)' : colors.surfaceHighlight }]}>
        {icon}
      </View>
      <View style={sStyles.rowContent}>
        <Text style={[sStyles.rowLabel, { color: destructive ? colors.error : colors.textPrimary }]}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[sStyles.rowSublabel, { color: colors.textMuted }]}>{sublabel}</Text>
        ) : null}
      </View>
      {right ?? (onPress ? <ChevronRight color={colors.textMuted} size={16} strokeWidth={2} /> : null)}
    </TouchableOpacity>
  );
}

function CardGroup({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[sStyles.group, { borderColor: colors.borderLight }]}>
      {children}
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const { kioskIsOpen, toggleKiosk, fetchKioskStatus } = useSystemStore();
  const { signOut, user, orgId, restaurantId } = useAuthStore();
  const { isDark, toggleTheme } = useThemeStore();
  const { colors } = useTheme();
  const [isGenerating, setIsGenerating] = useState(false);

  React.useEffect(() => {
    if (restaurantId) fetchKioskStatus(restaurantId);
  }, [restaurantId, fetchKioskStatus]);

  const handleGenerateToken = async () => {
    if (!orgId || !restaurantId) {
      Alert.alert('Error de Configuración', 'No se puede determinar tu sucursal. No se puede generar un token.');
      return;
    }
    setIsGenerating(true);
    const newToken = `kiosk-${Math.random().toString(36).substring(2, 8)}`;
    const { error } = await supabase.from('device_tokens').insert({
      org_id: orgId,
      restaurant_id: restaurantId,
      device_name: `Generado ${new Date().toLocaleDateString('es')}`,
      token_hash: newToken,
      is_active: true,
    });
    setIsGenerating(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert(
        'Token Generado',
        `${newToken}\n\nUsa este token para vincular una nueva tablet kiosko a esta sucursal.`,
        [{ text: 'Copiar y Cerrar', onPress: () => {} }, { text: 'OK' }]
      );
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <View style={[styles.pageHeader, { borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Ajustes</Text>
          <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            {user?.email}
          </Text>
        </View>

        {/* ── Kiosco ── */}
        <SectionLabel label="KIOSCO" />
        <CardGroup>
          <SettingsRow
            first
            last
            icon={<Store color={kioskIsOpen ? colors.success : colors.textMuted} size={18} strokeWidth={2} />}
            label="Estado del Kiosco"
            sublabel={kioskIsOpen ? 'Aceptando órdenes' : 'Cerrado para clientes'}
            right={
              <Switch
                value={kioskIsOpen}
                onValueChange={() => {
                  if (restaurantId) toggleKiosk(restaurantId);
                }}
                disabled={!restaurantId}
                trackColor={{ false: colors.surfaceHighlight, true: colors.success }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.surfaceHighlight}
              />
            }
          />
        </CardGroup>

        {/* ── Dispositivos ── */}
        <SectionLabel label="DISPOSITIVOS" />
        <CardGroup>
          <SettingsRow
            first
            last
            icon={
              isGenerating
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Smartphone color={colors.primary} size={18} strokeWidth={2} />
            }
            label="Generar Token de Kiosco"
            sublabel="Vincula un nuevo iPad o tablet Android"
            onPress={isGenerating ? undefined : handleGenerateToken}
          />
        </CardGroup>

        {/* ── Mesas (QR para ordenar desde la web) ── */}
        <SectionLabel label="MESAS" />
        <TablesSection />

        {/* ── Apariencia ── */}
        <SectionLabel label="APARIENCIA" />
        <CardGroup>
          <SettingsRow
            first
            last
            icon={isDark
              ? <Moon color={colors.tertiary} size={18} strokeWidth={2} />
              : <Sun color={colors.warning} size={18} strokeWidth={2} />
            }
            label={isDark ? 'Modo Oscuro' : 'Modo Claro'}
            sublabel="Cambia la apariencia de la app"
            right={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.tertiary }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            }
          />
        </CardGroup>

        {/* ── Cuenta ── */}
        <SectionLabel label="CUENTA" />
        <CardGroup>
          <SettingsRow
            first
            last
            icon={<LogOut color={colors.error} size={18} strokeWidth={2} />}
            label="Cerrar Sesión"
            destructive
            onPress={() => signOut()}
          />
        </CardGroup>

        {/* Version */}
        <Text style={[styles.version, { color: colors.textMuted }]}>Kiki Admin · v1.0.0</Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    paddingBottom: spacing['3xl'],
  },
  pageHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 3,
  },
  version: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

const sStyles = StyleSheet.create({
  sectionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.8,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  group: {
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
    minHeight: 60,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
  },
  rowSublabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});
