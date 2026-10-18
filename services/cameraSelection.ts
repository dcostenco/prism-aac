/** Instance-owned setup suspension. This gates camera-driven actions only;
 * manual controls and keyboard escape are deliberately unaffected. Epochs
 * invalidate partial credit even if a dialog opens/closes between frames. */
let epoch = 0;
const owners = new Set<symbol>();
const listeners = new Set<() => void>();
let pendingSwitchRelease: (() => void) | null = null;
const notify = () => { for (const listener of listeners) {
  try { listener(); } catch { console.warn('[CameraSelection] subscriber failed'); }
} };
export function subscribeCameraSelection(listener: () => void): () => void {
  listeners.add(listener); return () => { listeners.delete(listener); };
}

export function readCameraSelectionState(): Readonly<{ epoch: number; blocked: boolean }> {
  return { epoch, blocked: owners.size > 0 };
}

export function canActivateCameraSelection(expectedEpoch: number): boolean {
  return owners.size === 0 && epoch === expectedEpoch;
}

export function suspendCameraSelection(): () => void {
  const owner = Symbol('camera-pointer-only');
  owners.add(owner); epoch++; notify();
  return () => { if (owners.delete(owner)) { epoch++; notify(); } };
}

/** Fence enable/restore synchronously, before a deferred controller can mount. */
export function stageSwitchScanOwnership(enabled: boolean): void {
  if (!enabled) { finishSwitchScanOwnershipStaging(); return; }
  if (pendingSwitchRelease) return;
  let cancelled = false;
  let release: (() => void) | null = null;
  // Publish the fence handle before notifications can reenter configuration.
  pendingSwitchRelease = () => { cancelled = true; release?.(); };
  release = suspendCameraSelection();
  if (cancelled) release();
}

/** The controller acquires its real lease before retiring the staging fence. */
export function finishSwitchScanOwnershipStaging(): void {
  const release = pendingSwitchRelease;
  pendingSwitchRelease = null;
  release?.();
}
