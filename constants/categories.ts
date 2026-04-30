import { Category } from '@/types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'help-needs', name: 'Help / Needs', icon: '🆘', sortOrder: 0, isCustom: false },
  { id: 'quick-talk', name: 'Quick Talk', icon: '💬', sortOrder: 1, isCustom: false },
  { id: 'places-plans', name: 'Places / Plans', icon: '📍', sortOrder: 2, isCustom: false },
  { id: 'food-ordering', name: 'Food / Ordering', icon: '🍽️', sortOrder: 3, isCustom: false },
  { id: 'people-social', name: 'People / Social', icon: '👥', sortOrder: 4, isCustom: false },
  { id: 'school-work', name: 'School / Work', icon: '📚', sortOrder: 5, isCustom: false },
];
