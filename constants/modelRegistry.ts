/**
 * Prism model registry — ground truth fetched from HuggingFace model cards.
 *
 * DO NOT edit accuracy/version by hand. Run:
 *   bash scripts/update-model-registry.sh
 *
 * HuggingFace sources:
 *   dcostenco/prism-coder-1.7b  · dcostenco/prism-coder-8b
 *   dcostenco/prism-coder-14b   · dcostenco/prism-coder-32b
 */

export interface ModelSpec {
  /** Ollama tag (dcostenco/prism-coder:<id>) */
  ollamaTag: string;
  /** iOS GGUF filename stem (used in PrismAACApp.swift CDN path) */
  iosFile: string;
  /** HuggingFace repo id */
  hfRepo: string;
  /** Current fine-tune version on HuggingFace */
  version: string;
  /** BFCL routing accuracy (%) — 3-seed mean, 102 cases each */
  accuracy: number;
  /** GGUF file size in GB (iOS download / Ollama) */
  sizeGB: number;
  /** Minimum free RAM in MB required to load on iOS */
  minFreeMB: number;
  /** Human-readable role description */
  role: string;
}

export const MODEL_REGISTRY = {
  '1b7': {
    ollamaTag:  'dcostenco/prism-coder:1b7',
    iosFile:    'prism-aac-1b7-q4km',
    hfRepo:     'dcostenco/prism-coder-1.7b',
    version:    'v41',
    accuracy:   96.1,
    sizeGB:     1.1,
    minFreeMB:  1_200,
    role:       'On-device iOS · always fits · ~0.5s',
  },
  '8b': {
    ollamaTag:  'dcostenco/prism-coder:8b',
    iosFile:    'prism-aac-8b-q4km',
    hfRepo:     'dcostenco/prism-coder-8b',
    version:    'v35',
    accuracy:   98.0,
    sizeGB:     4.7,
    minFreeMB:  4_500,
    role:       'iOS 8 GB · balanced speed/accuracy · ~1s',
  },
  '14b': {
    ollamaTag:  'dcostenco/prism-coder:14b',
    iosFile:    'prism-aac-14b-q4km',
    hfRepo:     'dcostenco/prism-coder-14b',
    version:    'v33',
    accuracy:   97.1,
    sizeGB:     9.3,
    minFreeMB:  10_000,
    role:       'iPad Pro 16 GB · Mac M2 Pro+ · ~3s',
  },
  '32b': {
    ollamaTag:  'dcostenco/prism-coder:32b',
    iosFile:    '',
    hfRepo:     'dcostenco/prism-coder-32b',
    version:    'v33',
    accuracy:   99.0,
    sizeGB:     19.0,
    minFreeMB:  0,
    role:       'Mac M2 Ultra+ · clinical/enterprise · ~8s',
  },
} as const satisfies Record<string, ModelSpec>;

export type ModelId = keyof typeof MODEL_REGISTRY;

/** Ordered list for auto-sideload: best → smallest, so we pull the
 *  highest-accuracy model the user's hardware can handle. */
export const SIDELOAD_ORDER: ModelId[] = ['32b', '14b', '8b', '1b7'];
