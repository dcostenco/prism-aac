import { Category } from '@/types';

const sub = (id: string, name: string, icon: string, parentId: string, sortOrder: number): Category => ({
  id, name, icon, sortOrder, isCustom: false, parentId,
});

export const DEFAULT_CATEGORIES: Category[] = [
  // ── Core Words (SLP: 80% of daily communication) ──────────────────────────
  { id: 'core-pronouns',    name: 'I / You / We',      icon: '👤', sortOrder: 0,  isCustom: false, nameKey: 'cat_core_pronouns' },
  { id: 'core-verbs',       name: 'Core Verbs',         icon: '⚡', sortOrder: 1,  isCustom: false, nameKey: 'cat_core_verbs' },
  { id: 'core-descriptors', name: 'More / Not / All',   icon: '📐', sortOrder: 2,  isCustom: false, nameKey: 'cat_core_descriptors' },
  { id: 'core-little-words',name: 'Little Words',       icon: '🔗', sortOrder: 3,  isCustom: false, nameKey: 'cat_core_little' },

  // ── Communicative Functions ───────────────────────────────────────────────
  { id: 'help-needs',   name: 'Help / Needs',     icon: '🆘', sortOrder: 4,  isCustom: false, nameKey: 'cat_help_needs' },
  { id: 'quick-talk',   name: 'Quick Talk',        icon: '💬', sortOrder: 5,  isCustom: false, nameKey: 'cat_quick_talk' },
  { id: 'feelings',     name: 'Feelings',          icon: '😊', sortOrder: 6,  isCustom: false, nameKey: 'cat_feelings' },
  { id: 'questions',    name: 'Questions',         icon: '❓', sortOrder: 7,  isCustom: false, nameKey: 'cat_questions' },

  // ── Fringe Vocabulary (top-level folders) ────────────────────────────────
  { id: 'actions',       name: 'Actions',           icon: '🏃', sortOrder: 8,  isCustom: false, nameKey: 'cat_actions' },
  { id: 'describing',   name: 'Describing Words',  icon: '🎨', sortOrder: 9,  isCustom: false, nameKey: 'cat_describing' },
  { id: 'people-social',name: 'People',            icon: '👥', sortOrder: 10, isCustom: false, nameKey: 'cat_people' },
  { id: 'food-ordering',name: 'Food & Drink',      icon: '🍽️', sortOrder: 11, isCustom: false, nameKey: 'cat_food' },
  { id: 'places-plans', name: 'Places',            icon: '📍', sortOrder: 12, isCustom: false, nameKey: 'cat_places' },
  { id: 'school-work',  name: 'School / Work',     icon: '📚', sortOrder: 13, isCustom: false, nameKey: 'cat_school' },
  { id: 'health-body',  name: 'Health / Body',     icon: '🏥', sortOrder: 14, isCustom: false, nameKey: 'cat_health' },
  { id: 'time',         name: 'Time',              icon: '🕐', sortOrder: 15, isCustom: false, nameKey: 'cat_time' },
  { id: 'animals',      name: 'Animals',           icon: '🐾', sortOrder: 16, isCustom: false, nameKey: 'cat_animals' },
  { id: 'colors',       name: 'Colors',            icon: '🌈', sortOrder: 17, isCustom: false, nameKey: 'cat_colors' },
  { id: 'clothes',      name: 'Clothes',           icon: '👕', sortOrder: 18, isCustom: false, nameKey: 'cat_clothes' },
  { id: 'transport',    name: 'Transportation',    icon: '🚗', sortOrder: 19, isCustom: false, nameKey: 'cat_transport' },
  { id: 'weather',      name: 'Weather',           icon: '🌤️', sortOrder: 20, isCustom: false, nameKey: 'cat_weather' },
  { id: 'toys-fun',     name: 'Toys & Fun',        icon: '🎮', sortOrder: 21, isCustom: false, nameKey: 'cat_toys' },

  // ── Time subcategories ───────────────────────────────────────────────────
  sub('time-clock',  'Clock Time',       '🕐', 'time', 0),
  sub('time-days',   'Days of the Week', '📅', 'time', 1),
  sub('time-months', 'Months',           '🗓️', 'time', 2),
  sub('time-dates',  'Dates',            '🔢', 'time', 3),
  sub('time-seasons','Seasons',          '🍂', 'time', 4),

  // ── Food & Drink subcategories ────────────────────────────────────────────
  sub('food-meals',     'Meals',          '🍳', 'food-ordering', 0),
  sub('food-fruits',    'Fruits',         '🍎', 'food-ordering', 1),
  sub('food-veggies',   'Vegetables',     '🥦', 'food-ordering', 2),
  sub('food-snacks',    'Snacks',         '🍿', 'food-ordering', 3),
  sub('food-drinks',    'Drinks',         '🧃', 'food-ordering', 4),
  sub('food-sweets',    'Sweets',         '🍬', 'food-ordering', 5),

  // ── People subcategories ──────────────────────────────────────────────────
  sub('people-family',  'Family',         '👨‍👩‍👧', 'people-social', 0),
  sub('people-school',  'School People',  '🧑‍🏫', 'people-social', 1),
  sub('people-community','Community',     '👮', 'people-social', 2),

  // ── Health / Body subcategories ───────────────────────────────────────────
  sub('health-body-parts', 'Body Parts',  '🫀', 'health-body', 0),
  sub('health-feelings',   'Feeling Sick','🤒', 'health-body', 1),
  sub('health-medicines',  'Medicine',    '💊', 'health-body', 2),
  sub('health-routines',   'Daily Care',  '🪥', 'health-body', 3),

  // ── Animals subcategories ─────────────────────────────────────────────────
  sub('animals-pets',    'Pets',          '🐶', 'animals', 0),
  sub('animals-farm',    'Farm Animals',  '🐄', 'animals', 1),
  sub('animals-wild',    'Wild Animals',  '🦁', 'animals', 2),
  sub('animals-birds',   'Birds',         '🐦', 'animals', 3),
  sub('animals-sea',     'Sea Animals',   '🐠', 'animals', 4),

  // ── Places subcategories ──────────────────────────────────────────────────
  sub('places-school', 'School',          '🏫', 'places-plans', 0),
  sub('places-home',   'Home Rooms',      '🏠', 'places-plans', 1),
  sub('places-outside','Outside',         '🌳', 'places-plans', 2),
  sub('places-stores', 'Stores',          '🏪', 'places-plans', 3),
  sub('places-medical','Medical',         '🏥', 'places-plans', 4),
];
