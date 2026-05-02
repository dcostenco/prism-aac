/**
 * Handler bootstrap.
 *
 * Importing this module registers every shipped handler exactly once. Idem-
 * potent: if it's imported by both MarketplacePanel and the test setup,
 * subsequent registerHandler() calls are skipped (the registry rejects
 * duplicates by throwing, but the boot guard avoids that path).
 */
import { hasHandler, registerHandler } from '../registry';
import { boardTemplateHandler } from './boardTemplate';
import { gamePackHandler } from './gamePack';
import { panelHandler } from './panel';
import { symbolLibraryHandler } from './symbolLibrary';
import { vocabSetHandler } from './vocabSet';
import { voicePackHandler } from './voicePack';

let booted = false;

export function bootHandlers(): void {
  if (booted) return;
  for (const h of [
    vocabSetHandler,
    boardTemplateHandler,
    symbolLibraryHandler,
    gamePackHandler,
    voicePackHandler,
    panelHandler,
  ]) {
    if (!hasHandler(h.kind)) {
      registerHandler(h);
    }
  }
  booted = true;
}

/** Test-only — clears the boot guard so beforeEach can re-register. */
export function _resetBootForTests(): void {
  booted = false;
}
