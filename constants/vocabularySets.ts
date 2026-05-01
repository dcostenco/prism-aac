export interface VocabSet {
  id: string;
  name: string;
  nameKey: string;
  description: string;
  descKey: string;
  icon: string;
  categoryIds: string[];
  tier: 'free' | 'standard' | 'advanced' | 'enterprise';
}

export const VOCAB_SETS: VocabSet[] = [
  {
    id: 'all',
    name: 'All Categories',
    nameKey: 'vs_all_categories',
    description: 'Shows every available category',
    descKey: 'vs_all_categories_desc',
    icon: '📋',
    categoryIds: [],
    tier: 'free',
  },
  {
    id: 'my-core',
    name: 'My Core',
    nameKey: 'vs_my_core',
    description: 'Core words only — pronouns, verbs, descriptors, little words, help, quick talk, feelings, questions',
    descKey: 'vs_my_core_desc',
    icon: '⭐',
    categoryIds: ['core-pronouns', 'core-verbs', 'core-descriptors', 'core-little-words', 'help-needs', 'quick-talk', 'feelings', 'questions'],
    tier: 'free',
  },
  {
    id: 'basic',
    name: 'Basic Page Set',
    nameKey: 'vs_basic_page_set',
    description: 'Essential everyday categories for beginning communicators',
    descKey: 'vs_basic_page_set_desc',
    icon: '📖',
    categoryIds: ['help-needs', 'quick-talk', 'food-ordering', 'people-social', 'feelings'],
    tier: 'free',
  },
  {
    id: 'multichat',
    name: 'MultiChat 15',
    nameKey: 'vs_multichat_15',
    description: '15 most-used communicative and fringe categories',
    descKey: 'vs_multichat_15_desc',
    icon: '💬',
    categoryIds: [
      'core-pronouns', 'core-verbs', 'core-descriptors', 'core-little-words',
      'help-needs', 'quick-talk', 'feelings', 'questions',
      'actions', 'describing', 'people-social', 'food-ordering',
      'places-plans', 'school-work', 'health-body',
    ],
    tier: 'free',
  },
  {
    id: 'spelling',
    name: 'Spelling',
    nameKey: 'vs_spelling',
    description: 'Literacy-focused set with little words and questions',
    descKey: 'vs_spelling_desc',
    icon: '🔤',
    categoryIds: ['core-little-words', 'questions'],
    tier: 'free',
  },
  {
    id: 'aphasia',
    name: 'Aphasia',
    nameKey: 'vs_aphasia',
    description: 'Designed for adult users with aphasia',
    descKey: 'vs_aphasia_desc',
    icon: '🧠',
    categoryIds: ['help-needs', 'quick-talk', 'people-social', 'food-ordering', 'places-plans', 'health-body'],
    tier: 'standard',
  },
  {
    id: 'wordpower',
    name: 'WordPower',
    nameKey: 'vs_wordpower',
    description: 'All core words plus actions, describing, and questions',
    descKey: 'vs_wordpower_desc',
    icon: '💪',
    categoryIds: ['core-pronouns', 'core-verbs', 'core-descriptors', 'core-little-words', 'actions', 'describing', 'questions'],
    tier: 'standard',
  },
  {
    id: 'gateway',
    name: 'Gateway',
    nameKey: 'vs_gateway',
    description: 'Core pronouns, verbs, descriptors, feelings, questions, and actions',
    descKey: 'vs_gateway_desc',
    icon: '🚪',
    categoryIds: ['core-pronouns', 'core-verbs', 'core-descriptors', 'feelings', 'questions', 'actions'],
    tier: 'free',
  },
  {
    id: 'social-chat',
    name: 'Social Chat',
    nameKey: 'vs_social_chat',
    description: 'Quick talk, feelings, people, and questions for social interaction',
    descKey: 'vs_social_chat_desc',
    icon: '🗣️',
    categoryIds: ['quick-talk', 'feelings', 'people-social', 'questions'],
    tier: 'free',
  },
  {
    id: 'talk-about',
    name: 'Talk About',
    nameKey: 'vs_talk_about',
    description: 'Quick talk, feelings, questions, school, and toys for topic-based conversation',
    descKey: 'vs_talk_about_desc',
    icon: '🎯',
    categoryIds: ['quick-talk', 'feelings', 'questions', 'school-work', 'toys-fun'],
    tier: 'free',
  },
];
