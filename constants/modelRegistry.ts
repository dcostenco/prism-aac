/**
 * Prism model registry — Qwen3.5 fleet (June 2026).
 *
 * HuggingFace: dcostenco/prism-coder-{2b,4b,9b,27b} (public GGUF)
 * Ollama Hub:  dcostenco/prism-coder:{2b,4b,9b,27b}
 */

export interface ModelSpec {
  ollamaTag: string;
  iosFile: string;
  hfRepo: string;
  version: string;
  accuracy: number;
  sizeGB: number;
  minFreeMB: number;
  role: string;
}

export const MODEL_REGISTRY = {
  '2b': {
    ollamaTag:  'dcostenco/prism-coder:2b',
    iosFile:    'prism-coder-2b-v43-Q3_K_M',
    hfRepo:     'dcostenco/prism-coder-2b',
    version:    'v43',
    accuracy:   99.1,
    sizeGB:     2.3,
    minFreeMB:  3_000,
    role:       'iPhone / mobile · always fits · ~0.5s',
  },
  '4b': {
    ollamaTag:  'dcostenco/prism-coder:4b',
    iosFile:    'prism-coder-4b-v43-Q4_K_M',
    hfRepo:     'dcostenco/prism-coder-4b',
    version:    'v43',
    accuracy:   100.0,
    sizeGB:     3.4,
    minFreeMB:  5_000,
    role:       'iPhone 15/16 Pro · iPad Air · verifier',
  },
  '9b': {
    ollamaTag:  'dcostenco/prism-coder:9b',
    iosFile:    '',
    hfRepo:     'dcostenco/prism-coder-9b',
    version:    'v35',
    accuracy:   100.0,
    sizeGB:     5.8,
    minFreeMB:  8_000,
    role:       'Mac 16 GB+ · default router · 78 tok/s',
  },
  '27b': {
    ollamaTag:  'dcostenco/prism-coder:27b',
    iosFile:    '',
    hfRepo:     'dcostenco/prism-coder-27b',
    version:    'v3',
    accuracy:   100.0,
    sizeGB:     16.8,
    minFreeMB:  20_000,
    role:       'Mac 24 GB+ · quality tier (DeltaNet) · 28.5 tok/s',
  },
} as const satisfies Record<string, ModelSpec>;

export type ModelId = keyof typeof MODEL_REGISTRY;

export const SIDELOAD_ORDER: ModelId[] = ['27b', '9b', '4b', '2b'];
