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
  ActivityIndicator,
} from 'react-native';
import { Plus, X, Trash2, Star, Wand2, Loader2 } from 'lucide-react-native';
import { supabase, supabaseAnonKey } from '../lib/supabase';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { useMenuStore } from '../store/useMenuStore';
import { MenuItem, CustomizationGroup, CustomizationOption } from '../data/types';
import { formatCurrency } from '../utils/formatCurrency';
import { useTheme } from '../theme/useTheme';
import { spacing, borderRadius } from '../theme/spacing';
import { fonts, fontSizes } from '../theme/typography';

const t = (val: any) => val?.es || val || '';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = spacing.sm;
const CARD_WIDTH = (SCREEN_WIDTH - spacing.base * 2 - CARD_GAP) / 2;

// ─── Types ───────────────────────────────────────────────────────────────────

// Editing shape keeps the numeric caps as strings while they're being typed.
type EditingSelectionRule = {
  driverGroupId: string;
  byOption: Record<string, string>; // driver optionId -> max (string)
  defaultMax: string;
};

type EditingCustomization = {
  id: string;
  name: { es: string; en: string };
  required: boolean;
  maxSelections: number;
  options: { id: string; name: { es: string; en: string }; priceModifier: string }[];
  selectionRule: EditingSelectionRule | null;
};

type EditingItem = {
  id: string;
  name: { es: string; en: string };
  description: { es: string; en: string };
  price: string;
  categoryId: string;
  available: boolean;
  popular: boolean;
  customizations: EditingCustomization[];
};

const EMPTY_ITEM: EditingItem = {
  id: '',
  name: { es: '', en: '' },
  description: { es: '', en: '' },
  price: '',
  categoryId: '',
  available: true,
  popular: false,
  customizations: [],
};

// ─── Component ───────────────────────────────────────────────────────────────

const EMPTY_CAT = { id: '', name: { es: '', en: '' } };

export default function MenuScreen() {
  const { items, categories, isLoading, fetchMenu, toggleItemAvailability, addItem, updateItem, deleteItem, addCategory, updateCategory, deleteCategory } = useMenuStore();
  const [selectedCategoryId, setSelectedCategoryId] = useState(categories[0]?.id || '');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<EditingItem>(EMPTY_ITEM);
  const [isNewItem, setIsNewItem] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isCatTranslating, setIsCatTranslating] = useState(false);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [editingCat, setEditingCat] = useState(EMPTY_CAT);
  const [isNewCat, setIsNewCat] = useState(false);
  const { colors, isDark } = useTheme();

  React.useEffect(() => { fetchMenu(); }, [fetchMenu]);

  React.useEffect(() => {
    if (categories.length === 0) return;
    // Keep the current selection if it still points to an existing category
    // (lets the user intentionally view an empty category to add items).
    if (categories.some((c) => c.id === selectedCategoryId)) return;
    // Otherwise (first load, or the selected category was deleted) prefer the
    // first category that actually has items so we don't land on an empty view.
    const firstWithItems = categories.find((c) => items.some((i) => i.categoryId === c.id));
    setSelectedCategoryId((firstWithItems ?? categories[0]).id);
  }, [categories, items, selectedCategoryId]);

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
      name: { es: t(item.name), en: (item.name as any)?.en || '' },
      description: { es: t(item.description), en: (item.description as any)?.en || '' },
      price: (item.price / 100).toFixed(2),
      categoryId: item.categoryId,
      available: item.available,
      popular: item.popular,
      customizations: item.customizations.map((cg) => ({
        id: cg.id,
        name: { es: t(cg.name), en: (cg.name as any)?.en || '' },
        required: cg.required,
        maxSelections: cg.maxSelections,
        selectionRule: cg.selectionRule
          ? {
              driverGroupId: cg.selectionRule.driverGroupId,
              byOption: Object.fromEntries(
                Object.entries(cg.selectionRule.byOption).map(([k, v]) => [k, String(v)])
              ),
              defaultMax: String(cg.selectionRule.defaultMax),
            }
          : null,
        options: cg.options.map((o) => ({
          id: o.id,
          name: { es: t(o.name), en: (o.name as any)?.en || '' },
          priceModifier: (o.priceModifier / 100).toFixed(2),
        })),
      })),
    });
    setIsNewItem(false);
    setEditModalVisible(true);
  };

  // ─── Category helpers ───────────────────────────────────────────────────────

  const openAddCatModal = () => {
    setEditingCat(EMPTY_CAT);
    setIsNewCat(true);
    setCatModalVisible(true);
  };

  const openEditCatModal = (cat: typeof categories[0]) => {
    setEditingCat({
      id: cat.id,
      name: { es: t(cat.name), en: (cat.name as any)?.en || '' },
    });
    setIsNewCat(false);
    setCatModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!editingCat.name.es.trim()) return;
    if (isNewCat) {
      await addCategory({ es: editingCat.name.es.trim(), en: editingCat.name.en.trim() }, '');
    } else {
      await updateCategory(editingCat.id, { es: editingCat.name.es.trim(), en: editingCat.name.en.trim() }, '');
    }
    setCatModalVisible(false);
  };

  const handleTranslateCategory = async () => {
    if (!editingCat.name.es) return;
    try {
      setIsCatTranslating(true);
      const fnUrl = `https://shmmbnvdtmqxmrlzpluh.supabase.co/functions/v1/translate`;
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ texts: [editingCat.name.es], targetLanguage: 'en', sourceLanguage: 'es' }),
      });
      if (!response.ok) throw new Error(`${response.status}`);
      const data = await response.json();
      const translated = data.translations?.[0] || '';
      setEditingCat((p) => ({ ...p, name: { ...p.name, en: translated } }));
    } catch (err: any) {
      Alert.alert('Error al traducir', err.message);
    } finally {
      setIsCatTranslating(false);
    }
  };

  const handleLongPressCategory = (cat: typeof categories[0]) => {
    const itemCount = items.filter((i) => i.categoryId === cat.id).length;
    Alert.alert(t(cat.name), undefined, [
      { text: 'Renombrar', onPress: () => openEditCatModal(cat) },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          if (itemCount > 0) {
            Alert.alert(
              'No se puede eliminar',
              `Esta categoría tiene ${itemCount} artículo${itemCount > 1 ? 's' : ''}. Mueve o elimina los artículos primero.`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert('Eliminar categoría', `¿Eliminar "${t(cat.name)}"?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Eliminar', style: 'destructive', onPress: () => deleteCategory(cat.id) },
            ]);
          }
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  // ─── Customization helpers ──────────────────────────────────────────────────

  const addCustomizationGroup = () => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: [
        ...prev.customizations,
        { id: `cg-${Date.now()}`, name: { es: '', en: '' }, required: false, maxSelections: 1, options: [], selectionRule: null },
      ],
    }));
  };

  // ─── Conditional-max rule helpers ───────────────────────────────────────────

  const toggleSelectionRule = (cg: EditingCustomization) => {
    updateCustomizationGroup(cg.id, {
      selectionRule: cg.selectionRule
        ? null
        : { driverGroupId: '', byOption: {}, defaultMax: String(cg.maxSelections || 1) },
    });
  };

  const setDriverGroup = (cgId: string, driverGroupId: string) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId && cg.selectionRule
          ? { ...cg, selectionRule: { ...cg.selectionRule, driverGroupId, byOption: {} } }
          : cg
      ),
    }));
  };

  const setOptionMax = (cgId: string, optId: string, value: string) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId && cg.selectionRule
          ? { ...cg, selectionRule: { ...cg.selectionRule, byOption: { ...cg.selectionRule.byOption, [optId]: value } } }
          : cg
      ),
    }));
  };

  const setDefaultMax = (cgId: string, value: string) => {
    setEditingItem((prev) => ({
      ...prev,
      customizations: prev.customizations.map((cg) =>
        cg.id === cgId && cg.selectionRule
          ? { ...cg, selectionRule: { ...cg.selectionRule, defaultMax: value } }
          : cg
      ),
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
          ? { ...cg, options: [...cg.options, { id: `opt-${Date.now()}`, name: { es: '', en: '' }, priceModifier: '0.00' }] }
          : cg
      ),
    }));
  };

  const updateOption = (cgId: string, optId: string, updates: Partial<{ name: { es: string; en: string }; priceModifier: string }>) => {
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

  const handleTranslateAllFields = async () => {
    try {
      setIsTranslating(true);
      
      const textsToTranslate: string[] = [];
      const mapping: { type: string, index?: number, optIndex?: number }[] = [];
      
      if (editingItem.name.es) { textsToTranslate.push(editingItem.name.es); mapping.push({ type: 'name' }); }
      if (editingItem.description.es) { textsToTranslate.push(editingItem.description.es); mapping.push({ type: 'description' }); }
      
      editingItem.customizations.forEach((cg, i) => {
        if (cg.name.es) { textsToTranslate.push(cg.name.es); mapping.push({ type: 'cgName', index: i }); }
        cg.options.forEach((opt, j) => {
          if (opt.name.es) { textsToTranslate.push(opt.name.es); mapping.push({ type: 'optName', index: i, optIndex: j }); }
        });
      });

      if (textsToTranslate.length === 0) {
        setIsTranslating(false);
        return;
      }

      const fnUrl = `https://shmmbnvdtmqxmrlzpluh.supabase.co/functions/v1/translate`;
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ texts: textsToTranslate, targetLanguage: 'en', sourceLanguage: 'es' }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${response.status}: ${text}`);
      }

      const data = await response.json();
      const results = data.translations;
      
      setEditingItem(prev => {
        const next = { ...prev, name: { ...prev.name }, description: { ...prev.description }, customizations: prev.customizations.map(c => ({...c, name: {...c.name}, options: c.options.map(o => ({...o, name: {...o.name}}))})) };
        
        mapping.forEach((m, resIndex) => {
          const translated = results[resIndex] || '';
          if (m.type === 'name') next.name.en = translated;
          else if (m.type === 'description') next.description.en = translated;
          else if (m.type === 'cgName') next.customizations[m.index!].name.en = translated;
          else if (m.type === 'optName') next.customizations[m.index!].options[m.optIndex!].name.en = translated;
        });

        return next;
      });
      
    } catch (err: any) {
      Alert.alert("Translation failed", err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleSave = () => {
    const { name, description, price, categoryId } = editingItem;
    if (!name.es.trim()) { Alert.alert('Error', 'El nombre del artículo en español es requerido.'); return; }
    const priceInCents = Math.round(parseFloat(price || '0') * 100);
    if (isNaN(priceInCents) || priceInCents < 0) { Alert.alert('Error', 'Ingresa un precio válido.'); return; }

    const customizations: CustomizationGroup[] = editingItem.customizations
      .filter((cg) => cg.name.es.trim())
      .map((cg) => ({
        id: cg.id,
        name: { es: cg.name.es.trim(), en: cg.name.en.trim() },
        required: cg.required,
        maxSelections: cg.maxSelections,
        selectionRule:
          cg.selectionRule && cg.selectionRule.driverGroupId
            ? {
                driverGroupId: cg.selectionRule.driverGroupId,
                byOption: Object.fromEntries(
                  Object.entries(cg.selectionRule.byOption)
                    .map(([k, v]) => [k, parseInt(v, 10) || 0] as const)
                    .filter(([, v]) => v > 0)
                ),
                defaultMax: parseInt(cg.selectionRule.defaultMax, 10) || 1,
              }
            : null,
        options: cg.options.filter((o) => o.name.es.trim()).map((o) => ({
          id: o.id,
          name: { es: o.name.es.trim(), en: o.name.en.trim() },
          priceModifier: Math.round(parseFloat(o.priceModifier || '0') * 100),
        })),
      }));

    if (isNewItem) {
      addItem({
        name: { es: name.es.trim(), en: name.en.trim() },
        description: { es: description.es.trim(), en: description.en.trim() },
        price: priceInCents,
        categoryId: categoryId || categories[0]?.id || '', image: '',
        available: editingItem.available, popular: editingItem.popular, customizations,
      });
    } else {
      updateItem(editingItem.id, {
        name: { es: name.es.trim(), en: name.en.trim() },
        description: { es: description.es.trim(), en: description.en.trim() },
        price: priceInCents,
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
            {t(item.name)}
          </Text>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={styles.cardDeleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <X color={colors.textMuted} size={14} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {t(item.description) ? (
          <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>
            {t(item.description)}
          </Text>
        ) : null}

        <View style={styles.cardBottom}>
          <Text style={[styles.cardPrice, { color: colors.textPrimary }]}>
            {formatCurrency(item.price)}
          </Text>
          <TouchableOpacity
            onPress={() => toggleItemAvailability(item.id, item.available)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <Switch
              value={item.available}
              onValueChange={() => toggleItemAvailability(item.id, item.available)}
              trackColor={{ false: colors.surfaceHighlight, true: colors.success }}
              thumbColor={item.available ? colors.surface : colors.textMuted}
              style={styles.cardSwitch}
              pointerEvents="none"
            />
          </TouchableOpacity>
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
              onLongPress={() => handleLongPressCategory(cat)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, { color: isActive ? colors.onPrimary : colors.textSecondary }]}>
                {t(cat.name)}
              </Text>
              <View style={[styles.tabCountBadge, { backgroundColor: isActive ? 'rgba(0,0,0,0.15)' : colors.surfaceHighlight }]}>
                <Text style={[styles.tabCount, { color: isActive ? colors.onPrimary : colors.textMuted }]}>
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {/* Add category button */}
        <TouchableOpacity
          style={[styles.tab, styles.tabAdd, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}
          onPress={openAddCatModal}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: colors.primary }]}>+</Text>
        </TouchableOpacity>
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
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
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
          )
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
                
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={handleTranslateAllFields}
                    disabled={isTranslating}
                    style={{
                      backgroundColor: isTranslating ? colors.surfaceHighlight : colors.surface,
                      borderColor: colors.borderLight,
                      borderWidth: StyleSheet.hairlineWidth,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isTranslating ? (
                       <Loader2 color={colors.primary} size={14} />
                    ) : (
                       <Wand2 color={colors.primary} size={14} />
                    )}
                    <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: isTranslating ? colors.textMuted : colors.textPrimary }}>
                      Traducir
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setEditModalVisible(false)}
                    style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceHighlight }]}
                  >
                    <X color={colors.textPrimary} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Name */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NOMBRE</Text>
                <View style={styles.bilingualField}>
                  <View style={[styles.langBadge, { backgroundColor: colors.surfaceHighlight }]}>
                    <Text style={[styles.langBadgeText, { color: colors.textMuted }]}>ES</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.bilingualInput, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight, color: colors.textPrimary }]}
                    value={editingItem.name.es}
                    onChangeText={(t) => setEditingItem({ ...editingItem, name: { ...editingItem.name, es: t } })}
                    placeholder="Nombre del artículo"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={styles.bilingualField}>
                  <View style={[styles.langBadge, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[styles.langBadgeText, { color: colors.primary }]}>EN</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.bilingualInput, { backgroundColor: colors.surfaceContainer, borderColor: editingItem.name.en ? colors.primary + '55' : colors.borderLight, color: colors.textPrimary }]}
                    value={editingItem.name.en}
                    onChangeText={(t) => setEditingItem({ ...editingItem, name: { ...editingItem.name, en: t } })}
                    placeholder="Item name (English)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>

                {/* Description */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>DESCRIPCIÓN</Text>
                <View style={styles.bilingualField}>
                  <View style={[styles.langBadge, { backgroundColor: colors.surfaceHighlight }]}>
                    <Text style={[styles.langBadgeText, { color: colors.textMuted }]}>ES</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.bilingualInput, styles.textArea, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight, color: colors.textPrimary }]}
                    value={editingItem.description.es}
                    onChangeText={(t) => setEditingItem({ ...editingItem, description: { ...editingItem.description, es: t } })}
                    placeholder="Descripción corta (opcional)"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>
                <View style={styles.bilingualField}>
                  <View style={[styles.langBadge, { backgroundColor: colors.primary + '22', alignSelf: 'flex-start', marginTop: spacing.md }]}>
                    <Text style={[styles.langBadgeText, { color: colors.primary }]}>EN</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.bilingualInput, styles.textArea, { backgroundColor: colors.surfaceContainer, borderColor: editingItem.description.en ? colors.primary + '55' : colors.borderLight, color: colors.textPrimary }]}
                    value={editingItem.description.en}
                    onChangeText={(t) => setEditingItem({ ...editingItem, description: { ...editingItem.description, en: t } })}
                    placeholder="Short description (English, optional)"
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>

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
                          {t(cat.name)}
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

                {editingItem.customizations.map((cg) => {
                  // Groups that can drive this one's cap — any other named group.
                  const otherGroups = editingItem.customizations.filter(
                    (g) => g.id !== cg.id && g.name.es.trim()
                  );
                  const driverGroup = cg.selectionRule
                    ? editingItem.customizations.find((g) => g.id === cg.selectionRule!.driverGroupId)
                    : undefined;
                  return (
                  <View key={cg.id} style={[styles.cgCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight }]}>
                    <View style={styles.cgHeader}>
                      <View style={{ flex: 1, marginRight: spacing.sm }}>
                        <TextInput
                          style={[styles.cgNameInput, { color: colors.textPrimary, borderBottomColor: colors.border }]}
                          value={cg.name.es}
                          onChangeText={(t) => updateCustomizationGroup(cg.id, { name: { ...cg.name, es: t } })}
                          placeholder="Nombre del grupo (ej. Tamaño)"
                          placeholderTextColor={colors.textMuted}
                        />
                        <TextInput
                          style={[styles.cgNameInput, styles.cgNameInputEn, { color: colors.textSecondary, borderBottomColor: cg.name.en ? colors.primary + '55' : colors.borderLight }]}
                          value={cg.name.en}
                          onChangeText={(t) => updateCustomizationGroup(cg.id, { name: { ...cg.name, en: t } })}
                          placeholder="Group name (EN)"
                          placeholderTextColor={colors.textMuted}
                        />
                      </View>
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
                        <View style={{ flex: 1, gap: 4 }}>
                          <TextInput
                            style={[styles.optionNameInput, { backgroundColor: colors.surfaceHighlight, color: colors.textPrimary }]}
                            value={opt.name.es}
                            onChangeText={(t) => updateOption(cg.id, opt.id, { name: { ...opt.name, es: t } })}
                            placeholder="Nombre de la opción"
                            placeholderTextColor={colors.textMuted}
                          />
                          <TextInput
                            style={[styles.optionNameInput, styles.optionNameInputEn, { backgroundColor: colors.surfaceHighlight, color: colors.textSecondary, borderColor: opt.name.en ? colors.primary + '55' : 'transparent' }]}
                            value={opt.name.en}
                            onChangeText={(t) => updateOption(cg.id, opt.id, { name: { ...opt.name, en: t } })}
                            placeholder="Option name (EN)"
                            placeholderTextColor={colors.textMuted}
                          />
                        </View>
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

                    {/* Conditional max: cap depends on the option picked in another group */}
                    {otherGroups.length > 0 && (
                      <View style={[styles.ruleBlock, { borderTopColor: colors.borderLight }]}>
                        <TouchableOpacity
                          style={styles.ruleToggleRow}
                          onPress={() => toggleSelectionRule(cg)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.ruleCheckbox, { borderColor: cg.selectionRule ? colors.primary : colors.border, backgroundColor: cg.selectionRule ? colors.primary : 'transparent' }]}>
                            {cg.selectionRule && <Text style={[styles.ruleCheck, { color: colors.onPrimary }]}>✓</Text>}
                          </View>
                          <Text style={[styles.ruleToggleText, { color: colors.textSecondary }]}>
                            Máx. depende de otro grupo
                          </Text>
                        </TouchableOpacity>

                        {cg.selectionRule && (
                          <View style={{ marginTop: spacing.sm }}>
                            <Text style={[styles.ruleLabel, { color: colors.textMuted }]}>GRUPO BASE</Text>
                            <View style={styles.chipRow}>
                              {otherGroups.map((g) => {
                                const active = cg.selectionRule!.driverGroupId === g.id;
                                return (
                                  <TouchableOpacity
                                    key={g.id}
                                    style={[styles.chip, { backgroundColor: active ? colors.primary : colors.surfaceHighlight, borderColor: active ? colors.primary : colors.borderLight }]}
                                    onPress={() => setDriverGroup(cg.id, g.id)}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.textSecondary }]}>
                                      {g.name.es.trim() || 'Grupo'}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>

                            {driverGroup && (
                              <View style={{ marginTop: spacing.sm }}>
                                {driverGroup.options.filter((o) => o.name.es.trim()).map((o) => (
                                  <View key={o.id} style={styles.ruleOptRow}>
                                    <Text style={[styles.ruleOptName, { color: colors.textSecondary }]} numberOfLines={1}>
                                      {o.name.es.trim()}
                                    </Text>
                                    <Text style={[styles.ruleArrow, { color: colors.textMuted }]}>máx</Text>
                                    <TextInput
                                      style={[styles.maxSelInput, { backgroundColor: colors.surfaceHighlight, color: colors.textPrimary }]}
                                      value={cg.selectionRule!.byOption[o.id] ?? ''}
                                      onChangeText={(v) => setOptionMax(cg.id, o.id, v)}
                                      placeholder={cg.selectionRule!.defaultMax}
                                      placeholderTextColor={colors.textMuted}
                                      keyboardType="numeric"
                                    />
                                  </View>
                                ))}
                                <View style={[styles.ruleOptRow, { marginTop: spacing.xs }]}>
                                  <Text style={[styles.ruleOptName, { color: colors.textMuted, fontStyle: 'italic' }]}>
                                    Por defecto
                                  </Text>
                                  <Text style={[styles.ruleArrow, { color: colors.textMuted }]}>máx</Text>
                                  <TextInput
                                    style={[styles.maxSelInput, { backgroundColor: colors.surfaceHighlight, color: colors.textPrimary }]}
                                    value={cg.selectionRule!.defaultMax}
                                    onChangeText={(v) => setDefaultMax(cg.id, v)}
                                    keyboardType="numeric"
                                  />
                                </View>
                                <Text style={[styles.ruleHint, { color: colors.textMuted }]}>
                                  El máximo nunca supera el "Máx" del grupo ({cg.maxSelections}).
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  );
                })}

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

      {/* ─── Category Modal ────────────────────────────────────────────────────── */}
      <Modal visible={catModalVisible} animationType="slide" transparent statusBarTranslucent>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalWrapper}>
            <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
              <View style={styles.modalHandle}>
                <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
              </View>

              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {isNewCat ? 'Nueva Categoría' : 'Editar Categoría'}
                </Text>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={handleTranslateCategory}
                    disabled={isCatTranslating || !editingCat.name.es.trim()}
                    style={{
                      backgroundColor: isCatTranslating ? colors.surfaceHighlight : colors.surface,
                      borderColor: colors.borderLight,
                      borderWidth: StyleSheet.hairlineWidth,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {isCatTranslating ? (
                      <Loader2 color={colors.primary} size={14} />
                    ) : (
                      <Wand2 color={colors.primary} size={14} />
                    )}
                    <Text style={{ fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: isCatTranslating ? colors.textMuted : colors.textPrimary }}>
                      Traducir
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCatModalVisible(false)}
                    style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceHighlight }]}
                  >
                    <X color={colors.textPrimary} size={16} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {/* Name */}
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>NOMBRE</Text>
                <View style={styles.bilingualField}>
                  <View style={[styles.langBadge, { backgroundColor: colors.surfaceHighlight }]}>
                    <Text style={[styles.langBadgeText, { color: colors.textMuted }]}>ES</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.bilingualInput, { backgroundColor: colors.surfaceContainer, borderColor: colors.borderLight, color: colors.textPrimary }]}
                    value={editingCat.name.es}
                    onChangeText={(v) => setEditingCat((p) => ({ ...p, name: { ...p.name, es: v } }))}
                    placeholder="Nombre de la categoría"
                    placeholderTextColor={colors.textMuted}
                    autoFocus
                  />
                </View>
                <View style={[styles.bilingualField, { marginBottom: spacing.xl }]}>
                  <View style={[styles.langBadge, { backgroundColor: colors.primary + '22' }]}>
                    <Text style={[styles.langBadgeText, { color: colors.primary }]}>EN</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.bilingualInput, { backgroundColor: colors.surfaceContainer, borderColor: editingCat.name.en ? colors.primary + '55' : colors.borderLight, color: colors.textPrimary }]}
                    value={editingCat.name.en}
                    onChangeText={(v) => setEditingCat((p) => ({ ...p, name: { ...p.name, en: v } }))}
                    placeholder="Category name (English)"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </ScrollView>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: editingCat.name.es.trim() ? colors.primary : colors.surfaceHighlight }]}
                onPress={handleSaveCategory}
                activeOpacity={0.85}
                disabled={!editingCat.name.es.trim()}
              >
                <Text style={[styles.saveBtnText, { color: editingCat.name.es.trim() ? colors.onPrimary : colors.textMuted }]}>
                  {isNewCat ? 'Crear Categoría' : 'Guardar Cambios'}
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
    flexGrow: 0,
    flexShrink: 0,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  tabBarContent: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
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
  tabAdd: {
    paddingHorizontal: spacing.md,
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
    transform: [{ scale: 1.15 }],
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
    // flexShrink lets the sheet cap at the wrapper's maxHeight so the inner
    // ScrollView (flexShrink) gets a bounded height and actually scrolls, instead
    // of growing to content height and pushing the save button off-screen.
    flexShrink: 1,
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
    // Shrink-only (not flex:1 grow): sizes to content and only shrinks when the
    // sheet hits modalWrapper's maxHeight, so it scrolls long forms and pins the
    // save button — without collapsing to 0 height when the parent has no
    // definite height (which blanked the whole modal into a frozen dark overlay).
    flexShrink: 1,
    minHeight: 0,
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
  bilingualField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  bilingualInput: {
    flex: 1,
  },
  langBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.5,
  },
  cgNameInputEn: {
    marginTop: 6,
    fontSize: fontSizes.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  optionNameInput: {
    borderRadius: 8,
    padding: spacing.sm,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  optionNameInputEn: {
    fontSize: fontSizes.xs,
    borderWidth: StyleSheet.hairlineWidth,
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

  // Conditional-max rule editor
  ruleBlock: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ruleToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ruleCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleCheck: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  ruleToggleText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSizes.sm,
  },
  ruleLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  ruleOptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  ruleOptName: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
  },
  ruleArrow: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
  },
  ruleHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    fontStyle: 'italic',
    marginTop: spacing.xs,
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
