export interface BenchmarkCase {
  appCode: string;
  locale: string;
  language: string;
  reviewStatus?: string;
  caseId: string;
  kind: string;
  text: string;
}

export interface BenchmarkResult extends BenchmarkCase {
  provider: string;
  run: number;
  ok: boolean;
  status: number | null;
  error: string | null;
  responseHeadersMs: number | null;
  ttfaMs: number | null;
  totalMs: number;
  audioBytes: number;
  contentType: string;
}

export interface BenchmarkSummary {
  attempts: number;
  successes: number;
  errors: number;
  errorRate: number | null;
  ttfaP50Ms: number | null;
  ttfaP95Ms: number | null;
  totalP50Ms: number | null;
  totalP95Ms: number | null;
  byLocale: Record<string, {
    attempts: number;
    successes: number;
    errors: number;
    ttfaP95Ms: number | null;
    totalP95Ms: number | null;
  }>;
}

export function flattenCorpus(
  corpus: {
    locales?: Array<{
      appCode: string;
      locale: string;
      language: string;
      reviewStatus?: string;
      cases?: Array<{ id: string; kind: string; text: string }>;
    }>;
  },
  filters?: { locales?: string[]; cases?: string[] },
): BenchmarkCase[];

export function benchmarkSynthesis(options: {
  endpoint: string;
  provider: string;
  benchmarkCase: BenchmarkCase;
  run: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxAudioBytes?: number;
  textField?: string;
  localeField?: string;
}): Promise<BenchmarkResult>;

export function summarizeBenchmark(results: BenchmarkResult[]): BenchmarkSummary;

export function runBenchmark(options: {
  endpoint: string;
  provider: string;
  cases: BenchmarkCase[];
  runs?: number;
  concurrency?: number;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxAudioBytes?: number;
  textField?: string;
  localeField?: string;
}): Promise<{ results: BenchmarkResult[]; summary: BenchmarkSummary }>;
