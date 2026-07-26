import React from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Store, LogOut, ChevronRight,
} from 'lucide-react-native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useSystemStore } from '../store/useSystemStore';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../theme/useTheme';
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
  const { signOut, user, restaurantId, restaurantName, foodCourtName } = useAuthStore();
  const { colors } = useTheme();

  React.useEffect(() => {
    if (restaurantId) fetchKioskStatus(restaurantId);
  }, [restaurantId, fetchKioskStatus]);

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
          {(restaurantName || foodCourtName) && (
            <View style={styles.identity}>
              {foodCourtName && (
                <Text style={[styles.identityFoodCourt, { color: colors.primary }]}>{foodCourtName}</Text>
              )}
              {restaurantName && (
                <Text style={[styles.identityRestaurant, { color: colors.textPrimary }]}>{restaurantName}</Text>
              )}
            </View>
          )}
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
  identity: {
    marginTop: spacing.sm,
  },
  identityFoodCourt: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  identityRestaurant: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  pageSubtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: spacing.sm,
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
