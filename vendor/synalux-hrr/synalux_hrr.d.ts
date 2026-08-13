/* tslint:disable */
/* eslint-disable */

export class HrrHologram {
    free(): void;
    [Symbol.dispose](): void;
    clear(): void;
    encode(concept: string, summary: string): void;
    export_hologram(): Float64Array;
    get_summary(concept: string): string | undefined;
    import_hologram(data: Float64Array): void;
    constructor(dim?: number | null);
    probe(query: string, top_k: number): ProbeResult[];
    readonly count: number;
    readonly dimension: number;
}

export class ProbeResult {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly concept: string;
    readonly similarity: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_hrrhologram_free: (a: number, b: number) => void;
    readonly __wbg_proberesult_free: (a: number, b: number) => void;
    readonly hrrhologram_clear: (a: number) => void;
    readonly hrrhologram_count: (a: number) => number;
    readonly hrrhologram_dimension: (a: number) => number;
    readonly hrrhologram_encode: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly hrrhologram_export_hologram: (a: number) => [number, number];
    readonly hrrhologram_get_summary: (a: number, b: number, c: number) => [number, number];
    readonly hrrhologram_import_hologram: (a: number, b: number, c: number) => void;
    readonly hrrhologram_new: (a: number) => number;
    readonly hrrhologram_probe: (a: number, b: number, c: number, d: number) => [number, number];
    readonly proberesult_concept: (a: number) => [number, number];
    readonly proberesult_similarity: (a: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
