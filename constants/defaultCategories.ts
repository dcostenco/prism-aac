import { Category } from '../types';

export const DEFAULT_CATEGORIES: Omit<Category, 'createdAt'>[] = [
  {
    id: 'help-needs',
    name: 'Help / Needs',
    icon: '🆘',
    parentId: null,
    sortOrder: 0,
    isCustom: false,
  },
  {
    id: 'quick-talk',
    name: 'Quick Talk',
    icon: '💬',
    parentId: null,
    sortOrder: 1,
    isCustom: false,
  },
  {
    id: 'places-plans',
    name: 'Places / Plans',
    icon: '📍',
    parentId: null,
    sortOrder: 2,
    isCustom: false,
  },
  {
    id: 'food-ordering',
    name: 'Food / Ordering',
    icon: '🍽️',
    parentId: null,
    sortOrder: 3,
    isCustom: false,
  },
  {
    id: 'people-social',
    name: 'People / Social',
    icon: '👥',
    parentId: null,
    sortOrder: 4,
    isCustom: false,
  },
  {
    id: 'school-work',
    name: 'School / Work',
    icon: '📚',
    parentId: null,
    sortOrder: 5,
    isCustom: false,
  },
];
