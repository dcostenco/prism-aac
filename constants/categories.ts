import { Category } from '@/types';

export const DEFAULT_CATEGORIES: Category[] = [
  // Core Words — SLP-recommended high-frequency vocabulary (80% of communication)
  { id: 'core-pronouns', name: 'I / You / We', icon: '👤', sortOrder: 0, isCustom: false, nameKey: 'cat_core_pronouns' },
  { id: 'core-verbs', name: 'Core Verbs', icon: '⚡', sortOrder: 1, isCustom: false, nameKey: 'cat_core_verbs' },
  { id: 'core-descriptors', name: 'More / Not / All', icon: '📐', sortOrder: 2, isCustom: false, nameKey: 'cat_core_descriptors' },
  { id: 'core-little-words', name: 'Little Words', icon: '🔗', sortOrder: 3, isCustom: false, nameKey: 'cat_core_little' },

  // Communicative functions
  { id: 'help-needs', name: 'Help / Needs', icon: '🆘', sortOrder: 4, isCustom: false, nameKey: 'cat_help_needs' },
  { id: 'quick-talk', name: 'Quick Talk', icon: '💬', sortOrder: 5, isCustom: false, nameKey: 'cat_quick_talk' },
  { id: 'feelings', name: 'Feelings', icon: '😊', sortOrder: 6, isCustom: false, nameKey: 'cat_feelings' },
  { id: 'questions', name: 'Questions', icon: '❓', sortOrder: 7, isCustom: false, nameKey: 'cat_questions' },

  // Fringe vocabulary
  { id: 'actions', name: 'Actions', icon: '🏃', sortOrder: 8, isCustom: false, nameKey: 'cat_actions' },
  { id: 'describing', name: 'Describing Words', icon: '🎨', sortOrder: 9, isCustom: false, nameKey: 'cat_describing' },
  { id: 'people-social', name: 'People', icon: '👥', sortOrder: 10, isCustom: false, nameKey: 'cat_people' },
  { id: 'food-ordering', name: 'Food & Drink', icon: '🍽️', sortOrder: 11, isCustom: false, nameKey: 'cat_food' },
  { id: 'places-plans', name: 'Places', icon: '📍', sortOrder: 12, isCustom: false, nameKey: 'cat_places' },
  { id: 'school-work', name: 'School / Work', icon: '📚', sortOrder: 13, isCustom: false, nameKey: 'cat_school' },
  { id: 'health-body', name: 'Health / Body', icon: '🏥', sortOrder: 14, isCustom: false, nameKey: 'cat_health' },
  { id: 'time', name: 'Time', icon: '🕐', sortOrder: 15, isCustom: false, nameKey: 'cat_time' },
  { id: 'animals', name: 'Animals', icon: '🐾', sortOrder: 16, isCustom: false, nameKey: 'cat_animals' },
  { id: 'colors', name: 'Colors', icon: '🌈', sortOrder: 17, isCustom: false, nameKey: 'cat_colors' },
  { id: 'clothes', name: 'Clothes', icon: '👕', sortOrder: 18, isCustom: false, nameKey: 'cat_clothes' },
  { id: 'transport', name: 'Transportation', icon: '🚗', sortOrder: 19, isCustom: false, nameKey: 'cat_transport' },
  { id: 'weather', name: 'Weather', icon: '🌤️', sortOrder: 20, isCustom: false, nameKey: 'cat_weather' },
  { id: 'toys-fun', name: 'Toys & Fun', icon: '🎮', sortOrder: 21, isCustom: false, nameKey: 'cat_toys' },
];
