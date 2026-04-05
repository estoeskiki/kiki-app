import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrderStatus } from '../../data/types';
import { useTheme } from '../../theme/useTheme';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const { colors } = useTheme();

  const config: Record<string, { bg: string; text: string; label: string }> = {
    confirmed:  { bg: colors.statusConfirmedBg,  text: colors.statusConfirmedText,  label: 'NUEVO' },
    preparing:  { bg: colors.statusPreparingBg,  text: colors.statusPreparingText,  label: 'EN COCINA' },
    ready:      { bg: colors.statusReadyBg,       text: colors.statusReadyText,      label: 'LISTO' },
    completed:  { bg: colors.statusCompletedBg,   text: colors.statusCompletedText,  label: 'COMPLETADO' },
    failed:     { bg: 'rgba(239,68,68,0.12)',      text: colors.error,                label: 'FALLIDO' },
  };

  const c = config[status] ?? config.completed;

  return (
    <View style={[styles.badge, size === 'sm' && styles.badgeSm, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, size === 'sm' && styles.textSm, { color: c.text }]}>
        {c.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.6,
  },
  textSm: {
    fontSize: 10,
  },
});
