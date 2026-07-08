import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Plus, QrCode, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useTheme } from '../../theme/useTheme';
import { spacing, borderRadius } from '../../theme/spacing';
import { fonts, fontSizes } from '../../theme/typography';
import { ORDER_WEB_BASE_URL } from '../../constants/orderWeb';

interface TableRow {
  id: string;
  label: string;
  qr_token: string;
  is_active: boolean;
}

// Tables are scoped to this restaurant. Food-court-wide shared tables
// (spanning multiple stalls) are managed at the venue level, not here —
// see docs/web-ordering-plan.md.
export function TablesSection() {
  const { restaurantId } = useAuthStore();
  const { colors } = useTheme();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [qrTable, setQrTable] = useState<TableRow | null>(null);

  const fetchTables = async () => {
    if (!restaurantId) return;
    const { data, error } = await supabase
      .from('tables')
      .select('id, label, qr_token, is_active')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true });
    if (!error && data) setTables(data as TableRow[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTables();
  }, [restaurantId]);

  const handleAddTable = async () => {
    const label = newLabel.trim();
    if (!label || !restaurantId) return;
    setIsAdding(true);
    const { error } = await supabase.from('tables').insert({ restaurant_id: restaurantId, label });
    setIsAdding(false);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    setNewLabel('');
    fetchTables();
  };

  const qrUrl = qrTable ? `${ORDER_WEB_BASE_URL}/t/${qrTable.qr_token}` : '';

  return (
    <View style={[styles.group, { borderColor: colors.borderLight }]}>
      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        tables.map((table) => (
          <TouchableOpacity
            key={table.id}
            style={[styles.row, { borderTopColor: colors.borderLight }]}
            onPress={() => setQrTable(table)}
            activeOpacity={0.65}
          >
            <View style={[styles.iconWrap, { backgroundColor: colors.surfaceHighlight }]}>
              <QrCode color={colors.primary} size={18} strokeWidth={2} />
            </View>
            <Text style={[styles.rowLabel, { color: colors.textPrimary, flex: 1 }]}>{table.label}</Text>
            <Text style={[styles.rowSublabel, { color: colors.textMuted }]}>Ver QR</Text>
          </TouchableOpacity>
        ))
      )}

      <View style={[styles.addRow, { borderTopColor: colors.borderLight }]}>
        <TextInput
          value={newLabel}
          onChangeText={setNewLabel}
          placeholder="Nueva mesa (ej. Mesa 12)"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceHighlight }]}
          onSubmitEditing={handleAddTable}
          returnKeyType="done"
        />
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary, opacity: newLabel.trim() ? 1 : 0.5 }]}
          onPress={handleAddTable}
          disabled={!newLabel.trim() || isAdding}
        >
          {isAdding ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <Plus color={colors.onPrimary} size={18} strokeWidth={2.5} />}
        </TouchableOpacity>
      </View>

      <Modal visible={!!qrTable} animationType="fade" transparent onRequestClose={() => setQrTable(null)}>
        <View style={styles.overlay}>
          <View style={[styles.qrCard, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setQrTable(null)}>
              <X color={colors.textPrimary} size={20} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>{qrTable?.label}</Text>
            {qrTable && (
              <View style={styles.qrWrap}>
                <QRCode value={qrUrl} size={220} />
              </View>
            )}
            <Text style={[styles.qrUrl, { color: colors.textMuted }]}>{qrUrl}</Text>
            <Text style={[styles.qrHint, { color: colors.textMuted }]}>
              Imprime este código y colócalo en la mesa. Los clientes lo escanean para ordenar desde su teléfono.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: spacing.base,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  loading: { paddingVertical: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.base,
    gap: spacing.md,
    minHeight: 56,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base },
  rowSublabel: { fontFamily: fonts.body, fontSize: fontSizes.xs },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  qrCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 340,
  },
  closeBtn: { position: 'absolute', top: spacing.md, right: spacing.md },
  qrTitle: { fontFamily: fonts.heading, fontSize: fontSizes.xl, letterSpacing: -0.4 },
  qrWrap: { padding: spacing.md, backgroundColor: '#fff', borderRadius: borderRadius.md },
  qrUrl: { fontFamily: fonts.body, fontSize: fontSizes.xs, textAlign: 'center' },
  qrHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, textAlign: 'center' },
});
