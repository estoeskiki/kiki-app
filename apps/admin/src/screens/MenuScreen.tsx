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
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useMenuStore } from '../store/useMenuStore';
import { MenuItem, CustomizationGroup, CustomizationOption } from '../data/types';
import { formatCurrency } from '../utils/formatCurrency';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.base * 2 - CARD_GAP) / 2;

// ─── Types ──────────────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────────

export default function MenuScreen() {
  const { items, categories, isLoading, fetchMenu, toggleItemAvailability, addItem, updateItem, deleteItem } = useMenuStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(EMPTY_ITEM);
  const [isNewItem, setIsNewItem] = useState(false);

  React.useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  React.useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
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
        {
          id: `cg-${Date.now()}`,
          name: '',
          required: false,
          maxSelections: 1,
          options: [],
        },
      ],
    }));
  };

  const updateCustomizationGroup = (cgId: string, updates: Partial<EditingCustomization>) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId ? { ...cg, ...updates } : cg
      ),
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
          ? {
              ...cg,
              options: [
                ...cg.options,
                { id: `opt-${Date.now()}`, name: '', priceModifier: '0.00' },
              ],
            }
          : cg
      ),
    }));
  };

  const updateOption = (cgId: string, optId: string, updates: Partial<{ name: string; priceModifier: string }>) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId
          ? {
              ...cg,
              options: cg.options.map((o) => (o.id === optId ? { ...o, ...updates } : o)),
            }
          : cg
      ),
    }));
  };

  const removeOption = (cgId: string, optId: string) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId
          ? { ...cg, options: cg.options.filter((o) => o.id !== optId) }
          : cg
      ),
    }));
  };

  // ─── Save ───────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const { name, description, price, categoryId } = editingItem;
    if (!name.trim()) {
      Alert.alert('Error', 'Item name is required.');
      return;
    }
    const priceInCents = Math.round(parseFloat(price || '0') * 100);
    if (isNaN(priceInCents) || priceInCents < 0) {
      Alert.alert('Error', 'Please enter a valid price.');
      return;
    }

    const customizations: CustomizationGroup[] = editingItem.customizations
      .filter((cg) => cg.name.trim())
      .map((cg) => ({
        id: cg.id,
        name: cg.name.trim(),
        required: cg.required,
        maxSelections: cg.maxSelections,
        options: cg.options
          .filter((o) => o.name.trim())
          .map((o) => ({
            id: o.id,
            name: o.name.trim(),
            priceModifier: Math.round(parseFloat(o.priceModifier || '0') * 100),
          })),
      }));

    if (isNewItem) {
      addItem({
        name: name.trim(),
        description: description.trim(),
        price: priceInCents,
        categoryId: categoryId || categories[0]?.id || '',
        image: '',
        available: editingItem.available,
        popular: editingItem.popular,
        customizations,
      });
    } else {
      updateItem(editingItem.id, {
        name: name.trim(),
        description: description.trim(),
        price: priceInCents,
        categoryId,
        available: editingItem.available,
        popular: editingItem.popular,
        customizations,
      });
    }
    setEditModalVisible(false);
  };

  const handleDelete = (item: MenuItem) => {
    Alert.alert('Delete Item', `Are you sure you want to delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(item.id) },
    ]);
  };

  // ─── Grid card ──────────────────────────────────────────────────────────────

  const renderGridItem = ({ item, index }: { item: MenuItem; index: number }) => (
    <TouchableOpacity
      style={[
        styles.gridCard,
        { marginRight: index % 2 === 0 ? CARD_GAP : 0 },
        !item.available && styles.gridCardDisabled,
      ]}
      onPress={() => openEditModal(item)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        <Text style={styles.cardName} numberOfLines={2}>{item.name}</Text>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          style={styles.cardDeleteBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cardDeleteText}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

      <View style={styles.cardBottom}>
        <Text style={styles.cardPrice}>{formatCurrency(item.price)}</Text>
        <Switch
          value={item.available}
          onValueChange={() => toggleItemAvailability(item.id, item.available)}
          trackColor={{ false: colors.surfaceHighlight, true: colors.success }}
          thumbColor={colors.textPrimary}
          style={styles.cardSwitch}
        />
      </View>

      {item.customizations.length > 0 && (
        <Text style={styles.cardAddons}>
          {item.customizations.length} add-on{item.customizations.length > 1 ? 's' : ''}
        </Text>
      )}

      {item.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularText}>⭐</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Menu</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addBtn} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
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
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setSelectedCategoryId(cat.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {cat.icon}  {cat.name}
              </Text>
              <Text style={[styles.tabCount, isActive && styles.tabCountActive]}>{count}</Text>
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
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items in this category.</Text>
            <TouchableOpacity onPress={openAddModal} style={styles.emptyAddBtn} activeOpacity={0.7}>
              <Text style={styles.emptyAddText}>+ Add one</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ─── Edit / Add Modal ───────────────────────────────────────────────── */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrapper}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isNewItem ? 'Add New Item' : 'Edit Item'}
                </Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <Text style={styles.modalClose}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
                {/* Basic info */}
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={editingItem.name}
                  onChangeText={(t) => setEditingItem({ ...editingItem, name: t })}
                  placeholder="Item name"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={editingItem.description}
                  onChangeText={(t) => setEditingItem({ ...editingItem, description: t })}
                  placeholder="Short description"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.label}>Price (€)</Text>
                <TextInput
                  style={styles.input}
                  value={editingItem.price}
                  onChangeText={(t) => setEditingItem({ ...editingItem, price: t })}
                  placeholder="10.99"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />

                {/* Category chips */}
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryRow}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        editingItem.categoryId === cat.id && styles.categoryChipActive,
                      ]}
                      onPress={() => setEditingItem({ ...editingItem, categoryId: cat.id })}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          editingItem.categoryId === cat.id && styles.categoryChipTextActive,
                        ]}
                      >
                        {cat.icon} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Toggles */}
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Available</Text>
                  <Switch
                    value={editingItem.available}
                    onValueChange={(v) => setEditingItem({ ...editingItem, available: v })}
                    trackColor={{ false: colors.surfaceHighlight, true: colors.success }}
                    thumbColor={colors.textPrimary}
                  />
                </View>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>Popular / Featured</Text>
                  <Switch
                    value={editingItem.popular}
                    onValueChange={(v) => setEditingItem({ ...editingItem, popular: v })}
                    trackColor={{ false: colors.surfaceHighlight, true: colors.secondary }}
                    thumbColor={colors.textPrimary}
                  />
                </View>

                {/* ─── Customizations / Add-ons ─────────────────────────────── */}
                <View style={styles.sectionDivider} />
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabel}>Add-ons / Customizations</Text>
                  <TouchableOpacity onPress={addCustomizationGroup} activeOpacity={0.7}>
                    <Text style={styles.addGroupText}>+ Add Group</Text>
                  </TouchableOpacity>
                </View>

                {editingItem.customizations.map((cg) => (
                  <View key={cg.id} style={styles.cgCard}>
                    <View style={styles.cgHeader}>
                      <TextInput
                        style={styles.cgNameInput}
                        value={cg.name}
                        onChangeText={(t) => updateCustomizationGroup(cg.id, { name: t })}
                        placeholder="Group name (e.g. Patty Size)"
                        placeholderTextColor={colors.textMuted}
                      />
                      <TouchableOpacity onPress={() => removeCustomizationGroup(cg.id)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.cgToggles}>
                      <TouchableOpacity
                        style={[styles.cgToggle, cg.required && styles.cgToggleActive]}
                        onPress={() =>
                          updateCustomizationGroup(cg.id, { required: !cg.required })
                        }
                      >
                        <Text
                          style={[
                            styles.cgToggleText,
                            cg.required && styles.cgToggleTextActive,
                          ]}
                        >
                          Required
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.maxSelRow}>
                        <Text style={styles.maxSelLabel}>Max:</Text>
                        <TextInput
                          style={styles.maxSelInput}
                          value={String(cg.maxSelections)}
                          onChangeText={(t) =>
                            updateCustomizationGroup(cg.id, {
                              maxSelections: parseInt(t) || 1,
                            })
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    {/* Options */}
                    {cg.options.map((opt) => (
                      <View key={opt.id} style={styles.optionRow}>
                        <TextInput
                          style={styles.optionNameInput}
                          value={opt.name}
                          onChangeText={(t) => updateOption(cg.id, opt.id, { name: t })}
                          placeholder="Option name"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          style={styles.optionPriceInput}
                          value={opt.priceModifier}
                          onChangeText={(t) =>
                            updateOption(cg.id, opt.id, { priceModifier: t })
                          }
                          placeholder="0.00"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                        />
                        <TouchableOpacity onPress={() => removeOption(cg.id, opt.id)}>
                          <Text style={styles.optionRemove}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                    <TouchableOpacity
                      onPress={() => addOption(cg.id)}
                      style={styles.addOptionBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addOptionText}>+ Add Option</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {editingItem.customizations.length === 0 && (
                  <Text style={styles.noAddonsText}>
                    No add-ons yet. Tap "+ Add Group" to create customization options.
                  </Text>
                )}

                <View style={{ height: spacing.xl }} />
              </ScrollView>

              {/* Save */}
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>
                  {isNewItem ? 'Add to Menu' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  screenTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes['2xl'],
    color: colors.textPrimary,
  },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  addBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.background,
  },

  // Tabs
  tabBar: {
    maxHeight: 48,
    marginBottom: spacing.sm,
  },
  tabBarContent: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.background,
  },
  tabCount: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tabCountActive: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    color: colors.background,
  },

  // Grid
  gridContainer: {
    padding: spacing.base,
    paddingTop: spacing.xs,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.base,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  gridCardDisabled: {
    opacity: 0.5,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  cardName: {
    fontFamily: fonts.headingSemiBold,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardDeleteBtn: {
    padding: 2,
  },
  cardDeleteText: {
    fontSize: fontSizes.sm,
    color: colors.textMuted,
  },
  cardDesc: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPrice: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.md,
    color: colors.primary,
  },
  cardSwitch: {
    transform: [{ scale: 0.8 }],
  },
  cardAddons: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.secondary,
    marginTop: spacing.xs,
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  popularText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyAddBtn: {
    backgroundColor: colors.surfaceHighlight,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  emptyAddText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalWrapper: {
    maxHeight: '92%',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.xl,
    color: colors.textPrimary,
  },
  modalClose: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.base,
    color: colors.primary,
  },
  formScroll: {
    marginBottom: spacing.base,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.base,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  categoryChipTextActive: {
    color: colors.background,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.textPrimary,
  },

  // Customizations section
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.textPrimary,
  },
  addGroupText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  cgCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.base,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.textPrimary,
    marginRight: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.xs,
  },
  removeText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.error,
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
    backgroundColor: colors.surfaceHighlight,
  },
  cgToggleActive: {
    backgroundColor: colors.primary,
  },
  cgToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  cgToggleTextActive: {
    color: colors.background,
  },
  maxSelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  maxSelLabel: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  maxSelInput: {
    width: 36,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 6,
    padding: spacing.xs,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
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
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 8,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
  },
  optionPriceInput: {
    width: 64,
    backgroundColor: colors.surfaceHighlight,
    borderRadius: 8,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textPrimary,
    textAlign: 'right',
  },
  optionRemove: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.sm,
    color: colors.error,
    padding: spacing.xs,
  },
  addOptionBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  addOptionText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
    color: colors.primary,
  },
  noAddonsText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },

  // Save
  saveBtn: {
    backgroundColor: colors.primary,
    padding: spacing.base,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: fonts.heading,
    fontSize: fontSizes.lg,
    color: colors.background,
  },
});
