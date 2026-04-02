import type { Category } from '@/data/types';

export const categories: Category[] = [
  {
    id: 'cat-burgers',
    name: 'Burgers',
    slug: 'burgers',
    icon: '🍔',
    sortOrder: 1,
  },
  {
    id: 'cat-sides',
    name: 'Sides',
    slug: 'sides',
    icon: '🍟',
    sortOrder: 2,
  },
  {
    id: 'cat-drinks',
    name: 'Drinks',
    slug: 'drinks',
    icon: '🥤',
    sortOrder: 3,
  },
  {
    id: 'cat-desserts',
    name: 'Desserts',
    slug: 'desserts',
    icon: '🍰',
    sortOrder: 4,
  },
  {
    id: 'cat-combos',
    name: 'Combos',
    slug: 'combos',
    icon: '⭐',
    sortOrder: 5,
  },
];
