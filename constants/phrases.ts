import { Phrase } from '@/types';

const p = (id: string, categoryId: string, text: string, sortOrder: number): Phrase => ({
  id, categoryId, text, sortOrder, isCustom: false, usageCount: 0,
});

export const DEFAULT_PHRASES: Phrase[] = [
  // Help / Needs
  p('help-all-done', 'help-needs', 'All done', 0),
  p('help-break', 'help-needs', 'Take a break', 1),
  p('help-need-help', 'help-needs', 'I need help', 2),
  p('help-hungry', 'help-needs', 'I am hungry', 3),
  p('help-thirsty', 'help-needs', 'I am thirsty', 4),
  p('help-bathroom', 'help-needs', 'Bathroom', 5),
  p('help-yes', 'help-needs', 'Yes', 6),
  p('help-no', 'help-needs', 'No', 7),

  // Quick Talk
  p('qt-hello', 'quick-talk', 'Hello', 0),
  p('qt-goodbye', 'quick-talk', 'Goodbye', 1),
  p('qt-thank-you', 'quick-talk', 'Thank you', 2),
  p('qt-please', 'quick-talk', 'Please', 3),
  p('qt-excuse-me', 'quick-talk', 'Excuse me', 4),
  p('qt-dont-understand', 'quick-talk', "I don't understand", 5),
  p('qt-wait', 'quick-talk', 'Wait', 6),
  p('qt-come-here', 'quick-talk', 'Come here', 7),
  p('qt-how-are-you', 'quick-talk', 'How are you?', 8),
  p('qt-im-good', 'quick-talk', "I'm good", 9),
  p('qt-sorry', 'quick-talk', 'Sorry', 10),
  p('qt-i-dont-know', 'quick-talk', "I don't know", 11),

  // Places / Plans
  p('pl-mall', 'places-plans', 'Mall', 0),
  p('pl-walking', 'places-plans', 'Walking', 1),
  p('pl-lake', 'places-plans', 'Lake', 2),
  p('pl-grocery', 'places-plans', 'Grocery store', 3),
  p('pl-pool', 'places-plans', 'Pool', 4),
  p('pl-library', 'places-plans', 'Library', 5),
  p('pl-park', 'places-plans', 'Park', 6),
  p('pl-car', 'places-plans', 'Car', 7),
  p('pl-home', 'places-plans', 'Home', 8),
  p('pl-school', 'places-plans', 'School', 9),
  p('pl-restaurant', 'places-plans', 'Restaurant', 10),

  // Food / Ordering
  p('fd-water', 'food-ordering', 'Water', 0),
  p('fd-juice', 'food-ordering', 'Juice', 1),
  p('fd-milk', 'food-ordering', 'Milk', 2),
  p('fd-pizza', 'food-ordering', 'Pizza', 3),
  p('fd-sandwich', 'food-ordering', 'Sandwich', 4),
  p('fd-chicken', 'food-ordering', 'Chicken', 5),
  p('fd-fries', 'food-ordering', 'Fries', 6),
  p('fd-fruit', 'food-ordering', 'Fruit', 7),
  p('fd-snack', 'food-ordering', 'Snack', 8),
  p('fd-more', 'food-ordering', 'More please', 9),
  p('fd-no-thanks', 'food-ordering', 'No thanks', 10),

  // People / Social
  p('pp-mom', 'people-social', 'Mom', 0),
  p('pp-dad', 'people-social', 'Dad', 1),
  p('pp-teacher', 'people-social', 'Teacher', 2),
  p('pp-friend', 'people-social', 'Friend', 3),
  p('pp-family', 'people-social', 'Family', 4),
  p('pp-doctor', 'people-social', 'Doctor', 5),
  p('pp-brother', 'people-social', 'Brother', 6),
  p('pp-sister', 'people-social', 'Sister', 7),

  // School / Work
  p('sw-class', 'school-work', 'Class', 0),
  p('sw-homework', 'school-work', 'Homework', 1),
  p('sw-computer', 'school-work', 'Computer', 2),
  p('sw-book', 'school-work', 'Book', 3),
  p('sw-pencil', 'school-work', 'Pencil', 4),
  p('sw-question', 'school-work', 'I have a question', 5),
  p('sw-finished', 'school-work', "I'm finished", 6),
  p('sw-help', 'school-work', 'I need help with this', 7),
];
