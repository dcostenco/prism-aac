import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerHandler,
  getHandler,
  hasHandler,
  listRegisteredKinds,
  listMissingKinds,
  _resetRegistryForTests,
} from '@/lib/marketplace/registry';
import { _resetBootForTests, bootHandlers } from '@/lib/marketplace/handlers';
import { MODULE_KINDS, type ModuleHandler } from '@/lib/marketplace/types';

const stub: ModuleHandler = {
  kind: 'vocab-set',
  validate: () => true,
  install: () => {},
  uninstall: () => {},
  isActive: () => false,
};

beforeEach(() => {
  _resetRegistryForTests();
  _resetBootForTests();
});

describe('marketplace/registry', () => {
  it('starts empty', () => {
    expect(listRegisteredKinds()).toEqual([]);
    expect(listMissingKinds()).toEqual([...MODULE_KINDS]);
  });

  it('register + lookup round-trip', () => {
    registerHandler(stub);
    expect(hasHandler('vocab-set')).toBe(true);
    expect(getHandler('vocab-set')).toBe(stub);
  });

  it('returns undefined for unknown kind', () => {
    expect(getHandler('vocab-set')).toBeUndefined();
  });

  it('throws on duplicate registration', () => {
    registerHandler(stub);
    expect(() => registerHandler(stub)).toThrow(/duplicate handler/);
  });

  it('listRegisteredKinds returns insertion order', () => {
    registerHandler({ ...stub, kind: 'vocab-set' });
    registerHandler({ ...stub, kind: 'panel' });
    expect(listRegisteredKinds()).toEqual(['vocab-set', 'panel']);
  });

  it('listMissingKinds shrinks as handlers register', () => {
    expect(listMissingKinds()).toHaveLength(MODULE_KINDS.length);
    registerHandler(stub);
    expect(listMissingKinds()).toHaveLength(MODULE_KINDS.length - 1);
    expect(listMissingKinds()).not.toContain('vocab-set');
  });
});

describe('marketplace/registry — bootHandlers', () => {
  it('registers all 6 handlers exactly once', () => {
    bootHandlers();
    expect(listRegisteredKinds().sort()).toEqual([
      'board-template',
      'game-pack',
      'panel',
      'symbol-library',
      'vocab-set',
      'voice-pack',
    ]);
    expect(listMissingKinds()).toEqual([]);
  });

  it('is idempotent — second call is a no-op', () => {
    bootHandlers();
    expect(() => bootHandlers()).not.toThrow();
    expect(listRegisteredKinds()).toHaveLength(6);
  });
});
