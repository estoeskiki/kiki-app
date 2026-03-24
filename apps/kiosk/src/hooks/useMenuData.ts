import { useMemo } from 'react';
import { categories as allCategories } from '@/data/categories';
import { menuItems as allMenuItems } from '@/data/menu';
import type { Category, MenuItem } from '@/data/types';

interface UseMenuDataResult {
    /** All available categories, sorted by sortOrder. */
    categories: Category[];

    /** All menu items. */
    menuItems: MenuItem[];

    /** Returns items belonging to a specific category. Only includes available items. */
    getItemsByCategory: (categoryId: string) => MenuItem[];

    /** Returns a single menu item by id, or undefined. */
    getItemById: (itemId: string) => MenuItem | undefined;

    /** Returns only items marked as popular. */
    popularItems: MenuItem[];
}

/**
 * Convenience hook that wraps the local mock data.
 *
 * When Supabase is integrated later, this hook will be swapped to
 * fetch from the DB while keeping the same return shape so screens
 * don't need any changes.
 */
export function useMenuData(): UseMenuDataResult {
    const categories = useMemo(
        () => [...allCategories].sort((a, b) => a.sortOrder - b.sortOrder),
        [],
    );

    const menuItems = allMenuItems;

    const itemsByCategory = useMemo(() => {
        const map = new Map<string, MenuItem[]>();
        for (const item of allMenuItems) {
            if (!item.available) continue;
            const list = map.get(item.categoryId) ?? [];
            list.push(item);
            map.set(item.categoryId, list);
        }
        return map;
    }, []);

    const getItemsByCategory = (categoryId: string): MenuItem[] =>
        itemsByCategory.get(categoryId) ?? [];

    const getItemById = (itemId: string): MenuItem | undefined =>
        allMenuItems.find((item) => item.id === itemId);

    const popularItems = useMemo(
        () => allMenuItems.filter((item) => item.available && item.popular),
        [],
    );

    return {
        categories,
        menuItems,
        getItemsByCategory,
        getItemById,
        popularItems,
    };
}
