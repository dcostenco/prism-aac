/**
 * Handler registry — single lookup table from `kind` → ModuleHandler.
 *
 * Boot order:
 *   1. `lib/marketplace/handlers/index.ts` is imported once (e.g. by
 *      MarketplacePanel mount or app layout) and calls registerHandler() for
 *      every kind it ships.
 *   2. The marketplace store calls getHandler(kind) when applying install /
 *      uninstall / activeness checks.
 *
 * Duplicate registration is rejected — handler files are the source of truth
 * and registering a kind twice would mask a real bug.
 */
import type { ModuleHandler, ModuleKind } from './types';
import { MODULE_KINDS } from './types';

const HANDLERS = new Map<ModuleKind, ModuleHandler>();

export function registerHandler(handler: ModuleHandler): void {
  if (HANDLERS.has(handler.kind)) {
    throw new Error(`marketplace: duplicate handler for kind "${handler.kind}"`);
  }
  HANDLERS.set(handler.kind, handler);
}

export function getHandler(kind: ModuleKind): ModuleHandler | undefined {
  return HANDLERS.get(kind);
}

export function hasHandler(kind: ModuleKind): boolean {
  return HANDLERS.has(kind);
}

export function listRegisteredKinds(): ModuleKind[] {
  return [...HANDLERS.keys()];
}

/**
 * Test-only — clears the registry. Production code never calls this; tests
 * use it in beforeEach to reset between cases.
 */
export function _resetRegistryForTests(): void {
  HANDLERS.clear();
}

/** Returns the kinds in MODULE_KINDS that don't yet have a handler. */
export function listMissingKinds(): ModuleKind[] {
  return MODULE_KINDS.filter((k) => !HANDLERS.has(k));
}
