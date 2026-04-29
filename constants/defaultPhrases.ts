import { Phrase, ToneStyle } from '../types';

type PhraseInput = {
  id: string;
  categoryId: string;
  text: string;
  displayText?: string;
  icon?: string;
  tone?: ToneStyle;
  sortOrder: number;
};

const phrase = (p: PhraseInput): Omit<Phrase, 'createdAt' | 'lastUsed'> => ({
  id: p.id,
  categoryId: p.categoryId,
  text: p.text,
  displayText: p.displayText ?? null,
  imageUri: null,
  ttsOverride: null,
  tone: p.tone ?? 'friendly',
  sortOrder: p.sortOrder,
  isCustom: false,
  usageCount: 0,
});

// ── Help / Needs ──
const helpPhrases: PhraseInput[] = [
  { id: 'help-all-done', categoryId: 'help-needs', text: 'All done', tone: 'calm', sortOrder: 0 },
  { id: 'help-break', categoryId: 'help-needs', text: 'Take a break', tone: 'calm', sortOrder: 1 },
  { id: 'help-need-help', categoryId: 'help-needs', text: 'I need help', tone: 'serious', sortOrder: 2 },
  { id: 'help-hungry', categoryId: 'help-needs', text: 'I am hungry', sortOrder: 3 },
  { id: 'help-thirsty', categoryId: 'help-needs', text: 'I am thirsty', sortOrder: 4 },
  { id: 'help-bathroom', categoryId: 'help-needs', text: 'Bathroom', tone: 'serious', sortOrder: 5 },
  { id: 'help-yes', categoryId: 'help-needs', text: 'Yes', tone: 'cheerful', sortOrder: 6 },
  { id: 'help-no', categoryId: 'help-needs', text: 'No', tone: 'serious', sortOrder: 7 },
];

// ── Quick Talk ──
const quickTalkPhrases: PhraseInput[] = [
  { id: 'qt-hello', categoryId: 'quick-talk', text: 'Hello', tone: 'cheerful', sortOrder: 0 },
  { id: 'qt-goodbye', categoryId: 'quick-talk', text: 'Goodbye', tone: 'friendly', sortOrder: 1 },
  { id: 'qt-thank-you', categoryId: 'quick-talk', text: 'Thank you', tone: 'cheerful', sortOrder: 2 },
  { id: 'qt-please', categoryId: 'quick-talk', text: 'Please', tone: 'friendly', sortOrder: 3 },
  { id: 'qt-excuse-me', categoryId: 'quick-talk', text: 'Excuse me', tone: 'friendly', sortOrder: 4 },
  { id: 'qt-dont-understand', categoryId: 'quick-talk', text: "I don't understand", tone: 'serious', sortOrder: 5 },
  { id: 'qt-wait', categoryId: 'quick-talk', text: 'Wait', tone: 'serious', sortOrder: 6 },
  { id: 'qt-come-here', categoryId: 'quick-talk', text: 'Come here', sortOrder: 7 },
  { id: 'qt-how-are-you', categoryId: 'quick-talk', text: 'How are you?', tone: 'cheerful', sortOrder: 8 },
  { id: 'qt-im-good', categoryId: 'quick-talk', text: "I'm good", tone: 'cheerful', sortOrder: 9 },
  { id: 'qt-sorry', categoryId: 'quick-talk', text: 'Sorry', tone: 'empathetic', sortOrder: 10 },
  { id: 'qt-i-dont-know', categoryId: 'quick-talk', text: "I don't know", sortOrder: 11 },
];

// ── Places / Plans ──
const placesPhrases: PhraseInput[] = [
  { id: 'pl-mall', categoryId: 'places-plans', text: 'Mall', sortOrder: 0 },
  { id: 'pl-walking', categoryId: 'places-plans', text: 'Walking', sortOrder: 1 },
  { id: 'pl-lake', categoryId: 'places-plans', text: 'Lake', sortOrder: 2 },
  { id: 'pl-grocery', categoryId: 'places-plans', text: 'Grocery store', sortOrder: 3 },
  { id: 'pl-pool', categoryId: 'places-plans', text: 'Pool', sortOrder: 4 },
  { id: 'pl-library', categoryId: 'places-plans', text: 'Library', sortOrder: 5 },
  { id: 'pl-park', categoryId: 'places-plans', text: 'Park', sortOrder: 6 },
  { id: 'pl-car', categoryId: 'places-plans', text: 'Car', sortOrder: 7 },
  { id: 'pl-home', categoryId: 'places-plans', text: 'Home', sortOrder: 8 },
  { id: 'pl-school', categoryId: 'places-plans', text: 'School', sortOrder: 9 },
  { id: 'pl-restaurant', categoryId: 'places-plans', text: 'Restaurant', sortOrder: 10 },
];

// ── Food / Ordering (general phrases) ──
const foodPhrases: PhraseInput[] = [
  { id: 'fd-water', categoryId: 'food-ordering', text: 'Water', sortOrder: 0 },
  { id: 'fd-juice', categoryId: 'food-ordering', text: 'Juice', sortOrder: 1 },
  { id: 'fd-milk', categoryId: 'food-ordering', text: 'Milk', sortOrder: 2 },
  { id: 'fd-pizza', categoryId: 'food-ordering', text: 'Pizza', sortOrder: 3 },
  { id: 'fd-sandwich', categoryId: 'food-ordering', text: 'Sandwich', sortOrder: 4 },
  { id: 'fd-chicken', categoryId: 'food-ordering', text: 'Chicken', sortOrder: 5 },
  { id: 'fd-fries', categoryId: 'food-ordering', text: 'Fries', sortOrder: 6 },
  { id: 'fd-fruit', categoryId: 'food-ordering', text: 'Fruit', sortOrder: 7 },
  { id: 'fd-snack', categoryId: 'food-ordering', text: 'Snack', sortOrder: 8 },
  { id: 'fd-more', categoryId: 'food-ordering', text: 'More please', tone: 'friendly', sortOrder: 9 },
  { id: 'fd-no-thanks', categoryId: 'food-ordering', text: 'No thanks', tone: 'friendly', sortOrder: 10 },
];

// ── People / Social ──
const peoplePhrases: PhraseInput[] = [
  { id: 'pp-mom', categoryId: 'people-social', text: 'Mom', sortOrder: 0 },
  { id: 'pp-dad', categoryId: 'people-social', text: 'Dad', sortOrder: 1 },
  { id: 'pp-teacher', categoryId: 'people-social', text: 'Teacher', sortOrder: 2 },
  { id: 'pp-friend', categoryId: 'people-social', text: 'Friend', sortOrder: 3 },
  { id: 'pp-family', categoryId: 'people-social', text: 'Family', sortOrder: 4 },
  { id: 'pp-doctor', categoryId: 'people-social', text: 'Doctor', sortOrder: 5 },
  { id: 'pp-brother', categoryId: 'people-social', text: 'Brother', sortOrder: 6 },
  { id: 'pp-sister', categoryId: 'people-social', text: 'Sister', sortOrder: 7 },
];

// ── School / Work ──
const schoolPhrases: PhraseInput[] = [
  { id: 'sw-class', categoryId: 'school-work', text: 'Class', sortOrder: 0 },
  { id: 'sw-homework', categoryId: 'school-work', text: 'Homework', sortOrder: 1 },
  { id: 'sw-computer', categoryId: 'school-work', text: 'Computer', sortOrder: 2 },
  { id: 'sw-book', categoryId: 'school-work', text: 'Book', sortOrder: 3 },
  { id: 'sw-pencil', categoryId: 'school-work', text: 'Pencil', sortOrder: 4 },
  { id: 'sw-question', categoryId: 'school-work', text: 'I have a question', tone: 'serious', sortOrder: 5 },
  { id: 'sw-finished', categoryId: 'school-work', text: "I'm finished", tone: 'cheerful', sortOrder: 6 },
  { id: 'sw-help', categoryId: 'school-work', text: 'I need help with this', tone: 'serious', sortOrder: 7 },
];

export const ALL_DEFAULT_PHRASES = [
  ...helpPhrases,
  ...quickTalkPhrases,
  ...placesPhrases,
  ...foodPhrases,
  ...peoplePhrases,
  ...schoolPhrases,
].map(phrase);
