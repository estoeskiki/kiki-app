import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrderStatus } from '../../data/types';
import { colors } from '../../theme/colors';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let backgroundColor = colors.surfaceHighlight;
  let textColor = colors.textSecondary;
  let label = status.toUpperCase();

  switch (status) {
    case 'confirmed':
      backgroundColor = colors.primary;
      textColor = colors.background;
      label = 'NEW';
      break;
    case 'preparing':
      backgroundColor = colors.secondary;
      textColor = colors.background;
      break;
    case 'ready':
      backgroundColor = colors.success;
      textColor = colors.background;
      break;
    case 'completed':
      backgroundColor = colors.surfaceHighlight;
      textColor = colors.textSecondary;
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={[styles.text, { color: textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
});
