import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Plus, X, Trash2, Star } from 'lucide-react-native';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useMenuStore } from '../store/useMenuStore';
import { MenuItem, CustomizationGroup, CustomizationOption } from '../data/types';
import { formatCurrency } from '../utils/formatCurrency';
import { useTheme } from '../theme/useTheme';
import { spacing, borderRadius } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.base * 2 - CARD_GAP) / 2;

// ─── Types ───────────────────────────────────────────────────────────────────

type EditingCustomization = {
  id: string;
  name: string;
  required: boolean;
  maxSelections: number;
  options: { id: string; name: string; priceModifier: string }[];
};

type EditingItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  categoryId: string;
  available: boolean;
  popular: boolean;
  customizations: EditingCustomization[];
};

const EMPTY_ITEM: EditingItem = {
  id: '',
  name: '',
  description: '',
  price: '',
  categoryId: '',
  available: true,
  popular: false,
  customizations: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function MenuScreen() {
  const { items, categories, isLoading, fetchMenu, toggleItemAvailability, addItem, updateItem, deleteItem } = useMenuStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(EMPTY_ITEM);
  const [isNewItem, setIsNewItem] = useState(false);
  const { colors, isDark } = useTheme();

  React.useEffect(() => { fetchMenu(); }, [fetchMenu]);

  React.useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) setSelectedCategoryId(categories[0].id);
  }, [categories, selectedCategoryId]);

  const filteredItems = useMemo(
    () => items.filter((i) => i.categoryId === selectedCategoryId),
    [items, selectedCategoryId]
  );

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  const openAddModal = () => {
    setEditingItem({ ...EMPTY_ITEM, categoryId: selectedCategoryId });
    setIsNewItem(true);
    setEditModalVisible(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem({
      id: item.id,
      name: item.name,
      description: item.description,
      price: (item.price / 100).toFixed(2),
      categoryId: item.categoryId,
      available: item.available,
      popular: item.popular,
      customizations: item.customizations.map((cg) => ({
        id: cg.id,
        name: cg.name,
        required: cg.required,
        maxSelections: cg.maxSelections,
        options: cg.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceModifier: (o.priceModifier / 100).toFixed(2),
        })),
      })),
    });
    setIsNewItem(false);
    setEditModalVisible(true);
  };

  // ─── Customization helpers ──────────────────────────────────────────────────

  const addCustomizationGroup = () => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: [
        ...prev.customizations,
        { id: `cg-${Date.now()}`, name: '', required: false, maxSelections: 1, options: [] },
      ],
    }));
  };

  const updateCustomizationGroup = (cgId: string, updates: Partial<EditingCustomization>) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) => cg.id === cgId ? { ...cg, ...updates } : cg),
    }));
  };

  const removeCustomizationGroup = (cgId: string) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.filter((cg) => cg.id !== cgId),
    }));
  };

  const addOption = (cgId: string) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId
          ? { ...cg, options: [...cg.options, { id: `opt-${Date.now()}`, name: '', priceModifier: '0.00' }] }
          : cg
      ),
    }));
  };

  const updateOption = (cgId: string, optId: string, updates: Partial<{ name: string; priceModifier: string }>) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId
          ? { ...cg, options: cg.options.map((o) => (o.id === optId ? { ...o, ...updates } : o)) }
          : cg
      ),
    }));
  };

  const removeOption = (cgId: string, optId: string) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId ? { ...cg, options: cg.options.filter((o) => o.id !== optId) } : cg
      ),
    }));
  };

  // ─── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const { name, description, price, categoryId } = editingItem;
    if (!name.trim()) { Alert.alert('Error', 'El nombre del artículo es requerido.'); return; }
    const priceInCents = Math.round(parseFloat(price || '0') * 100);
    if (isNaN(priceInCents) || priceInCents < 0) { Alert.alert('Error', 'Ingresa un precio válido.'); return; }

    const customizations: CustomizationGroup[] = editingItem.customizations
      .filter((cg) => cg.name.trim())
      .map((cg) => ({
        id: cg.id,
        name: cg.name.trim(),
        required: cg.required,
        maxSelections: cg.maxSelections,
        options: cg.options.filter((o) => o.name.trim()).map((o) => ({
          id: o.id,
          name: o.name.trim(),
          priceModifier: Math.round(parseFloat(o.priceModifier || '0') * 100),
        })),
      }));

    if (isNewItem) {
      addItem({
        name: name.trim(), description: description.trim(), price: priceInCents,
        categoryId: categoryId || categories[0]?.id || '', image: '',
        available: editingItem.available, popular: editingItem.popular, customizations,
      });
    } else {
      updateItem(editingItem.id, {
        name: name.trim(), description: description.trim(), price: priceInCents,
        categoryId, available: editingItem.available, popular: editingItem.popular, customizations,
      });
    }
    setEditModalVisible(false);
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert('Eliminar Artículo', `¿Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteItem(item.id) },
    ]);
  };

  // ─── Grid Card ──────────────────────────────────────────────────────────────

  const renderGridItem = ({ item, index }: { item: MenuItem; index: number }) => {
    const shadowStyle = isDark
      ? { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3 }
      : { shadowColor: '#060e1d', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 };

    return (
      <TouchableOpacity
        style={[
          styles.gridCard,
          shadowStyle,
          {
            marginRight: index % 2 === 0 ? CARD_GAP : 0,
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
            opacity: item.available ? 1 : 0.55,
          },
        ]}
        onPress={() => openEditModal(item)}
        activeOpacity={0.75}
      >
        {/* Popular star */}
        {item.popular && (
          <View style={[styles.popularBadge, { backgroundColor: colors.surfaceHighlight }]}>
            <Star color={colors.secondary} size={11} fill={colors.secondary} />
          </View>
        )}

        <View style={styles.cardTop}>
          <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.name}
          </Text>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={styles.cardDeleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X color={colors.textMuted} size={14} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {item.description ? (
          <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.cardBottom}>
          <Text style={[styles.cardPrice, { color: colors.textPrimary }]}>
            {formatCurrency(item.price)}
          </Text>
          <Switch
            value={item.available}
            onValueChange={() => toggleItemAvailability(item.id, item.available)}
            trackColor={{ false: colors.surfaceHighlight, true: colors.success }}
            thumbColor={item.available ? colors.surface : colors.textMuted}
            style={styles.cardSwitch}
          />
        </View>

        {item.customizations.length > 0 && (
          <Text style={[styles.cardAddons, { color: colors.secondary }]}>
            {item.customizations.length} opcion{item.customizations.length > 1 ? 'es' : ''}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      {/* Page header */}
      <View style={[styles.pageHeader, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Menú</Text>
        <TouchableOpacity
          onPress={openAddModal}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          activeOpacity={0.8}
        >
          <Plus color={colors.onPrimary} size={16} strokeWidth={2.5} />
          <Text style={[styles.addBtnText, { color: colors.onPrimary }]}>Añadir</Text>
        </TouchableOpacity>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
        contentContainerStyle={styles.tabBarContent}
      >
        {categories.map((cat) => {
          const isActive = cat.id === selectedCategoryId;
          const count = items.filter((i) => i.categoryId === cat.id).length;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? colors.primary : colors.surfaceContainer,
                  borderColor: isActive ? colors.primary : colors.borderLight,
                },
              ]}
              onPress={() => setSelectedCategoryId(cat.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: isActive ? colors.onPrimary : colors.textSecondary }]}>
                {cat.icon}  {cat.name}
              </Text>
              <View style={[styles.tabCountBadge, { backgroundColor: isActive ? 'rgba(0,0,0,0.15)' : colors.surfaceHighlight }]}>
                <Text style={[styles.tabCount, { color: isActive ? colors.onPrimary : colors.textMuted }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Grid */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderGridItem}
        numColumns={2}
        contentContainerStyle={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceContainer }]}>
              <Text style={styles.emptyEmoji}>🍽</Text>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin artículos</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Añade el primer artículo a esta categoría.
            </Text>
            <TouchableOpacity
              onPress={openAddModal}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
              activeOpacity={0.8}
            >
              <Text style={[styles.emptyBtnText, { color: colors.onPrimary }]}>+ Añadir Artículo</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ─── Edit / Add Modal ──────────────────────────────────────────────────── */}
      <Modal visible={editModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrapper}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
              {/* Handle */}
              <View style={styles.modalHandle}>
                <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
              </View>

              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {isNewItem ? 'Nuevo Artículo' : 'Editar Artículo'}
                </Text>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceHighlight }]}
                >
                  <X color={colors.textPrimary} size={16} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                {/* Name */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NOMBRE</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight, color: colors.textPrimary }]}
                  value={editingItem.name}
                  onChangeText={(t) => setEditingItem({ ...editingItem, name: t })}
                  placeholder="Nombre del artículo"
                  placeholderTextColor={colors.textMuted}
                />

                {/* Description */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>DESCRIPCIÓN</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight, color: colors.textPrimary }]}
                  value={editingItem.description}
                  onChangeText={(t) => setEditingItem({ ...editingItem, description: t })}
                  placeholder="Descripción corta (opcional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                {/* Price */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>PRECIO</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight, color: colors.textPrimary }]}
                  value={editingItem.price}
                  onChangeText={(t) => setEditingItem({ ...editingItem, price: t })}
                  placeholder="10.99"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />

                {/* Category */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>CATEGORÍA</Text>
                <View style={styles.chipRow}>
                  {categories.map((cat) => {
                    const active = editingItem.categoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surfaceContainer, borderColor: active ? colors.primary : colors.borderLight }]}
                        onPress={() => setEditingItem({ ...editingItem, categoryId: cat.id })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.textSecondary }]}>
                          {cat.icon} {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Toggles */}
                <View style={[styles.toggleRow, { borderBottomColor: colors.borderLight }]}>
                  <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Disponible</Text>
                  <Switch
                    value={editingItem.available}
                    onValueChange={(v) => setEditingItem({ ...editingItem, available: v })}
                    trackColor={{ false: colors.surfaceHighlight, true: colors.success }}
                    thumbColor={colors.surface}
                  />
                </View>
                <View style={[styles.toggleRow, { borderBottomColor: 'transparent' }]}>
                  <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Popular / Destacado</Text>
                  <Switch
                    value={editingItem.popular}
                    onValueChange={(v) => setEditingItem({ ...editingItem, popular: v })}
                    trackColor={{ false: colors.surfaceHighlight, true: colors.secondary }}
                    thumbColor={colors.surface}
                  />
                </View>

                {/* ─── Customizations ─────────────────────────────────────── */}
                <View style={[styles.sectionDivider, { backgroundColor: colors.borderLight }]} />
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Complementos</Text>
                  <TouchableOpacity onPress={addCustomizationGroup} activeOpacity={0.7}>
                    <Text style={[styles.addGroupText, { color: colors.primary }]}>+ Añadir Grupo</Text>
                  </TouchableOpacity>
                </View>

                {editingItem.customizations.map((cg) => (
                  <View key={cg.id} style={[styles.cgCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}>
                    <View style={styles.cgHeader}>
                      <TextInput
                        style={[styles.cgNameInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                        value={cg.name}
                        onChangeText={(t) => updateCustomizationGroup(cg.id, { name: t })}
                        placeholder="Nombre del grupo (ej. Tamaño)"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TouchableOpacity onPress={() => removeCustomizationGroup(cg.id)}>
                        <Text style={[styles.removeText, { color: colors.error }]}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.cgToggles}>
                      <TouchableOpacity
                        style={[styles.cgToggle, { backgroundColor: cg.required ? colors.primary : colors.surfaceHighlight }]}
                        onPress={() => updateCustomizationGroup(cg.id, { required: !cg.required })}
                      >
                        <Text style={[styles.cgToggleText, { color: cg.required ? colors.onPrimary : colors.textSecondary }]}>
                          Requerido
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.maxSelRow}>
                        <Text style={[styles.maxSelLabel, { color: colors.textSecondary }]}>Máx:</Text>
                        <TextInput
                          style={[styles.maxSelInput, { backgroundColor: colors.surfaceHighlight, color: colors.textPrimary }]}
                          value={String(cg.maxSelections)}
                          onChangeText={(t) => updateCustomizationGroup(cg.id, { maxSelections: parseInt(t) || 1 })}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    {cg.options.map((opt) => (
                      <View key={opt.id} style={styles.optionRow}>
                        <TextInput
                          style={[styles.optionNameInput, { backgroundColor: colors.surfaceHighlight, color: colors.textPrimary }]}
                          value={opt.name}
                          onChangeText={(t) => updateOption(cg.id, opt.id, { name: t })}
                          placeholder="Nombre de la opción"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          style={[styles.optionPriceInput, { backgroundColor: colors.surfaceHighlight, color: colors.textPrimary }]}
                          value={opt.priceModifier}
                          onChangeText={(t) => updateOption(cg.id, opt.id, { priceModifier: t })}
                          placeholder="0.00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                        />
                        <TouchableOpacity onPress={() => removeOption(cg.id, opt.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <X color={colors.error} size={16} strokeWidth={2} />
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity onPress={() => addOption(cg.id)} style={styles.addOptionBtn} activeOpacity={0.7}>
                      <Text style={[styles.addOptionText, { color: colors.primary }]}>+ Añadir Opción</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {editingItem.customizations.length === 0 && (
                  <Text style={[styles.noAddonsText, { color: colors.textMuted }]}>
                    Sin complementos. Toca "+ Añadir Grupo" para crear opciones de personalización.
                  </Text>
                )}

                <View style={{ height: spacing.xl }} />
              </ScrollView>

              {/* Save button */}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>
                  {isNewItem ? 'Añadir al Menú' : 'Guardar Cambios'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    letterSpacing: -0.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  tabBar: {
    maxHeight: 52,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  tabBarContent: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  tabText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  tabCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  tabCount: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
  },

  // Grid
  gridContainer: {
    padding: spacing.base,
    paddingTop: spacing.sm,
  },
  gridCard: {
    width: CARD_WIDTH,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    paddingRight: 28, // space for popular badge
  },
  cardName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.base,
    flex: 1,
    marginRight: spacing.xs,
    letterSpacing: -0.2,
  },
  cardDeleteBtn: {
    padding: 2,
  },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    letterSpacing: -0.3,
  },
  cardSwitch: {
    transform: [{ scale: 0.8 }],
  },
  cardAddons: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyEmoji: { fontSize: 26 },
  emptyTitle: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.lg,
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    maxWidth: 220,
  },
  emptyBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  emptyBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalWrapper: {
    maxHeight: '92%',
  },
  modalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  modalHandle: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.base,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    letterSpacing: -0.3,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.base,
  },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    letterSpacing: -0.2,
  },
  addGroupText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
  },
  cgCard: {
    borderRadius: borderRadius.md,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cgHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cgNameInput: {
    flex: 1,
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.base,
    marginRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
  },
  removeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  cgToggles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  cgToggle: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  cgToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
  },
  maxSelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  maxSelLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  maxSelInput: {
    width: 36,
    borderRadius: 6,
    padding: spacing.xs,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  optionNameInput: {
    flex: 1,
    borderRadius: 8,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  optionPriceInput: {
    width: 64,
    borderRadius: 8,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    textAlign: 'right',
  },
  addOptionBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  addOptionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  noAddonsText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  saveBtn: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    paddingVertical: spacing.base,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.md,
    letterSpacing: -0.2,
  },
});
