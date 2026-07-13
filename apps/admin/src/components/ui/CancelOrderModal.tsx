import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { fonts, fontSizes } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface CancelOrderModalProps {
  visible: boolean;
  orderNumber?: number;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelOrderModal({ visible, orderNumber, onClose, onConfirm }: CancelOrderModalProps) {
  const { colors } = useTheme();
  const [reason, setReason] = useState('');

  const canConfirm = reason.trim().length > 0;

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(reason.trim());
    setReason('');
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
      >
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Cancelar pedido{orderNumber ? ` #${orderNumber}` : ''}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Indica el motivo — el cliente lo verá en el seguimiento de su pedido.
          </Text>

          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Ej. nos quedamos sin ingredientes"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            autoFocus
            style={[
              styles.input,
              { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.textPrimary },
            ]}
          />

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, { borderColor: colors.borderLight }]}
              onPress={handleClose}
              activeOpacity={0.75}
            >
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: canConfirm ? colors.error : colors.borderLight }]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: canConfirm ? '#fff' : colors.textMuted }]}>Sí, cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * 1.4,
    marginTop: -spacing.sm,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
});
