export type SceneType =
  | 'mealtime' | 'snacktime' | 'bedtime' | 'bathtime'
  | 'playtime' | 'schoolwork' | 'outdoors' | 'travel'
  | 'watching_tv' | 'reading' | 'grooming' | 'unknown';

export interface SceneResult {
  scene: SceneType;
  confidence: number;
  matchedObjects: string[];
}

export interface SceneRule {
  scene: SceneType;
  objects: string[];
  minRequired: number;
  baseConfidence: number;
  timeBoost?: Partial<Record<TimePeriod, number>>;
}

type TimePeriod = 'morning' | 'afternoon' | 'evening' | 'night';

function getTimePeriod(hour: number): TimePeriod {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 23) return 'evening';
  return 'night';
}

const SCENE_RULES: readonly SceneRule[] = [
  {
    scene: 'mealtime',
    objects: ['cup', 'bowl', 'fork', 'spoon', 'knife', 'bottle', 'dining table'],
    minRequired: 2,
    baseConfidence: 0.7,
    timeBoost: { morning: 0.1, afternoon: 0.15, evening: 0.1 },
  },
  {
    scene: 'snacktime',
    objects: ['cup', 'bottle', 'banana', 'apple', 'orange', 'sandwich'],
    minRequired: 2,
    baseConfidence: 0.5,
    timeBoost: { morning: 0.05, afternoon: 0.1 },
  },
  {
    scene: 'bedtime',
    objects: ['bed', 'teddy bear', 'clock'],
    minRequired: 1,
    baseConfidence: 0.6,
    timeBoost: { evening: 0.2, night: 0.3 },
  },
  {
    scene: 'bathtime',
    objects: ['toilet', 'sink', 'toothbrush'],
    minRequired: 1,
    baseConfidence: 0.65,
  },
  {
    scene: 'playtime',
    objects: ['teddy bear', 'sports ball', 'kite', 'frisbee'],
    minRequired: 1,
    baseConfidence: 0.6,
    timeBoost: { afternoon: 0.1 },
  },
  {
    scene: 'schoolwork',
    objects: ['book', 'laptop', 'keyboard', 'scissors', 'backpack'],
    minRequired: 1,
    baseConfidence: 0.5,
    timeBoost: { morning: 0.2 },
  },
  {
    scene: 'watching_tv',
    objects: ['tv', 'remote', 'couch'],
    minRequired: 1,
    baseConfidence: 0.55,
    timeBoost: { evening: 0.1 },
  },
  {
    scene: 'reading',
    objects: ['book'],
    minRequired: 1,
    baseConfidence: 0.45,
  },
  {
    scene: 'outdoors',
    objects: ['bicycle', 'car', 'bus', 'truck', 'bench', 'bird', 'dog', 'cat'],
    minRequired: 2,
    baseConfidence: 0.5,
    timeBoost: { afternoon: 0.1 },
  },
  {
    scene: 'travel',
    objects: ['car', 'bus', 'truck', 'airplane', 'train', 'suitcase', 'backpack'],
    minRequired: 2,
    baseConfidence: 0.5,
  },
  {
    scene: 'grooming',
    objects: ['toothbrush', 'hair drier', 'scissors'],
    minRequired: 1,
    baseConfidence: 0.5,
    timeBoost: { morning: 0.15 },
  },
];

export function getSceneRules(): readonly SceneRule[] {
  return SCENE_RULES;
}

export function inferScene(
  objects: string[],
  hourOfDay?: number,
): SceneResult {
  const objectSet = new Set(objects.map(o => o.toLowerCase()));
  const period = getTimePeriod(hourOfDay ?? new Date().getHours());

  let bestScene: SceneType = 'unknown';
  let bestConfidence = 0;
  let bestMatched: string[] = [];

  for (const rule of SCENE_RULES) {
    const matched = rule.objects.filter(o => objectSet.has(o));
    if (matched.length < rule.minRequired) continue;

    const extraMatchBoost = Math.min((matched.length - rule.minRequired) * 0.1, 0.25);
    const timeBoost = rule.timeBoost?.[period] ?? 0;
    const confidence = Math.min(rule.baseConfidence + extraMatchBoost + timeBoost, 1.0);

    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestScene = rule.scene;
      bestMatched = matched;
    }
  }

  return { scene: bestScene, confidence: bestConfidence, matchedObjects: bestMatched };
}
