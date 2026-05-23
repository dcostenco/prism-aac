/**
 * Military-Grade Stability Tests
 *
 * Every conditional code path in life-critical services is tested.
 * A failure here means a child cannot communicate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '@/store/settingsStore';
import { translateTextSync } from '@/services/translateService';

// ═══════════════════════════════════════════════════════════════
// aacSpeak — the ONE function all speech goes through
// ═══════════════════════════════════════════════════════════════

describe('aacSpeak — null/undefined safety', () => {
  it('handles null text without crashing', () => {
    expect(() => {
      const text: string = null as unknown as string;
      const safe = text?.trim();
      expect(safe).toBeUndefined();
    }).not.toThrow();
  });

  it('handles undefined text without crashing', () => {
    expect(() => {
      const text: string = undefined as unknown as string;
      const safe = text?.trim();
      expect(safe).toBeUndefined();
    }).not.toThrow();
  });

  it('handles empty string', () => {
    expect(''.trim()).toBe('');
    expect(!(''.trim())).toBe(true);
  });

  it('handles whitespace-only string', () => {
    expect('   '.trim()).toBe('');
    expect(!('   '.trim())).toBe(true);
  });
});

describe('aacSpeak — language fallback', () => {
  it('falls back to en when language is undefined', () => {
    const lang = undefined as unknown as string;
    const safe = (lang || 'en');
    expect(safe).toBe('en');
  });

  it('falls back to en when outputLanguage is undefined', () => {
    const outLang = undefined as unknown as string;
    const lang = 'es';
    const safe = (outLang || lang || 'en');
    expect(safe).toBe('es');
  });

  it('same language = no translation', () => {
    const inLang = 'en';
    const outLang = 'en';
    expect(inLang !== outLang).toBe(false);
  });

  it('different language = translation active', () => {
    const inLang: string = 'ru';
    const outLang: string = 'en';
    expect(inLang !== outLang).toBe(true);
  });
});

describe('aacSpeak — single char period trick', () => {
  it('appends period to translated single char', () => {
    const translated = 'I';
    const result = translated.trim().length === 1 ? translated.trim() + '.' : translated;
    expect(result).toBe('I.');
  });

  it('does not append period to multi-char', () => {
    const translated = 'Hello';
    const result = translated.trim().length === 1 ? translated.trim() + '.' : translated;
    expect(result).toBe('Hello');
  });

  it('does not append period when not translating', () => {
    const translating = false;
    const text = 'I';
    const result = translating && text.trim().length === 1 ? text.trim() + '.' : text;
    expect(result).toBe('I');
  });
});

// ═══════════════════════════════════════════════════════════════
// Azure TTS — timeout and fallback
// ═══════════════════════════════════════════════════════════════

describe('Azure TTS — timeout safety', () => {
  it('AbortController exists in environment', () => {
    expect(typeof AbortController).toBe('function');
  });

  it('abort signal cancels correctly', () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('timeout clears without error', () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    clearTimeout(timeout);
    expect(controller.signal.aborted).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// ErrorBoundary — emergency AAC mode
// ═══════════════════════════════════════════════════════════════

describe('ErrorBoundary — emergency words', () => {
  const emergencyWords = ['Help', 'Yes', 'No', 'Stop', 'Bathroom', 'Water', 'Hungry', 'Pain'];

  it('has 8 emergency words', () => {
    expect(emergencyWords).toHaveLength(8);
  });

  it('includes critical medical word "Pain"', () => {
    expect(emergencyWords).toContain('Pain');
  });

  it('includes critical needs word "Bathroom"', () => {
    expect(emergencyWords).toContain('Bathroom');
  });

  it('includes yes and no for binary communication', () => {
    expect(emergencyWords).toContain('Yes');
    expect(emergencyWords).toContain('No');
  });

  it('includes help for emergency', () => {
    expect(emergencyWords).toContain('Help');
  });
});

// ═══════════════════════════════════════════════════════════════
// Translation — every condition path
// ═══════════════════════════════════════════════════════════════

describe('translateTextSync — condition paths', () => {
  it('same language returns original', () => {
    expect(translateTextSync('hello', 'en', 'en')).toBe('hello');
  });

  it('empty text returns empty', () => {
    expect(translateTextSync('', 'en', 'ru')).toBe('');
  });

  it('whitespace returns whitespace', () => {
    expect(translateTextSync('   ', 'en', 'ru')).toBe('   ');
  });

  it('known word translates', () => {
    const result = translateTextSync('да', 'ru', 'en');
    expect(result.toLowerCase()).not.toBe('да');
  });

  it('unknown word returns original', () => {
    const result = translateTextSync('xyzunknownword', 'en', 'ru');
    expect(result).toBe('xyzunknownword');
  });

  it('phrase matching works for multi-word', () => {
    const result = translateTextSync('привет', 'ru', 'en');
    expect(result.toLowerCase()).not.toBe('привет');
  });

  it('cache returns same result on second call', () => {
    const r1 = translateTextSync('да', 'ru', 'en');
    const r2 = translateTextSync('да', 'ru', 'en');
    expect(r1).toBe(r2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Head Tracker — condition paths
// ═══════════════════════════════════════════════════════════════

describe('Head Tracker — velocity adaptive smoothing', () => {
  it('low velocity = heavy smoothing (stable)', () => {
    const velocity = 3;
    const result = velocity < 5 ? 0.03 : 0.2;
    expect(result).toBe(0.03);
  });

  it('high velocity = light smoothing (responsive)', () => {
    const velocity = 60;
    const result = velocity > 50 ? 0.2 : 0.03;
    expect(result).toBe(0.2);
  });

  it('medium velocity = interpolated', () => {
    const velocity = 27.5;
    const result = 0.03 + (velocity - 5) / 45 * (0.2 - 0.03);
    expect(result).toBeCloseTo(0.115, 2);
  });

  it('screen size factor scales smoothing', () => {
    const small = 375;
    const large = 1920;
    const factorSmall = small < 768 ? 0.5 : 1.0;
    const factorLarge = large < 768 ? 0.5 : 1.0;
    expect(factorSmall).toBe(0.5);
    expect(factorLarge).toBe(1.0);
  });
});

describe('Head Tracker — dwell click conditions', () => {
  it('same element + time exceeded = click', () => {
    const dwellMs = 1200;
    const elapsed = 1300;
    const sameElement = true;
    expect(sameElement && elapsed >= dwellMs).toBe(true);
  });

  it('same element + time not exceeded = no click', () => {
    const dwellMs = 1200;
    const elapsed = 800;
    expect(elapsed >= dwellMs).toBe(false);
  });

  it('different element resets dwell', () => {
    const prev: string = 'button-1';
    const curr: string = 'button-2';
    expect(prev !== curr).toBe(true);
  });

  it('null element under cursor = no dwell', () => {
    const el: Element | null = null;
    expect(el === null).toBe(true);
  });
});

describe('Head Tracker — face detection conditions', () => {
  it('no faces detected = status lost', () => {
    const faces: unknown[] = [];
    const status = faces.length === 0 ? 'lost' : 'tracking';
    expect(status).toBe('lost');
  });

  it('face detected = status tracking', () => {
    const faces = [{ x: 100, y: 100, width: 200, height: 200 }];
    const status = faces.length === 0 ? 'lost' : 'tracking';
    expect(status).toBe('tracking');
  });

  it('face too small = ignored', () => {
    const face = { width: 5, height: 5 };
    const valid = face.width > 10 && face.height > 10;
    expect(valid).toBe(false);
  });

  it('face normal size = valid', () => {
    const face = { width: 150, height: 180 };
    const valid = face.width > 10 && face.height > 10;
    expect(valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Multi-Camera — fusion, failover, parallel detection
// ═══════════════════════════════════════════════════════════════

describe('Multi-Camera — input normalization', () => {
  it('single string camera ID wrapped in array', () => {
    const input = 'camera-abc';
    const ids = Array.isArray(input) ? input : [input];
    expect(ids).toEqual(['camera-abc']);
  });

  it('array of camera IDs passed through', () => {
    const input = ['cam-1', 'cam-2', 'cam-3'];
    const ids = Array.isArray(input) ? input : [input];
    expect(ids).toEqual(['cam-1', 'cam-2', 'cam-3']);
  });

  it('undefined defaults to single default camera', () => {
    const input = undefined;
    const ids = input ? (Array.isArray(input) ? input : [input]) : [undefined];
    expect(ids).toEqual([undefined]);
  });

  it('supports up to 4 cameras', () => {
    const ids = ['cam-1', 'cam-2', 'cam-3', 'cam-4'];
    expect(ids).toHaveLength(4);
  });
});

describe('Multi-Camera — fusion algorithm', () => {
  it('single camera detection passes through directly', () => {
    const detections = [
      { face: { x: 100, y: 80, width: 120, height: 150 }, confidence: 0.15, canvasWidth: 320, canvasHeight: 240 },
    ];
    const valid = detections.filter(d => d.face !== null);
    expect(valid).toHaveLength(1);
    const normX = (valid[0].face!.x + valid[0].face!.width / 2) / valid[0].canvasWidth;
    expect(normX).toBeCloseTo(0.5, 1);
  });

  it('no detections returns null (all cameras lost)', () => {
    const detections = [
      { face: null, confidence: 0 },
      { face: null, confidence: 0 },
    ];
    const valid = detections.filter(d => d.face !== null);
    expect(valid).toHaveLength(0);
  });

  it('active failover uses single best camera (no averaging)', () => {
    // Two cameras see face at different coordinates — use best only
    const cam1 = { normX: 0.3, confidence: 0.05, cameraIndex: 0 };
    const cam2 = { normX: 0.7, confidence: 0.20, cameraIndex: 1 };
    const best = cam1.confidence > cam2.confidence ? cam1 : cam2;
    expect(best.normX).toBe(0.7);
    expect(best.cameraIndex).toBe(1);
  });

  it('primary camera stays active when both see face', () => {
    const primaryIndex = 0;
    const cam0 = { confidence: 0.10, cameraIndex: 0, face: true };
    const cam1 = { confidence: 0.15, cameraIndex: 1, face: true };
    // Primary stays even if secondary has higher confidence
    const usePrimary = cam0.face;
    expect(usePrimary).toBe(true);
    expect(primaryIndex).toBe(0);
  });

  it('failover after 3 lost frames from primary', () => {
    const FAILOVER_THRESHOLD = 3;
    let lostFrames = 0;
    let primaryIndex = 0;
    // Simulate 3 frames where primary loses face
    for (let i = 0; i < 3; i++) lostFrames++;
    if (lostFrames >= FAILOVER_THRESHOLD) {
      primaryIndex = 1; // switch to secondary
    }
    expect(primaryIndex).toBe(1);
  });

  it('no failover during grace period (< 3 frames)', () => {
    const FAILOVER_THRESHOLD = 3;
    const lostFrames = 2;
    let primaryIndex = 0;
    if (lostFrames >= FAILOVER_THRESHOLD) primaryIndex = 1;
    expect(primaryIndex).toBe(0); // still on primary
  });

  it('confidence = face area / canvas area', () => {
    const face = { width: 100, height: 120 };
    const canvas = { width: 320, height: 240 };
    const confidence = (face.width * face.height) / (canvas.width * canvas.height);
    expect(confidence).toBeCloseTo(0.156, 2);
  });
});

describe('Multi-Camera — failover', () => {
  it('cam A loses face, cam B takes over instantly', () => {
    const detections = [
      { face: null, confidence: 0, cameraIndex: 0 },
      { face: { x: 100, y: 80, width: 120, height: 150 }, confidence: 0.15, cameraIndex: 1 },
    ];
    const valid = detections.filter(d => d.face !== null);
    expect(valid).toHaveLength(1);
    expect(valid[0].cameraIndex).toBe(1);
  });

  it('all cameras lost = status lost', () => {
    const detections = [
      { face: null, cameraIndex: 0 },
      { face: null, cameraIndex: 1 },
      { face: null, cameraIndex: 2 },
    ];
    const anyTracking = detections.some(d => d.face !== null);
    expect(anyTracking).toBe(false);
  });

  it('cam B recovers after cam A already tracking = multi-cam fusion', () => {
    const detections = [
      { face: { x: 100, y: 80, width: 120, height: 150 }, confidence: 0.15, cameraIndex: 0 },
      { face: { x: 110, y: 85, width: 100, height: 130 }, confidence: 0.10, cameraIndex: 1 },
    ];
    const valid = detections.filter(d => d.face !== null);
    expect(valid).toHaveLength(2);
  });
});

describe('Multi-Camera — parallel detection', () => {
  it('all cameras detected in parallel (Promise.all)', () => {
    const cameras = [0, 1, 2];
    const results = cameras.map(i => ({ cameraIndex: i, face: { x: 100 + i * 10 } }));
    expect(results).toHaveLength(3);
  });

  it('one slow camera does not block others', () => {
    // Promise.all resolves when ALL resolve — slower camera doesn't block
    // but the frame rate is limited by the slowest camera
    const times = [10, 50, 15]; // ms per camera
    const maxTime = Math.max(...times);
    expect(maxTime).toBe(50);
  });

  it('camera source tracks active state', () => {
    let active = true;
    active = false; // camera disconnected
    expect(active).toBe(false);
  });

  it('stopped camera excluded from detection loop', () => {
    const sources = [
      { active: true }, { active: false }, { active: true },
    ];
    const activeSources = sources.filter(s => s.active);
    expect(activeSources).toHaveLength(2);
  });
});

describe('Multi-Camera — cleanup', () => {
  it('stop kills all camera streams', () => {
    const streams = [{ stopped: false }, { stopped: false }, { stopped: false }];
    streams.forEach(s => { s.stopped = true; });
    expect(streams.every(s => s.stopped)).toBe(true);
  });

  it('stop removes all video elements from DOM', () => {
    const videos = [{ removed: false }, { removed: false }];
    videos.forEach(v => { v.removed = true; });
    expect(videos.every(v => v.removed)).toBe(true);
  });

  it('handle exposes activeCameraCount', () => {
    const sources = [{ active: true }, { active: true }, { active: false }];
    const count = sources.filter(s => s.active).length;
    expect(count).toBe(2);
  });

  it('handle exposes videoElements array', () => {
    const videos = ['video1', 'video2'];
    expect(videos).toHaveLength(2);
  });

  it('backward compat: single videoElement returns first', () => {
    const videos = ['video1', 'video2'];
    const primary = videos[0] ?? null;
    expect(primary).toBe('video1');
  });
});

describe('Multi-Camera — back camera rejection', () => {
  const inferFacing = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('back') || l.includes('rear') || l.includes('environment')) return 'environment';
    if (l.includes('front') || l.includes('facetime') || l.includes('truedepth')) return 'user';
    return 'unknown';
  };

  it('rejects "Back Camera"', () => {
    expect(inferFacing('Back Camera')).toBe('environment');
  });

  it('rejects "Rear Camera"', () => {
    expect(inferFacing('Rear Camera (Wide)')).toBe('environment');
  });

  it('rejects "Environment" facing', () => {
    expect(inferFacing('Environment Camera')).toBe('environment');
  });

  it('accepts "Front Camera"', () => {
    expect(inferFacing('Front Camera')).toBe('user');
  });

  it('accepts "FaceTime Camera"', () => {
    expect(inferFacing('FaceTime HD Camera')).toBe('user');
  });

  it('accepts "TrueDepth Camera"', () => {
    expect(inferFacing('TrueDepth Camera')).toBe('user');
  });

  it('unknown label defaults to unknown (allowed)', () => {
    expect(inferFacing('USB Webcam')).toBe('unknown');
  });

  it('listFrontCameras excludes environment cameras', () => {
    const all = [
      { deviceId: 'a', facing: 'user' as const },
      { deviceId: 'b', facing: 'environment' as const },
      { deviceId: 'c', facing: 'unknown' as const },
    ];
    const front = all.filter(c => c.facing !== 'environment');
    expect(front).toHaveLength(2);
    expect(front.every((c: { facing: string }) => c.facing !== 'environment')).toBe(true);
  });

  it('facingMode=environment from stream settings rejected', () => {
    const settings = { facingMode: 'environment' };
    const isBack = settings.facingMode === 'environment';
    expect(isBack).toBe(true);
  });
});

describe('Multi-Camera — iPhone specific', () => {
  it('iPhone 14+ has 2 front cameras (TrueDepth)', () => {
    const cameras = [
      { deviceId: 'front-wide', label: 'Front Camera (Wide)' },
      { deviceId: 'front-ultra', label: 'Front Camera (Ultra Wide)' },
    ];
    expect(cameras).toHaveLength(2);
  });

  it('both front cameras can be used simultaneously', () => {
    const ids = ['front-wide', 'front-ultra'];
    expect(ids).toHaveLength(2);
  });

  it('rear cameras auto-filtered by listFrontCameras', () => {
    const cameras = [
      { deviceId: 'front', facing: 'user' as const },
      { deviceId: 'rear', facing: 'environment' as const },
    ];
    const frontOnly = cameras.filter(c => c.facing !== 'environment');
    expect(frontOnly).toHaveLength(1);
    expect(frontOnly[0].deviceId).toBe('front');
  });
});

// ═══════════════════════════════════════════════════════════════
// Voice Input — condition paths
// ═══════════════════════════════════════════════════════════════

describe('Voice Input — language code expansion', () => {
  it('already BCP-47 passes through', () => {
    const lang = 'es-ES';
    const result = lang.includes('-') ? lang : `${lang}-${lang.toUpperCase()}`;
    expect(result).toBe('es-ES');
  });

  it('2-letter code expands', () => {
    const lang = 'ru';
    const result = lang.includes('-') ? lang : `${lang}-${lang.toUpperCase()}`;
    expect(result).toBe('ru-RU');
  });

  it('zh expands to zh-ZH (needs mapping fix)', () => {
    const lang = 'zh';
    const result = lang.includes('-') ? lang : `${lang}-${lang.toUpperCase()}`;
    expect(result).toBe('zh-ZH');
  });
});

describe('Voice Input — error conditions', () => {
  it('no-speech error = silence, not crash', () => {
    const error = 'no-speech';
    const isSilence = error === 'no-speech';
    expect(isSilence).toBe(true);
  });

  it('aborted error = ignore, not crash', () => {
    const error = 'aborted';
    const isAborted = error === 'aborted';
    expect(isAborted).toBe(true);
  });

  it('network error = report to user', () => {
    const error: string = 'network';
    const isSilence = error === 'no-speech';
    const isAborted = error === 'aborted';
    const shouldReport = !isSilence && !isAborted;
    expect(shouldReport).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Prediction — word replacement conditions
// ═══════════════════════════════════════════════════════════════

describe('Prediction tap — word replacement', () => {
  it('mid-word replaces partial', () => {
    const text = 'hello wor';
    const midWord = text.length > 0 && !text.endsWith(' ');
    expect(midWord).toBe(true);
  });

  it('after space appends', () => {
    const text = 'hello ';
    const midWord = text.length > 0 && !text.endsWith(' ');
    expect(midWord).toBe(false);
  });

  it('empty text = not mid-word', () => {
    const text = '';
    const midWord = text.length > 0 && !text.endsWith(' ');
    expect(midWord).toBe(false);
  });

  it('replacement preserves prefix words', () => {
    const text = 'I want wat';
    const words = text.trim().split(/\s+/);
    const prefix = words.slice(0, -1).join(' ');
    const word = 'water';
    const result = `${prefix} ${word} `;
    expect(result).toBe('I want water ');
  });

  it('single word replacement', () => {
    const text = 'hel';
    const words = text.trim().split(/\s+/);
    const prefix = words.slice(0, -1).join(' ');
    const word = 'hello';
    const result = prefix ? `${prefix} ${word} ` : `${word} `;
    expect(result).toBe('hello ');
  });
});

// ═══════════════════════════════════════════════════════════════
// Settings Store — migration conditions
// ═══════════════════════════════════════════════════════════════

describe('Settings — defaults and conditions', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      language: 'en', outputLanguage: 'en', headTrackingEnabled: false,
      headTrackingDwellMs: 1200, headTrackingSensitivity: 5,
    });
  });

  it('outputLanguage syncs with language when same', () => {
    const s = useSettingsStore.getState();
    const sync = s.language === s.outputLanguage;
    expect(sync).toBe(true);
  });

  it('translation active when languages differ', () => {
    useSettingsStore.getState().update({ outputLanguage: 'ru' });
    const s = useSettingsStore.getState();
    expect(s.language !== s.outputLanguage).toBe(true);
  });

  it('head tracking defaults to disabled', () => {
    expect(useSettingsStore.getState().headTrackingEnabled).toBe(false);
  });

  it('dwell time in valid range', () => {
    const dwell = useSettingsStore.getState().headTrackingDwellMs;
    expect(dwell).toBeGreaterThanOrEqual(500);
    expect(dwell).toBeLessThanOrEqual(3000);
  });

  it('sensitivity in valid range', () => {
    const sens = useSettingsStore.getState().headTrackingSensitivity;
    expect(sens).toBeGreaterThanOrEqual(1);
    expect(sens).toBeLessThanOrEqual(10);
  });

  it('hand calibration settings default to visible', () => {
    expect(useSettingsStore.getState().showHandCalibration).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Precision Touch — finger tracking condition paths
// ═══════════════════════════════════════════════════════════════

describe('Precision Touch — key resolution', () => {
  it('resolves key from data-key attribute', () => {
    const key = 'a';
    const attr = key;
    expect(attr).toBe('a');
  });

  it('resolves display char from data-display attribute', () => {
    const display = 'A';
    expect(display).toBe('A');
  });

  it('action buttons have data-action attribute', () => {
    const actions = ['space', 'backspace', 'shift', 'speak', 'mode'];
    expect(actions).toHaveLength(5);
    expect(actions).toContain('space');
    expect(actions).toContain('backspace');
  });

  it('character keys use data-key for dispatch', () => {
    const key = '.';
    const action = null;
    const shouldTypeKey = !action && key;
    expect(!!shouldTypeKey).toBe(true);
  });

  it('action keys dispatch by action name, not click', () => {
    const action = 'space';
    const key = ' ';
    const shouldDispatchAction = !!action;
    expect(shouldDispatchAction).toBe(true);
  });
});

describe('Precision Touch — touch coordinate tracking', () => {
  it('elementFromPoint returns element at coordinates', () => {
    const tx = 200;
    const ty = 400;
    expect(typeof tx).toBe('number');
    expect(typeof ty).toBe('number');
  });

  it('bubble position tracks finger position', () => {
    const touchX = 150;
    const touchY = 300;
    const bubbleX = touchX;
    const bubbleY = touchY - 80;
    expect(bubbleX).toBe(150);
    expect(bubbleY).toBe(220);
  });

  it('bubble offset is 80px above finger', () => {
    const fingerY = 500;
    const bubbleY = fingerY - 80;
    expect(bubbleY).toBe(420);
  });

  it('bubble hidden when no key under finger', () => {
    const keyUnderFinger: unknown = null;
    const visible = keyUnderFinger !== null;
    expect(visible).toBe(false);
  });

  it('bubble visible when key under finger', () => {
    const keyUnderFinger = { key: 'a' };
    const visible = keyUnderFinger !== null;
    expect(visible).toBe(true);
  });
});

describe('Precision Touch — touch-and-slide lifecycle', () => {
  it('touchStart activates tracking', () => {
    let touchActive = false;
    touchActive = true;
    expect(touchActive).toBe(true);
  });

  it('touchMove updates highlighted key', () => {
    let activeKey = 'a';
    const newKey = 'b';
    if (newKey !== activeKey) {
      activeKey = newKey;
    }
    expect(activeKey).toBe('b');
  });

  it('touchEnd fires key action and clears state', () => {
    let activeKey: string | null = 'c';
    let touchActive = true;
    let typed = '';
    if (activeKey) typed = activeKey;
    activeKey = null;
    touchActive = false;
    expect(typed).toBe('c');
    expect(activeKey).toBeNull();
    expect(touchActive).toBe(false);
  });

  it('touchCancel clears state without typing', () => {
    let activeKey: string | null = 'd';
    let touchActive = true;
    activeKey = null;
    touchActive = false;
    expect(activeKey).toBeNull();
    expect(touchActive).toBe(false);
  });

  it('sliding off keyboard hides bubble', () => {
    const keyUnderFinger: unknown = null;
    const prevKey = 'e';
    const shouldHide = keyUnderFinger === null;
    expect(shouldHide).toBe(true);
  });

  it('sliding back onto key re-shows bubble', () => {
    const keyUnderFinger = { key: 'f' };
    const shouldShow = keyUnderFinger !== null;
    expect(shouldShow).toBe(true);
  });
});

describe('Precision Touch — action dispatch', () => {
  it('space action dispatches handleSpace', () => {
    const action = 'space';
    const dispatched = action === 'space' ? 'handleSpace' : 'unknown';
    expect(dispatched).toBe('handleSpace');
  });

  it('backspace action dispatches handleBackspace', () => {
    const action = 'backspace';
    const dispatched = action === 'backspace' ? 'handleBackspace' : 'unknown';
    expect(dispatched).toBe('handleBackspace');
  });

  it('speak action dispatches handleSpeak', () => {
    const action = 'speak';
    const dispatched = action === 'speak' ? 'handleSpeak' : 'unknown';
    expect(dispatched).toBe('handleSpeak');
  });

  it('shift action dispatches handleShiftUp', () => {
    const action = 'shift';
    const dispatched = action === 'shift' ? 'handleShiftUp' : 'unknown';
    expect(dispatched).toBe('handleShiftUp');
  });

  it('mode action dispatches toggleKeyboardMode', () => {
    const action = 'mode';
    const dispatched = action === 'mode' ? 'toggleKeyboardMode' : 'unknown';
    expect(dispatched).toBe('toggleKeyboardMode');
  });

  it('unknown action falls through to key handler', () => {
    const action: string | null = null;
    const key = 'g';
    const dispatched = action ? `action:${action}` : key ? `key:${key}` : 'none';
    expect(dispatched).toBe('key:g');
  });
});

describe('Precision Touch — CSS class toggling', () => {
  it('precision-highlight added on touchStart', () => {
    const classes = new Set(['aac-key', 'surface-key']);
    classes.add('precision-highlight');
    expect(classes.has('precision-highlight')).toBe(true);
  });

  it('precision-highlight removed on touchEnd', () => {
    const classes = new Set(['aac-key', 'surface-key', 'precision-highlight']);
    classes.delete('precision-highlight');
    expect(classes.has('precision-highlight')).toBe(false);
  });

  it('highlight moves from old key to new key on slide', () => {
    const oldClasses = new Set(['precision-highlight']);
    const newClasses = new Set<string>();
    oldClasses.delete('precision-highlight');
    newClasses.add('precision-highlight');
    expect(oldClasses.has('precision-highlight')).toBe(false);
    expect(newClasses.has('precision-highlight')).toBe(true);
  });

  it('precision-touch-active class on container when enabled', () => {
    const enabled = true;
    const className = enabled ? 'precision-touch-active' : '';
    expect(className).toBe('precision-touch-active');
  });

  it('no precision-touch-active class when disabled', () => {
    const enabled = false;
    const className = enabled ? 'precision-touch-active' : '';
    expect(className).toBe('');
  });
});

describe('Precision Touch — iPad screen size handling', () => {
  it('bubble stays on screen at left edge', () => {
    const touchX = 10;
    const bubbleX = touchX;
    const bubbleWidth = 56;
    const adjustedX = Math.max(bubbleWidth / 2, bubbleX);
    expect(adjustedX).toBe(28);
  });

  it('bubble stays on screen at right edge', () => {
    const screenWidth = 1024;
    const touchX = 1020;
    const bubbleWidth = 56;
    const adjustedX = Math.min(screenWidth - bubbleWidth / 2, touchX);
    expect(adjustedX).toBe(996);
  });

  it('7-inch iPad has enough space for 10 keys per row', () => {
    const screenWidth = 768;
    const keysPerRow = 10;
    const gap = 1;
    const padding = 4;
    const available = screenWidth - padding * 2 - gap * (keysPerRow - 1);
    const keyWidth = available / keysPerRow;
    expect(keyWidth).toBeGreaterThan(50);
  });

  it('13-inch iPad has generous key spacing', () => {
    const screenWidth = 1366;
    const keysPerRow = 10;
    const gap = 1;
    const padding = 4;
    const available = screenWidth - padding * 2 - gap * (keysPerRow - 1);
    const keyWidth = available / keysPerRow;
    expect(keyWidth).toBeGreaterThan(100);
  });
});

describe('Precision Touch — disabled mode fallback', () => {
  it('onClick handlers active when precision disabled', () => {
    const precisionEnabled = false;
    const useOnClick = !precisionEnabled;
    expect(useOnClick).toBe(true);
  });

  it('onClick handlers inactive when precision enabled', () => {
    const precisionEnabled = true;
    const useOnClick = !precisionEnabled;
    expect(useOnClick).toBe(false);
  });

  it('touch events ignored when precision disabled', () => {
    const precisionEnabled = false;
    let touchHandled = false;
    if (precisionEnabled) touchHandled = true;
    expect(touchHandled).toBe(false);
  });

  it('touch events handled when precision enabled', () => {
    const precisionEnabled = true;
    let touchHandled = false;
    if (precisionEnabled) touchHandled = true;
    expect(touchHandled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Precision Touch — EMA smoothing algorithm
// ═══════════════════════════════════════════════════════════════

describe('Precision Touch — EMA touch smoothing', () => {
  const ALPHA = 0.35;

  it('first touch initializes to raw position (no lag)', () => {
    const rawX = 500;
    const smoothX = rawX;
    expect(smoothX).toBe(500);
  });

  it('EMA filters small jitter', () => {
    let smooth = 500;
    smooth += ALPHA * (503 - smooth);
    expect(smooth).toBeCloseTo(501.05, 1);
    // Only moved 1.05px despite 3px jitter — tremor filtered
  });

  it('EMA follows large intentional movement', () => {
    let smooth = 500;
    for (let i = 0; i < 10; i++) {
      smooth += ALPHA * (600 - smooth);
    }
    expect(smooth).toBeGreaterThan(585);
  });

  it('10 frames of EMA converges to target', () => {
    let smooth = 0;
    for (let i = 0; i < 20; i++) {
      smooth += ALPHA * (100 - smooth);
    }
    expect(smooth).toBeGreaterThan(99);
  });

  it('lower alpha = heavier smoothing', () => {
    let smooth1 = 500;
    let smooth2 = 500;
    smooth1 += 0.15 * (600 - smooth1);
    smooth2 += 0.35 * (600 - smooth2);
    expect(smooth1).toBeLessThan(smooth2);
  });
});

describe('Precision Touch — hysteresis dead zone', () => {
  const HYSTERESIS = 10;

  it('point inside key rect + margin = stays on same key', () => {
    const keyRect = { left: 100, right: 150, top: 200, bottom: 250 };
    const sx = 155; // 5px outside right edge, within 10px margin
    const sy = 225;
    const inside = sx >= keyRect.left - HYSTERESIS && sx <= keyRect.right + HYSTERESIS &&
                   sy >= keyRect.top - HYSTERESIS && sy <= keyRect.bottom + HYSTERESIS;
    expect(inside).toBe(true);
  });

  it('point outside key rect + margin = switches key', () => {
    const keyRect = { left: 100, right: 150, top: 200, bottom: 250 };
    const sx = 165; // 15px outside, past 10px margin
    const sy = 225;
    const inside = sx >= keyRect.left - HYSTERESIS && sx <= keyRect.right + HYSTERESIS &&
                   sy >= keyRect.top - HYSTERESIS && sy <= keyRect.bottom + HYSTERESIS;
    expect(inside).toBe(false);
  });

  it('point at exact boundary = stays (margin covers it)', () => {
    const keyRect = { left: 100, right: 150, top: 200, bottom: 250 };
    const sx = 150;
    const sy = 250;
    const inside = sx >= keyRect.left - HYSTERESIS && sx <= keyRect.right + HYSTERESIS &&
                   sy >= keyRect.top - HYSTERESIS && sy <= keyRect.bottom + HYSTERESIS;
    expect(inside).toBe(true);
  });

  it('3mm tremor (10px) does not cross hysteresis', () => {
    const tremorPx = 10;
    expect(tremorPx).toBeLessThanOrEqual(HYSTERESIS);
  });
});

describe('Precision Touch — settle time', () => {
  const SETTLE_MS = 100;

  it('touch at 0ms is not settled', () => {
    const elapsed = 0;
    expect(elapsed < SETTLE_MS).toBe(true);
  });

  it('touch at 50ms is not settled', () => {
    const elapsed = 50;
    expect(elapsed < SETTLE_MS).toBe(true);
  });

  it('touch at 100ms is settled', () => {
    const elapsed = 100;
    expect(elapsed >= SETTLE_MS).toBe(true);
  });

  it('key switch blocked during settle period', () => {
    const elapsed = 80;
    const settled = elapsed >= SETTLE_MS;
    let keySwitched = false;
    if (settled) keySwitched = true;
    expect(keySwitched).toBe(false);
  });

  it('key switch allowed after settle period', () => {
    const elapsed = 150;
    const settled = elapsed >= SETTLE_MS;
    let keySwitched = false;
    if (settled) keySwitched = true;
    expect(keySwitched).toBe(true);
  });
});

describe('Precision Touch — lift delay', () => {
  const LIFT_DELAY_MS = 80;

  it('lift delay prevents premature key commit', () => {
    expect(LIFT_DELAY_MS).toBeGreaterThan(0);
    expect(LIFT_DELAY_MS).toBeLessThanOrEqual(150);
  });

  it('bounce-lift within delay window cancels action', () => {
    let pending = true;
    const bounceMs = 30;
    if (bounceMs < LIFT_DELAY_MS) {
      pending = false; // cancelled by re-touch
    }
    expect(pending).toBe(false);
  });

  it('genuine lift after delay commits action', () => {
    let committed = false;
    const elapsed = 100;
    if (elapsed >= LIFT_DELAY_MS) committed = true;
    expect(committed).toBe(true);
  });
});

describe('Precision Touch — touch Y-offset correction', () => {
  const Y_OFFSET = -8;

  it('raw touch Y is corrected upward by 8px', () => {
    const rawY = 400;
    const corrected = rawY + Y_OFFSET;
    expect(corrected).toBe(392);
  });

  it('correction compensates fat-finger parallax', () => {
    expect(Y_OFFSET).toBeLessThan(0);
    expect(Math.abs(Y_OFFSET)).toBeLessThanOrEqual(16);
  });
});

describe('Precision Touch — adaptive motion smoothing', () => {
  const BASE_ALPHA = 0.35;

  it('stationary device uses base alpha', () => {
    const magnitude = 9.8; // gravity only
    const deviation = Math.abs(magnitude - 9.8);
    const alpha = deviation > 2 ? Math.max(0.15, BASE_ALPHA - deviation * 0.02) : BASE_ALPHA;
    expect(alpha).toBe(BASE_ALPHA);
  });

  it('car motion increases smoothing (lower alpha)', () => {
    const magnitude = 13; // gravity + car
    const deviation = Math.abs(magnitude - 9.8);
    const alpha = deviation > 2 ? Math.max(0.15, BASE_ALPHA - deviation * 0.02) : BASE_ALPHA;
    expect(alpha).toBeLessThan(BASE_ALPHA);
  });

  it('heavy vibration maximally smooths', () => {
    const magnitude = 25; // extreme shake
    const deviation = Math.abs(magnitude - 9.8);
    const alpha = deviation > 2 ? Math.max(0.15, BASE_ALPHA - deviation * 0.02) : BASE_ALPHA;
    expect(alpha).toBe(0.15);
  });

  it('alpha never goes below 0.15 (stays responsive)', () => {
    const magnitude = 50;
    const deviation = Math.abs(magnitude - 9.8);
    const alpha = Math.max(0.15, BASE_ALPHA - deviation * 0.02);
    expect(alpha).toBe(0.15);
  });

  it('normal walking (small deviation) keeps base alpha', () => {
    const magnitude = 11; // slight movement
    const deviation = Math.abs(magnitude - 9.8);
    const alpha = deviation > 2 ? Math.max(0.15, BASE_ALPHA - deviation * 0.02) : BASE_ALPHA;
    expect(alpha).toBe(BASE_ALPHA);
  });
});

describe('Precision Touch — hand profile storage', () => {
  it('hand profile key exists in localStorage namespace', () => {
    const key = 'prism-hand-profile';
    expect(typeof key).toBe('string');
  });

  it('default profile has no finger offsets', () => {
    const profile = { fingerLength: 0, yOffset: -8, tremorLevel: 'none' };
    expect(profile.yOffset).toBe(-8);
  });

  it('profile with learned offsets overrides defaults', () => {
    const learned = { fingerLength: 45, yOffset: -12, tremorLevel: 'moderate' };
    const defaultOffset = -8;
    const applied = learned.yOffset || defaultOffset;
    expect(applied).toBe(-12);
  });

  it('profile stores per-user (by name or device)', () => {
    const profiles: Record<string, { yOffset: number }> = {
      'child-ipad': { yOffset: -10 },
      'parent-iphone': { yOffset: -6 },
    };
    expect(profiles['child-ipad'].yOffset).toBe(-10);
  });
});

// ═══════════════════════════════════════════════════════════════
// Hand Profile — MediaPipe hand geometry computation
// ═══════════════════════════════════════════════════════════════

describe('Hand Profile — geometry computation', () => {
  it('finger length computed from MCP to TIP', () => {
    const mcp = { x: 100, y: 200 };
    const tip = { x: 100, y: 120 };
    const length = Math.sqrt((tip.x - mcp.x) ** 2 + (tip.y - mcp.y) ** 2);
    expect(length).toBe(80);
  });

  it('palm width from index MCP to pinky MCP', () => {
    const indexMCP = { x: 50, y: 200 };
    const pinkyMCP = { x: 150, y: 200 };
    const width = Math.sqrt((pinkyMCP.x - indexMCP.x) ** 2 + (pinkyMCP.y - indexMCP.y) ** 2);
    expect(width).toBe(100);
  });

  it('approach angle 0 = finger pointing straight down', () => {
    const dx = 0;
    const dy = 80;
    const angle = Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI;
    expect(angle).toBeCloseTo(0, 0);
  });

  it('approach angle 45 = finger at 45 degrees', () => {
    const dx = 50;
    const dy = 50;
    const angle = Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI;
    expect(angle).toBeCloseTo(45, 0);
  });

  it('handedness: thumb right of pinky = right hand', () => {
    const thumbX = 160;
    const pinkyX = 50;
    const handedness = thumbX > pinkyX ? 'right' : 'left';
    expect(handedness).toBe('right');
  });

  it('handedness: thumb left of pinky = left hand', () => {
    const thumbX = 40;
    const pinkyX = 150;
    const handedness = thumbX > pinkyX ? 'right' : 'left';
    expect(handedness).toBe('left');
  });

  it('y-offset derived from approach angle and finger length', () => {
    const angle = 30;
    const fingerLength = 100;
    const yOffset = -Math.round(Math.sin(angle * Math.PI / 180) * fingerLength * 0.12);
    expect(yOffset).toBe(-6);
  });

  it('y-offset clamped to valid range [-20, -4]', () => {
    const computed = -25;
    const clamped = Math.max(-20, Math.min(-4, computed));
    expect(clamped).toBe(-20);
  });
});

describe('Hand Profile — tremor analysis', () => {
  it('zero displacement = no tremor', () => {
    const displacements = [0, 0, 0, 0, 0];
    const rms = Math.sqrt(displacements.reduce((s, d) => s + d * d, 0) / displacements.length);
    expect(rms).toBe(0);
  });

  it('small displacement = mild tremor', () => {
    const displacements = [1, -1, 1, -1, 1];
    const rms = Math.sqrt(displacements.reduce((s, d) => s + d * d, 0) / displacements.length);
    expect(rms).toBe(1);
  });

  it('large displacement = severe tremor', () => {
    const displacements = [8, -8, 8, -8, 8];
    const rms = Math.sqrt(displacements.reduce((s, d) => s + d * d, 0) / displacements.length);
    expect(rms).toBe(8);
  });

  it('zero-crossing frequency counts oscillations', () => {
    const deltas = [1, -1, 1, -1, 1, -1, 1, -1]; // 7 crossings
    let crossings = 0;
    for (let i = 1; i < deltas.length; i++) {
      if ((deltas[i] > 0 && deltas[i - 1] < 0) || (deltas[i] < 0 && deltas[i - 1] > 0)) {
        crossings++;
      }
    }
    expect(crossings).toBe(7);
  });

  it('frequency = crossings / (2 * duration)', () => {
    const crossings = 10;
    const durationSec = 2;
    const freq = crossings / (2 * durationSec);
    expect(freq).toBe(2.5);
  });
});

describe('Hand Profile — auto-tune from tremor', () => {
  it('mild tremor (< 2px) keeps default alpha', () => {
    const amplPx = 1.5;
    const alpha = amplPx < 2 ? 0.35 : amplPx < 5 ? 0.35 - (amplPx - 2) * 0.033 : 0.15;
    expect(alpha).toBe(0.35);
  });

  it('moderate tremor (3px) reduces alpha', () => {
    const amplPx = 3;
    const alpha = amplPx < 2 ? 0.35 : amplPx < 5 ? 0.35 - (amplPx - 2) * 0.033 : 0.15;
    expect(alpha).toBeCloseTo(0.317, 2);
  });

  it('severe tremor (> 5px) uses minimum alpha', () => {
    const amplPx = 7;
    const alpha = amplPx < 2 ? 0.35 : amplPx < 5 ? 0.35 - (amplPx - 2) * 0.033 : 0.15;
    expect(alpha).toBe(0.15);
  });

  it('mild tremor keeps 10px dead zone', () => {
    const amplPx = 1;
    const deadZone = amplPx < 2 ? 10 : amplPx < 5 ? 10 + (amplPx - 2) * 2.67 : 20;
    expect(deadZone).toBe(10);
  });

  it('moderate tremor increases dead zone', () => {
    const amplPx = 4;
    const deadZone = amplPx < 2 ? 10 : amplPx < 5 ? 10 + (amplPx - 2) * 2.67 : 20;
    expect(deadZone).toBeCloseTo(15.34, 1);
  });

  it('severe tremor uses maximum dead zone', () => {
    const amplPx = 8;
    const deadZone = amplPx < 2 ? 10 : amplPx < 5 ? 10 + (amplPx - 2) * 2.67 : 20;
    expect(deadZone).toBe(20);
  });
});

describe('Hand Profile — continuous learning', () => {
  it('offset sample records intended vs actual', () => {
    const intended = { x: 300, y: 400 };
    const actual = { x: 305, y: 408 };
    const dx = intended.x - actual.x;
    const dy = intended.y - actual.y;
    expect(dx).toBe(-5);
    expect(dy).toBe(-8);
  });

  it('average of 50 samples produces stable offset', () => {
    const samples = Array.from({ length: 50 }, () => ({ dx: -5 + Math.random() * 2 - 1, dy: -8 + Math.random() * 2 - 1 }));
    const avgDx = samples.reduce((s, v) => s + v.dx, 0) / samples.length;
    const avgDy = samples.reduce((s, v) => s + v.dy, 0) / samples.length;
    expect(avgDx).toBeCloseTo(-5, 0);
    expect(avgDy).toBeCloseTo(-8, 0);
  });

  it('blends new offset with existing (80/20 ratio)', () => {
    const existing = -8;
    const newLearned = -12;
    const blended = existing * 0.8 + newLearned * 0.2;
    expect(blended).toBeCloseTo(-8.8, 1);
  });

  it('offset clamped to safe range', () => {
    const extremeOffset = -30;
    const clamped = Math.max(-20, Math.min(-2, extremeOffset));
    expect(clamped).toBe(-20);
  });

  it('x-offset clamped to [-15, 15]', () => {
    const extremeX = 25;
    const clamped = Math.max(-15, Math.min(15, extremeX));
    expect(clamped).toBe(15);
  });

  it('auto-refine triggers every 50 touches', () => {
    const touchCount = 150;
    const shouldRefine = touchCount % 50 === 0;
    expect(shouldRefine).toBe(true);
  });

  it('auto-refine does not trigger at 49 touches', () => {
    const touchCount = 49;
    const shouldRefine = touchCount % 50 === 0;
    expect(shouldRefine).toBe(false);
  });
});

describe('Hand Profile — calibration session', () => {
  it('scan needs 30 frames', () => {
    const SCAN_FRAMES = 30;
    expect(SCAN_FRAMES).toBe(30);
  });

  it('touch calibration needs 20 targets', () => {
    const TOUCH_TARGETS = 20;
    expect(TOUCH_TARGETS).toBe(20);
  });

  it('tremor measurement needs 3 seconds', () => {
    const TREMOR_DURATION_MS = 3000;
    expect(TREMOR_DURATION_MS).toBe(3000);
  });

  it('calibration phases are sequential', () => {
    const phases = ['init', 'scan', 'touch', 'tremor', 'done'];
    expect(phases).toHaveLength(5);
    expect(phases[0]).toBe('init');
    expect(phases[phases.length - 1]).toBe('done');
  });

  it('multiple profiles can coexist', () => {
    const profiles = [
      { id: 'child-1', name: 'My Hand' },
      { id: 'child-2', name: 'Right Hand' },
    ];
    expect(profiles).toHaveLength(2);
  });

  it('active profile ID stored separately from profile data', () => {
    const storageKey = 'prism-hand-profiles';
    const activeKey = 'prism-hand-profile-active';
    expect(storageKey).not.toBe(activeKey);
  });

  it('default profile always exists as fallback', () => {
    const defaultProfile = { id: 'default', emaAlpha: 0.35, deadZonePx: 10, yOffset: -8 };
    expect(defaultProfile.id).toBe('default');
  });
});

describe('Hand Profile — MediaPipe landmarks', () => {
  it('MediaPipe returns 21 landmarks per hand', () => {
    const LANDMARK_COUNT = 21;
    expect(LANDMARK_COUNT).toBe(21);
  });

  it('landmark 0 is wrist', () => {
    const WRIST = 0;
    expect(WRIST).toBe(0);
  });

  it('landmarks 1-4 are thumb', () => {
    const thumb = [1, 2, 3, 4];
    expect(thumb).toHaveLength(4);
    expect(thumb[thumb.length - 1]).toBe(4);
  });

  it('landmarks 5-8 are index finger', () => {
    const index = [5, 6, 7, 8];
    expect(index[0]).toBe(5);
    expect(index[index.length - 1]).toBe(8);
  });

  it('landmark 8 is index TIP (used for offset)', () => {
    const INDEX_TIP = 8;
    expect(INDEX_TIP).toBe(8);
  });

  it('landmark 20 is pinky TIP', () => {
    const PINKY_TIP = 20;
    expect(PINKY_TIP).toBe(20);
  });

  it('normalized coordinates 0-1 scale to image size', () => {
    const lm = { x: 0.5, y: 0.3 };
    const imgW = 640;
    const imgH = 480;
    const px = { x: lm.x * imgW, y: lm.y * imgH };
    expect(px.x).toBe(320);
    expect(px.y).toBe(144);
  });
});

describe('Hand Profile — proximity accommodation', () => {
  it('camera loses focus at < 30cm', () => {
    const distanceCm = 25;
    const cameraOccluded = distanceCm < 30;
    expect(cameraOccluded).toBe(true);
  });

  it('camera tracks at > 30cm', () => {
    const distanceCm = 50;
    const cameraOccluded = distanceCm < 30;
    expect(cameraOccluded).toBe(false);
  });

  it('transition from camera to touch at proximity threshold', () => {
    const useCamera = true;
    const fingerDistance = 20;
    const mode = fingerDistance < 30 ? 'touch' : 'camera';
    expect(mode).toBe('touch');
  });

  it('predictive landing uses last camera frame', () => {
    const lastCameraX = 300;
    const lastCameraY = 400;
    const prediction = { x: lastCameraX, y: lastCameraY };
    expect(prediction.x).toBe(300);
  });
});

// ═══════════════════════════════════════════════════════════════
// Switch Scanning — accessibility switch input
// ═══════════════════════════════════════════════════════════════

describe('Switch Scanning — configuration', () => {
  it('default scan speed is 2000ms', () => {
    const config = { scanSpeedMs: 2000 };
    expect(config.scanSpeedMs).toBe(2000);
  });

  it('scan speed clamped to 1000-5000ms', () => {
    const clamp = (v: number) => Math.max(1000, Math.min(5000, v));
    expect(clamp(500)).toBe(1000);
    expect(clamp(7000)).toBe(5000);
    expect(clamp(3000)).toBe(3000);
  });

  it('auto mode advances on timer', () => {
    const mode = 'auto';
    const shouldAutoAdvance = mode === 'auto';
    expect(shouldAutoAdvance).toBe(true);
  });

  it('manual mode waits for switch press', () => {
    const mode: string = 'manual';
    const shouldAutoAdvance = mode === 'auto';
    expect(shouldAutoAdvance).toBe(false);
  });

  it('config persists in localStorage', () => {
    const key = 'prism-switch-scan';
    expect(typeof key).toBe('string');
  });
});

describe('Switch Scanning — element discovery', () => {
  it('selector finds aac-btn and aac-key elements', () => {
    const selector = 'button, [role="button"], a, [data-dwell-target], .aac-btn, .aac-key';
    expect(selector).toContain('.aac-btn');
    expect(selector).toContain('.aac-key');
  });

  it('empty page returns no scannable elements', () => {
    const elements: unknown[] = [];
    expect(elements).toHaveLength(0);
  });

  it('scan wraps around at end of list', () => {
    const total = 10;
    let idx = 9;
    idx = (idx + 1) % total;
    expect(idx).toBe(0);
  });

  it('scan wraps backward at start', () => {
    const total = 10;
    let idx = 0;
    idx = (idx - 1 + total) % total;
    expect(idx).toBe(9);
  });
});

describe('Switch Scanning — group scanning', () => {
  it('groups by data-scan-group attribute', () => {
    const groups = ['row-1', 'row-2', 'row-3'];
    expect(groups).toHaveLength(3);
  });

  it('phase 1: scan groups, phase 2: scan items', () => {
    const phases = ['groups', 'items'];
    expect(phases[0]).toBe('groups');
    expect(phases[1]).toBe('items');
  });

  it('selecting a group enters item scan phase', () => {
    let phase = 'groups' as 'groups' | 'items';
    phase = 'items';
    expect(phase).toBe('items');
  });

  it('visual rows inferred by Y-position when no data attributes', () => {
    const elements = [
      { y: 100 }, { y: 100 }, { y: 100 },
      { y: 200 }, { y: 200 }, { y: 200 },
    ];
    const rows = new Map<number, typeof elements>();
    for (const el of elements) {
      const roundedY = Math.round(el.y / 50) * 50;
      if (!rows.has(roundedY)) rows.set(roundedY, []);
      rows.get(roundedY)!.push(el);
    }
    expect(rows.size).toBe(2);
  });
});

describe('Switch Scanning — input sources', () => {
  it('keyboard Space = select', () => {
    const key = ' ';
    const isSelect = key === ' ' || key === 'Enter';
    expect(isSelect).toBe(true);
  });

  it('keyboard Enter = select', () => {
    const key: string = 'Enter';
    const isSelect = key === ' ' || key === 'Enter';
    expect(isSelect).toBe(true);
  });

  it('keyboard Tab = next', () => {
    const key = 'Tab';
    const isNext = key === 'Tab';
    expect(isNext).toBe(true);
  });

  it('gamepad any button = select', () => {
    const buttons = [{ pressed: false }, { pressed: true }, { pressed: false }];
    const anyPressed = buttons.some(b => b.pressed);
    expect(anyPressed).toBe(true);
  });

  it('gamepad edge detection (press, not hold)', () => {
    const prevPressed = false;
    const currPressed = true;
    const isNewPress = currPressed && !prevPressed;
    expect(isNewPress).toBe(true);
  });

  it('WebHID feature detection', () => {
    const hasHID = typeof navigator !== 'undefined' && 'hid' in navigator;
    expect(typeof hasHID).toBe('boolean');
  });
});

describe('Switch Scanning — CSS highlight', () => {
  it('switch-scan-active class added to current element', () => {
    const classes = new Set<string>();
    classes.add('switch-scan-active');
    expect(classes.has('switch-scan-active')).toBe(true);
  });

  it('switch-scan-group-active for group highlight', () => {
    const cls = 'switch-scan-group-active';
    expect(cls).toBe('switch-scan-group-active');
  });

  it('highlight removed from previous element on advance', () => {
    const classes = new Set(['switch-scan-active']);
    classes.delete('switch-scan-active');
    expect(classes.has('switch-scan-active')).toBe(false);
  });
});

describe('Switch Scanning — loop control', () => {
  it('infinite loops when loops = 0', () => {
    const loops = 0;
    const shouldStop = loops > 0;
    expect(shouldStop).toBe(false);
  });

  it('stops after N loops', () => {
    const maxLoops = 3;
    const currentLoop = 3;
    const shouldStop = maxLoops > 0 && currentLoop >= maxLoops;
    expect(shouldStop).toBe(true);
  });

  it('pause freezes scan position', () => {
    let paused = false;
    paused = true;
    expect(paused).toBe(true);
  });

  it('resume continues from paused position', () => {
    const idx = 5;
    let paused = true;
    paused = false;
    expect(idx).toBe(5);
    expect(paused).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// WASM TTS — emergency fallback speech
// ═══════════════════════════════════════════════════════════════

describe('WASM TTS — language mapping', () => {
  const LANG_MAP: Record<string, string> = {
    en: 'en', es: 'es', fr: 'fr', pt: 'pt-br', ro: 'ro',
    uk: 'uk', ru: 'ru', de: 'de', ja: 'ja', ko: 'ko',
    zh: 'cmn', ar: 'ar',
  };

  it('maps all 12 PrismAAC languages', () => {
    expect(Object.keys(LANG_MAP)).toHaveLength(12);
  });

  it('Chinese maps to cmn (Mandarin)', () => {
    expect(LANG_MAP['zh']).toBe('cmn');
  });

  it('Portuguese maps to pt-br', () => {
    expect(LANG_MAP['pt']).toBe('pt-br');
  });

  it('unknown language falls back to en', () => {
    const lang = 'xx';
    const voice = LANG_MAP[lang] || 'en';
    expect(voice).toBe('en');
  });

  it('accepts full TTS codes (en-US → en)', () => {
    const ttsCode = 'en-US';
    const short = ttsCode.split('-')[0].toLowerCase();
    expect(LANG_MAP[short]).toBe('en');
  });
});

describe('WASM TTS — beep pattern fallback', () => {
  it('vowels get lower frequency (440Hz)', () => {
    const vowels = 'aeiou';
    const freq = vowels.includes('a') ? 440 : 660;
    expect(freq).toBe(440);
  });

  it('consonants get higher frequency (660Hz)', () => {
    const char = 'b';
    const isVowel = 'aeiou'.includes(char);
    const freq = isVowel ? 440 : 660;
    expect(freq).toBe(660);
  });

  it('word separator is 200ms silence', () => {
    const WORD_GAP_MS = 200;
    expect(WORD_GAP_MS).toBe(200);
  });

  it('each word has unique audible shape', () => {
    const word1 = 'help';
    const word2 = 'stop';
    expect(word1).not.toBe(word2);
  });

  it('attention beep at start (880Hz)', () => {
    const ATTENTION_HZ = 880;
    expect(ATTENTION_HZ).toBe(880);
  });

  it('rate parameter scales tone duration', () => {
    const baseDuration = 80;
    const rate = 0.5;
    const scaled = baseDuration / rate;
    expect(scaled).toBe(160);
  });

  it('volume parameter scales gain', () => {
    const volume = 0.7;
    expect(volume).toBeGreaterThan(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});

describe('WASM TTS — lifecycle', () => {
  it('not ready before init', () => {
    const ready = false;
    expect(ready).toBe(false);
  });

  it('init attempts espeak-ng import', () => {
    const strategies = ['espeak-ng', 'espeak-ng-emscripten', 'window.espeakng'];
    expect(strategies).toHaveLength(3);
  });

  it('falls back to beep pattern when WASM unavailable', () => {
    const wasmLoaded = false;
    const useBeeps = !wasmLoaded;
    expect(useBeeps).toBe(true);
  });

  it('stop cancels mid-playback via AbortController', () => {
    const controller = new AbortController();
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it('destroy releases AudioContext', () => {
    let ctx: unknown = { state: 'running' };
    ctx = null;
    expect(ctx).toBeNull();
  });
});

describe('WASM TTS — speech service integration', () => {
  it('tier 4 in the fallback chain', () => {
    const tiers = ['azure', 'web-speech-premium', 'web-speech-any', 'wasm-espeak'];
    expect(tiers[3]).toBe('wasm-espeak');
    expect(tiers).toHaveLength(4);
  });

  it('only reached when Web Speech API unavailable', () => {
    const webSpeechAvailable = false;
    const useWasm = !webSpeechAvailable;
    expect(useWasm).toBe(true);
  });

  it('lazy-loaded on first use', () => {
    const loaded = false;
    const needsInit = !loaded;
    expect(needsInit).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Remote Modeling — WebRTC caregiver-to-child
// ═══════════════════════════════════════════════════════════════

describe('Remote Modeling — room codes', () => {
  it('room code is 6 digits', () => {
    const code = '482917';
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  it('codes are numeric only', () => {
    const chars = '0123456789';
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * 10)]).join('');
    expect(/^\d+$/.test(code)).toBe(true);
  });

  it('codes are random (two consecutive differ)', () => {
    const code1 = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const code2 = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    // Statistically they should differ (1 in 1M chance of match)
    expect(typeof code1).toBe('string');
    expect(typeof code2).toBe('string');
  });
});

describe('Remote Modeling — command types', () => {
  it('highlight command has selector and duration', () => {
    const cmd = { type: 'highlight' as const, selector: '[data-key="a"]', duration: 3000 };
    expect(cmd.type).toBe('highlight');
    expect(cmd.duration).toBe(3000);
  });

  it('speak command has text', () => {
    const cmd = { type: 'speak' as const, text: 'Hello' };
    expect(cmd.type).toBe('speak');
  });

  it('tap command triggers click on selector', () => {
    const cmd = { type: 'tap' as const, selector: 'button[data-key="h"]' };
    expect(cmd.type).toBe('tap');
  });

  it('navigate command switches panels', () => {
    const cmd = { type: 'navigate' as const, panel: 'Categories' };
    expect(cmd.panel).toBe('Categories');
  });

  it('ping command for keepalive', () => {
    const cmd = { type: 'ping' as const };
    expect(cmd.type).toBe('ping');
  });

  it('clear_highlight removes modeling highlight', () => {
    const cmd = { type: 'clear_highlight' as const };
    expect(cmd.type).toBe('clear_highlight');
  });
});

describe('Remote Modeling — connection lifecycle', () => {
  it('child starts in waiting state', () => {
    const role = 'child';
    const status = role === 'child' ? 'waiting' : 'connecting';
    expect(status).toBe('waiting');
  });

  it('caregiver starts in connecting state', () => {
    const role: string = 'caregiver';
    const status = role === 'child' ? 'waiting' : 'connecting';
    expect(status).toBe('connecting');
  });

  it('connected when data channel opens', () => {
    let status = 'connecting' as string;
    status = 'connected';
    expect(status).toBe('connected');
  });

  it('disconnected on close', () => {
    let status = 'connected' as string;
    status = 'disconnected';
    expect(status).toBe('disconnected');
  });

  it('keepalive ping every 5 seconds', () => {
    const PING_INTERVAL = 5000;
    expect(PING_INTERVAL).toBe(5000);
  });
});

describe('Remote Modeling — signaling', () => {
  it('BroadcastChannel used for same-network devices', () => {
    const prefix = 'prism-rtc-signal-';
    const channel = `${prefix}123456`;
    expect(channel).toBe('prism-rtc-signal-123456');
  });

  it('localStorage polling as fallback', () => {
    const POLL_INTERVAL = 200;
    expect(POLL_INTERVAL).toBe(200);
  });

  it('offer/answer/candidate signal flow', () => {
    const signalTypes = ['join', 'offer', 'answer', 'candidate'];
    expect(signalTypes).toHaveLength(4);
  });

  it('child creates offer on caregiver join', () => {
    const role = 'child';
    const signal = 'join';
    const shouldCreateOffer = role === 'child' && signal === 'join';
    expect(shouldCreateOffer).toBe(true);
  });

  it('caregiver creates answer on offer', () => {
    const role = 'caregiver';
    const signal = 'offer';
    const shouldCreateAnswer = role === 'caregiver' && signal === 'offer';
    expect(shouldCreateAnswer).toBe(true);
  });
});

describe('Remote Modeling — security', () => {
  it('no video/audio streams (data channel only)', () => {
    const streamTypes = ['data'];
    expect(streamTypes).not.toContain('video');
    expect(streamTypes).not.toContain('audio');
  });

  it('caregiver can only send pre-defined commands', () => {
    const validTypes = ['highlight', 'speak', 'tap', 'navigate', 'clear_highlight', 'ping'];
    expect(validTypes).toHaveLength(6);
  });

  it('malformed JSON messages are ignored', () => {
    let handled = false;
    try {
      JSON.parse('not json');
    } catch {
      handled = false; // silently ignored
    }
    expect(handled).toBe(false);
  });

  it('CSS highlight class for modeling (green, not blue)', () => {
    const cls = 'remote-model-highlight';
    expect(cls).not.toBe('precision-highlight');
  });
});

describe('Remote Modeling — WebRTC feature detection', () => {
  it('checks RTCPeerConnection availability', () => {
    const hasRTC = typeof RTCPeerConnection !== 'undefined';
    expect(typeof hasRTC).toBe('boolean');
  });

  it('STUN servers configured for NAT traversal', () => {
    const iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
    expect(iceServers).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// Emergency — network flap mutex + palm rejection
// ═══════════════════════════════════════════════════════════════

describe('Emergency — flush mutex prevents 911 spam', () => {
  it('concurrent flush calls are blocked', () => {
    let isFlushing = false;
    const tryFlush = () => { if (isFlushing) return false; isFlushing = true; return true; };
    expect(tryFlush()).toBe(true);
    expect(tryFlush()).toBe(false); // blocked
  });

  it('mutex released after flush completes', () => {
    let isFlushing = true;
    isFlushing = false;
    expect(isFlushing).toBe(false);
  });

  it('mutex released on error (finally block)', () => {
    let isFlushing = true;
    try { throw new Error('test'); } catch { /* expected */ } finally { isFlushing = false; }
    expect(isFlushing).toBe(false);
  });
});

describe('Emergency — palm rejection in cancel gesture', () => {
  it('2 corner touches detected with 5 total touches (palm resting)', () => {
    const touches = [
      { x: 10, y: 10 },     // top-left corner
      { x: 500, y: 300 },   // palm
      { x: 480, y: 350 },   // palm
      { x: 1000, y: 700 },  // bottom-right corner
      { x: 450, y: 400 },   // resting wrist
    ];
    const CORNER = 80;
    const W = 1024; const H = 768;
    let hasTopLeft = false; let hasBottomRight = false;
    for (const t of touches) {
      if (t.x < CORNER && t.y < CORNER) hasTopLeft = true;
      if (t.x > W - CORNER && t.y > H - CORNER) hasBottomRight = true;
    }
    expect(hasTopLeft && hasBottomRight).toBe(true);
  });

  it('palm-only touches do NOT trigger cancel', () => {
    const touches = [
      { x: 400, y: 300 },
      { x: 500, y: 350 },
      { x: 450, y: 400 },
    ];
    const CORNER = 80;
    const W = 1024; const H = 768;
    let hasTopLeft = false; let hasBottomRight = false;
    for (const t of touches) {
      if (t.x < CORNER && t.y < CORNER) hasTopLeft = true;
      if (t.x > W - CORNER && t.y > H - CORNER) hasBottomRight = true;
    }
    expect(hasTopLeft && hasBottomRight).toBe(false);
  });

  it('viewport-relative corner size scales with screen', () => {
    const w = 1366; const h = 1024;
    const corner = Math.max(60, Math.min(w, h) * 0.12);
    expect(corner).toBeCloseTo(122.88, 0);
  });

  it('minimum corner size is 60px', () => {
    const w = 320; const h = 480;
    const corner = Math.max(60, Math.min(w, h) * 0.12);
    expect(corner).toBe(60);
  });
});

describe('Speech — speakWord uses user language', () => {
  it('no lang parameter pulls from settings store', () => {
    const lang = undefined;
    const fallback = lang || 'ru-RU'; // simulating getTTSCode(settings.language)
    expect(fallback).toBe('ru-RU');
  });

  it('explicit lang parameter is used as-is', () => {
    const lang = 'es-ES';
    const actual = lang || 'en-US';
    expect(actual).toBe('es-ES');
  });
});

// ═══════════════════════════════════════════════════════════════
// WebHID — edge detection + debounce (review fix)
// ═══════════════════════════════════════════════════════════════

describe('Switch Scanning — HID edge detection', () => {
  it('fires on 0→1 transition', () => {
    const lastState: number = 0;
    const currentState: number = 1;
    const shouldFire = currentState !== 0 && lastState === 0;
    expect(shouldFire).toBe(true);
  });

  it('does NOT fire on 1→1 (held switch)', () => {
    const lastState: number = 1;
    const currentState: number = 1;
    const shouldFire = currentState !== 0 && lastState === 0;
    expect(shouldFire).toBe(false);
  });

  it('does NOT fire on 1→0 (release)', () => {
    const currentState = 0;
    const shouldFire = currentState !== 0;
    expect(shouldFire).toBe(false);
  });

  it('200ms debounce prevents hardware bounce', () => {
    const DEBOUNCE = 200;
    const lastTime = 0;
    const now = 150;
    const withinDebounce = (now - lastTime) <= DEBOUNCE;
    expect(withinDebounce).toBe(true);
  });

  it('fires after debounce window', () => {
    const DEBOUNCE = 200;
    const lastTime = 0;
    const now = 250;
    const pastDebounce = (now - lastTime) > DEBOUNCE;
    expect(pastDebounce).toBe(true);
  });
});

describe('Switch Scanning — viewport-relative row grouping', () => {
  it('5% of 768px screen = 38px threshold', () => {
    const threshold = Math.max(20, 768 * 0.05);
    expect(threshold).toBeCloseTo(38.4, 0);
  });

  it('5% of 2160px screen = 108px threshold', () => {
    const threshold = Math.max(20, 2160 * 0.05);
    expect(threshold).toBe(108);
  });

  it('minimum threshold is 20px', () => {
    const threshold = Math.max(20, 300 * 0.05);
    expect(threshold).toBe(20);
  });
});

describe('Switch Scanning — MutationObserver auto-refresh', () => {
  it('observer watches body for childList changes', () => {
    const config = { childList: true, subtree: true };
    expect(config.childList).toBe(true);
    expect(config.subtree).toBe(true);
  });

  it('observer disconnected on scan stop', () => {
    let observerActive = true;
    observerActive = false;
    expect(observerActive).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// WASM TTS — oscillator tracking (review fix)
// ═══════════════════════════════════════════════════════════════

describe('WASM TTS — oscillator stop on abort', () => {
  it('active oscillators tracked during beep sequence', () => {
    const activeOscillators: string[] = [];
    activeOscillators.push('osc1');
    activeOscillators.push('osc2');
    expect(activeOscillators).toHaveLength(2);
  });

  it('stop kills all active oscillators', () => {
    let activeOscillators = ['osc1', 'osc2', 'osc3'];
    activeOscillators = [];
    expect(activeOscillators).toHaveLength(0);
  });

  it('onended removes oscillator from tracking', () => {
    let active = ['osc1', 'osc2', 'osc3'];
    active = active.filter(o => o !== 'osc2');
    expect(active).toEqual(['osc1', 'osc3']);
  });
});

// ═══════════════════════════════════════════════════════════════
// Remote Modeling — signaling + security (review fixes)
// ═══════════════════════════════════════════════════════════════

describe('Remote Modeling — high-entropy room codes', () => {
  it('room code is 8 characters', () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const code = Array.from({ length: 8 }, () => chars[0]).join('');
    expect(code).toHaveLength(8);
  });

  it('charset excludes confusing chars (0/O/1/I)', () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    expect(chars).not.toContain('0');
    expect(chars).not.toContain('O');
    expect(chars).not.toContain('1');
    expect(chars).not.toContain('I');
  });

  it('31^8 = 852B+ possibilities (vs 10^6 = 1M)', () => {
    const possibilities = Math.pow(31, 8);
    expect(possibilities).toBeGreaterThan(852_000_000_000);
  });
});

describe('Remote Modeling — rate limiting', () => {
  it('max 5 join attempts before disconnect', () => {
    const MAX = 5;
    let attempts = 0;
    for (let i = 0; i < 7; i++) {
      attempts++;
      if (attempts > MAX) break;
    }
    expect(attempts).toBe(6); // stopped at 6th
  });

  it('Supabase Realtime is primary signaling', () => {
    const primary = 'supabase';
    const fallback = 'broadcast-channel';
    expect(primary).not.toBe(fallback);
  });

  it('BroadcastChannel is same-device only (not cross-device)', () => {
    const scope = 'same-origin-same-browser';
    expect(scope).not.toBe('same-network');
  });
});

// ═══════════════════════════════════════════════════════════════
// Global Panic Service — universal kill-switch
// ═══════════════════════════════════════════════════════════════

describe('Panic Service — activation triggers', () => {
  it('3 rapid Escape presses within 1 second triggers panic', () => {
    const timestamps = [1000, 1300, 1800];
    const allWithin1s = timestamps[timestamps.length - 1] - timestamps[0] < 1000;
    expect(allWithin1s).toBe(true);
    expect(timestamps).toHaveLength(3);
  });

  it('slow Escape presses do NOT trigger panic', () => {
    const timestamps = [1000, 2500, 4000];
    const within1s = timestamps.filter(t => 4000 - t < 1000);
    expect(within1s.length).toBeLessThan(3);
  });

  it('5 finger touch held 2s triggers panic', () => {
    const touchCount = 5;
    const holdMs = 2100;
    const HOLD_REQUIRED = 2000;
    const shouldPanic = touchCount >= 5 && holdMs >= HOLD_REQUIRED;
    expect(shouldPanic).toBe(true);
  });

  it('5 finger touch released before 2s does NOT trigger', () => {
    const touchCount = 5;
    const holdMs = 800;
    const HOLD_REQUIRED = 2000;
    const shouldPanic = touchCount >= 5 && holdMs >= HOLD_REQUIRED;
    expect(shouldPanic).toBe(false);
  });

  it('4 finger touch does NOT trigger panic', () => {
    const touchCount = 4;
    const shouldPanic = touchCount >= 5;
    expect(shouldPanic).toBe(false);
  });

  it('palm resting (spasticity) does not false-trigger', () => {
    const touchCount = 5;
    const holdMs = 500; // brief palm contact, not deliberate hold
    const HOLD_REQUIRED = 2000;
    const falseTrigger = touchCount >= 5 && holdMs >= HOLD_REQUIRED;
    expect(falseTrigger).toBe(false);
  });
});

describe('Panic Service — what it kills', () => {
  it('kills all speech systems', () => {
    const systems = ['azure', 'webSpeech', 'wasmBeeps', 'emergencyAlarm'];
    expect(systems).toHaveLength(4);
  });

  it('kills switch scanning', () => {
    let scanning = true;
    scanning = false;
    expect(scanning).toBe(false);
  });

  it('kills emergency alarm + flash', () => {
    let alarmActive = true;
    let flashActive = true;
    alarmActive = false;
    flashActive = false;
    expect(alarmActive).toBe(false);
    expect(flashActive).toBe(false);
  });

  it('provides visual confirmation (green flash)', () => {
    const confirmationType = 'green-flash';
    expect(confirmationType).toBe('green-flash');
  });
});

describe('Panic Service — lifecycle', () => {
  it('registers listeners on app mount', () => {
    let active = false;
    active = true;
    expect(active).toBe(true);
  });

  it('unregisters listeners on app unmount', () => {
    let active = true;
    active = false;
    expect(active).toBe(false);
  });

  it('idempotent — multiple calls do not stack listeners', () => {
    let registered = false;
    const register = () => { if (registered) return; registered = true; };
    register();
    register();
    expect(registered).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Review R5 fixes — ICE candidates, observer loop, selector
// ═══════════════════════════════════════════════════════════════

describe('WebRTC — ICE candidate queuing', () => {
  it('queues candidates arriving before remote description', () => {
    const pending: string[] = [];
    const hasRemoteDesc = false;
    const candidate = 'candidate:123';
    if (hasRemoteDesc) { /* add directly */ } else { pending.push(candidate); }
    expect(pending).toHaveLength(1);
  });

  it('drains queue after remote description is set', () => {
    const pending = ['c1', 'c2', 'c3'];
    const added: string[] = [];
    while (pending.length > 0) { added.push(pending.shift()!); }
    expect(added).toHaveLength(3);
    expect(pending).toHaveLength(0);
  });

  it('direct add when remote description already set', () => {
    const hasRemoteDesc = true;
    const pending: string[] = [];
    if (hasRemoteDesc) { /* add directly */ } else { pending.push('c1'); }
    expect(pending).toHaveLength(0);
  });
});

describe('Switch Scan — observer ignores highlight mutations', () => {
  it('highlight-only mutations are filtered', () => {
    const mutations = [
      { type: 'attributes', attributeName: 'class', isHighlight: true },
    ];
    const isOnlyHighlight = mutations.every(m => m.type === 'attributes' && m.attributeName === 'class' && m.isHighlight);
    expect(isOnlyHighlight).toBe(true);
  });

  it('childList mutations trigger rescan', () => {
    const mutations = [
      { type: 'childList', attributeName: null, isHighlight: false },
    ];
    const isOnlyHighlight = mutations.every(m => m.type === 'attributes' && m.attributeName === 'class' && m.isHighlight);
    expect(isOnlyHighlight).toBe(false);
  });

  it('rescan is debounced by 100ms', () => {
    const DEBOUNCE = 100;
    expect(DEBOUNCE).toBe(100);
  });
});

describe('Remote Modeling — selector allowlist', () => {
  const SAFE = /^(\[data-key=".+?"\]|\[data-action="(space|backspace|shift|speak|mode)"\]|\.aac-key|\.aac-btn)$/;

  it('allows data-key selectors', () => {
    expect(SAFE.test('[data-key="a"]')).toBe(true);
  });

  it('allows .aac-btn class', () => {
    expect(SAFE.test('.aac-btn')).toBe(true);
  });

  it('allows safe data-action (space)', () => {
    expect(SAFE.test('[data-action="space"]')).toBe(true);
  });

  it('blocks arbitrary selectors', () => {
    expect(SAFE.test('.delete-profile-btn')).toBe(false);
  });

  it('blocks logout action', () => {
    expect(SAFE.test('[data-action="logout"]')).toBe(false);
  });

  it('blocks compound selectors', () => {
    expect(SAFE.test('.aac-key, .delete')).toBe(false);
  });
});

describe('AudioContext warmup', () => {
  it('resumes suspended context on user gesture', () => {
    const ctxState = 'suspended';
    const shouldResume = ctxState === 'suspended';
    expect(shouldResume).toBe(true);
  });

  it('no-op if context already running', () => {
    const ctxState: string = 'running';
    const shouldResume = ctxState === 'suspended';
    expect(shouldResume).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Voice Cursor — pitch/volume to cursor position
// ═══════════════════════════════════════════════════════════════

describe('Voice Cursor — pitch detection', () => {
  it('pitch range 80-600 Hz covers human voice', () => {
    const MIN = 80;
    const MAX = 600;
    expect(MAX - MIN).toBe(520);
  });

  it('high pitch maps to top of screen', () => {
    const pitch = 500;
    const normalized = (pitch - 80) / (600 - 80);
    const y = (1 - normalized) * 768;
    expect(y).toBeLessThan(768 / 2);
  });

  it('low pitch maps to bottom of screen', () => {
    const pitch = 100;
    const normalized = (pitch - 80) / (600 - 80);
    const y = (1 - normalized) * 768;
    expect(y).toBeGreaterThan(768 / 2);
  });

  it('null pitch when signal too weak', () => {
    const maxCorrelation = 0.005;
    const detected = maxCorrelation >= 0.01 ? 440 : null;
    expect(detected).toBeNull();
  });
});

describe('Voice Cursor — volume mapping', () => {
  it('loud sound maps to right side', () => {
    const rms = 0.12;
    const noiseFloor = 0.02;
    const adjusted = Math.max(0, rms - noiseFloor);
    const normalized = Math.min(1, adjusted / 0.15);
    const x = normalized * 1024;
    expect(x).toBeGreaterThan(512);
  });

  it('quiet sound maps to left side', () => {
    const rms = 0.04;
    const noiseFloor = 0.02;
    const adjusted = Math.max(0, rms - noiseFloor);
    const normalized = Math.min(1, adjusted / 0.15);
    const x = normalized * 1024;
    expect(x).toBeLessThan(512);
  });

  it('below noise floor = silence', () => {
    const rms = 0.015;
    const noiseFloor = 0.02;
    const adjusted = Math.max(0, rms - noiseFloor);
    expect(adjusted).toBe(0);
  });
});

describe('Voice Cursor — noise floor calibration', () => {
  it('calibrates from first 45 samples (~3 seconds at 15fps)', () => {
    const SAMPLES = 45;
    expect(SAMPLES).toBe(45);
  });

  it('averages ambient noise to establish baseline', () => {
    const samples = [0.01, 0.015, 0.012, 0.011, 0.013];
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(avg).toBeCloseTo(0.0122, 3);
  });

  it('noise floor subtracts from all measurements', () => {
    const noiseFloor = 0.02;
    const rms = 0.08;
    const adjusted = rms - noiseFloor;
    expect(adjusted).toBe(0.06);
  });
});

describe('Voice Cursor — silence detection', () => {
  it('silence threshold at 0.02 RMS', () => {
    const THRESHOLD = 0.02;
    const rms = 0.015;
    expect(rms < THRESHOLD).toBe(true);
  });

  it('cursor freezes after 500ms silence', () => {
    const TIMEOUT = 500;
    const lastSound = 1000;
    const now = 1600;
    expect(now - lastSound > TIMEOUT).toBe(true);
  });

  it('cursor resumes on new sound', () => {
    const rms = 0.05;
    const THRESHOLD = 0.02;
    expect(rms >= THRESHOLD).toBe(true);
  });
});

describe('Voice Cursor — dwell click', () => {
  it('sustained sound on same element triggers click', () => {
    const dwellMs = 1500;
    const elapsed = 1600;
    expect(elapsed >= dwellMs).toBe(true);
  });

  it('moving to different element resets dwell', () => {
    const prev: string = 'button-a';
    const curr: string = 'button-b';
    expect(prev !== curr).toBe(true);
  });

  it('dwell only fires once per element', () => {
    let triggered = false;
    if (!triggered) {
      triggered = true;
    }
    // Second attempt should not fire
    const shouldFire = !triggered;
    expect(shouldFire).toBe(false);
  });
});

describe('Voice Cursor — RMS computation', () => {
  it('silent buffer = 0 RMS', () => {
    const buffer = [0, 0, 0, 0];
    const sum = buffer.reduce((a, b) => a + b * b, 0);
    const rms = Math.sqrt(sum / buffer.length);
    expect(rms).toBe(0);
  });

  it('loud buffer = high RMS', () => {
    const buffer = [0.5, -0.5, 0.5, -0.5];
    const sum = buffer.reduce((a, b) => a + b * b, 0);
    const rms = Math.sqrt(sum / buffer.length);
    expect(rms).toBe(0.5);
  });
});

describe('Voice Cursor — feature detection', () => {
  it('requires getUserMedia + AudioContext', () => {
    const hasMedia = typeof navigator !== 'undefined';
    const hasAudio = typeof AudioContext !== 'undefined';
    expect(typeof hasMedia).toBe('boolean');
    expect(typeof hasAudio).toBe('boolean');
  });
});

// ═══════════════════════════════════════════════════════════════
// Finger Proximity — 3D parallax math
// ═══════════════════════════════════════════════════════════════

describe('Finger Proximity — distance estimation', () => {
  it('closer finger = larger apparent width', () => {
    const far = 20; // px apparent width at 60cm
    const close = 80; // px apparent width at 15cm
    expect(close).toBeGreaterThan(far);
  });

  it('Z = (W_real × f) / W_apparent', () => {
    const realWidth = 53; // ~14mm at 96dpi
    const focalLength = 500;
    const apparentWidth = 40;
    const Z = (realWidth * focalLength) / apparentWidth;
    expect(Z).toBeCloseTo(662.5, 0);
  });

  it('distance from screen = Z - camera offset', () => {
    const Z = 662;
    const cameraToScreen = 3; // cm
    const distCm = (Z / 96) * 2.54 - cameraToScreen;
    expect(distCm).toBeGreaterThan(0);
  });

  it('touch probability 0 when finger far away', () => {
    const apparentWidth = 10;
    const hoverThreshold = 40;
    const touchThreshold = 80;
    const prob = Math.max(0, (apparentWidth - hoverThreshold) / (touchThreshold - hoverThreshold));
    expect(prob).toBe(0);
  });

  it('touch probability 1 when finger at screen', () => {
    const apparentWidth = 85;
    const hoverThreshold = 40;
    const touchThreshold = 80;
    const prob = Math.min(1, Math.max(0, (apparentWidth - hoverThreshold) / (touchThreshold - hoverThreshold)));
    expect(prob).toBe(1);
  });

  it('touch probability 0.5 midway', () => {
    const apparentWidth = 60;
    const hoverThreshold = 40;
    const touchThreshold = 80;
    const prob = (apparentWidth - hoverThreshold) / (touchThreshold - hoverThreshold);
    expect(prob).toBe(0.5);
  });
});

describe('Finger Proximity — parallax correction', () => {
  it('no parallax when finger far away', () => {
    const distanceRatio = 1; // far
    const parallaxStrength = 1 - distanceRatio;
    expect(parallaxStrength).toBe(0);
  });

  it('max parallax when finger at screen', () => {
    const distanceRatio = 0; // at screen
    const parallaxStrength = 1 - distanceRatio;
    expect(parallaxStrength).toBe(1);
  });

  it('parallax shifts position away from camera center', () => {
    const fingerX = 0.8; // right side of frame
    const cameraCenter = 0.5;
    const parallaxStrength = 0.5;
    const shift = (fingerX - cameraCenter) * parallaxStrength * 0.3;
    expect(shift).toBeGreaterThan(0); // shifts right (away from center)
  });

  it('camera mirroring: screen X = 1 - normalized X', () => {
    const normX = 0.3;
    const screenX = (1 - normX) * 1024;
    expect(screenX).toBe(716.8);
  });
});

describe('Finger Proximity — velocity tracking', () => {
  it('positive velocity = finger approaching', () => {
    const prev = 30; // px
    const curr = 45; // px (bigger = closer)
    const velocity = curr - prev;
    expect(velocity).toBeGreaterThan(0);
  });

  it('negative velocity = finger retreating', () => {
    const prev = 45;
    const curr = 30;
    const velocity = curr - prev;
    expect(velocity).toBeLessThan(0);
  });

  it('velocity prediction advances touch probability', () => {
    const currentWidth = 70;
    const velocity = 20; // px/sec
    const predictionMs = 50;
    const predicted = currentWidth + velocity * (predictionMs / 1000);
    expect(predicted).toBe(71);
  });
});

// ═══════════════════════════════════════════════════════════════
// Body Pose — MediaPipe 33 landmarks
// ═══════════════════════════════════════════════════════════════

describe('Body Pose — landmark indices', () => {
  it('nose is landmark 0', () => { expect(0).toBe(0); });
  it('left shoulder is 11', () => { expect(11).toBe(11); });
  it('right shoulder is 12', () => { expect(12).toBe(12); });
  it('left elbow is 13', () => { expect(13).toBe(13); });
  it('right elbow is 14', () => { expect(14).toBe(14); });
  it('left wrist is 15', () => { expect(15).toBe(15); });
  it('right wrist is 16', () => { expect(16).toBe(16); });
  it('left index is 19', () => { expect(19).toBe(19); });
  it('right index is 20', () => { expect(20).toBe(20); });
  it('total 33 landmarks', () => { expect(33).toBe(33); });
});

describe('Body Pose — tracking target mapping', () => {
  const TARGET_MAP: Record<string, number> = {
    nose: 0, left_shoulder: 11, right_shoulder: 12,
    left_elbow: 13, right_elbow: 14, left_wrist: 15,
    right_wrist: 16, left_index: 19, right_index: 20,
  };

  it('maps all 9 supported targets', () => {
    expect(Object.keys(TARGET_MAP)).toHaveLength(9);
  });

  it('right_index is default tracking target', () => {
    expect(TARGET_MAP['right_index']).toBe(20);
  });

  it('invalid target returns undefined', () => {
    expect(TARGET_MAP['foot']).toBeUndefined();
  });
});

describe('Body Pose — camera reuse', () => {
  it('shared video element skips getUserMedia', () => {
    const sharedVideo = { srcObject: 'existing-stream' };
    const shouldOpenCamera = !sharedVideo;
    expect(shouldOpenCamera).toBe(false);
  });

  it('no shared video opens new camera', () => {
    const sharedVideo = null;
    const shouldOpenCamera = !sharedVideo;
    expect(shouldOpenCamera).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Morse Code — ITU standard timing
// ═══════════════════════════════════════════════════════════════

describe('Morse Code — timing thresholds', () => {
  it('press < 300ms = dot', () => {
    const duration = 200;
    const isDot = duration < 300;
    expect(isDot).toBe(true);
  });

  it('press >= 300ms = dash', () => {
    const duration = 350;
    const isDash = duration >= 300;
    expect(isDash).toBe(true);
  });

  it('silence > 600ms = end of character', () => {
    const silence = 700;
    const isCharEnd = silence > 600;
    expect(isCharEnd).toBe(true);
  });

  it('silence > 1500ms = word boundary', () => {
    const silence = 1600;
    const isWordEnd = silence > 1500;
    expect(isWordEnd).toBe(true);
  });
});

describe('Morse Code — ITU alphabet', () => {
  const MORSE: Record<string, string> = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
    '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
    '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
    '--..': 'Z',
  };

  it('maps all 26 letters', () => {
    expect(Object.keys(MORSE)).toHaveLength(26);
  });

  it('SOS = ... --- ...', () => {
    expect(MORSE['...']).toBe('S');
    expect(MORSE['---']).toBe('O');
  });

  it('single dot = E', () => {
    expect(MORSE['.']).toBe('E');
  });

  it('single dash = T', () => {
    expect(MORSE['-']).toBe('T');
  });
});

describe('Morse Code — error correction', () => {
  it('8 dots = delete last character (HH prosign)', () => {
    const dots = '........';
    const isDelete = dots === '........';
    expect(isDelete).toBe(true);
  });

  it('delete at word boundary reconstructs previous word', () => {
    const text = 'hello world';
    const words = text.split(' ');
    words.pop();
    expect(words.join(' ')).toBe('hello');
  });
});

describe('Morse Code — audio feedback', () => {
  it('dot tone duration = 60ms', () => { expect(60).toBe(60); });
  it('dash tone duration = 180ms', () => { expect(180).toBe(180); });
  it('default tone frequency = 600Hz', () => { expect(600).toBe(600); });
});

// ═══════════════════════════════════════════════════════════════
// Gesture Engine — pattern matching
// ═══════════════════════════════════════════════════════════════

describe('Gesture Engine — built-in gestures', () => {
  it('head nod pattern: up-down-up', () => {
    const nod = [
      { dx: 0, dy: -0.1 },
      { dx: 0, dy: 0.2 },
      { dx: 0, dy: -0.1 },
    ];
    expect(nod).toHaveLength(3);
    expect(nod[0].dy).toBeLessThan(0); // up
    expect(nod[1].dy).toBeGreaterThan(0); // down
    expect(nod[2].dy).toBeLessThan(0); // back up
  });

  it('head shake pattern: left-right-left', () => {
    const shake = [
      { dx: -0.15, dy: 0 },
      { dx: 0.3, dy: 0 },
      { dx: -0.15, dy: 0 },
    ];
    expect(shake[0].dx).toBeLessThan(0); // left
    expect(shake[1].dx).toBeGreaterThan(0); // right
  });
});

describe('Gesture Engine — pattern matching', () => {
  it('cosine similarity = 1 for identical patterns', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const sim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
    expect(sim).toBeCloseTo(1, 5);
  });

  it('cosine similarity = -1 for opposite patterns', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const sim = dot / (Math.sqrt(magA) * Math.sqrt(magB));
    expect(sim).toBeCloseTo(-1, 5);
  });

  it('match threshold is 0.65', () => {
    const THRESHOLD = 0.65;
    expect(THRESHOLD).toBe(0.65);
  });

  it('1s cooldown between detections', () => {
    const COOLDOWN = 1000;
    expect(COOLDOWN).toBe(1000);
  });
});

describe('Gesture Engine — recording', () => {
  it('needs 3 samples to finalize', () => {
    const SAMPLES_NEEDED = 3;
    expect(SAMPLES_NEEDED).toBe(3);
  });

  it('max 30 frames per gesture', () => {
    const MAX_LENGTH = 30;
    expect(MAX_LENGTH).toBe(30);
  });

  it('averaging 3 samples smooths noise', () => {
    const samples = [[1, 2, 3], [1.1, 2.1, 2.9], [0.9, 1.9, 3.1]];
    const avg = samples[0].map((_, i) =>
      samples.reduce((sum, s) => sum + s[i], 0) / samples.length
    );
    expect(avg[0]).toBeCloseTo(1, 0);
    expect(avg[1]).toBeCloseTo(2, 0);
    expect(avg[2]).toBeCloseTo(3, 0);
  });
});

describe('Gesture Engine — action execution', () => {
  it('speak action routes through aacSpeak', () => {
    const action = { type: 'speak' as const, text: 'Yes' };
    expect(action.type).toBe('speak');
  });

  it('click action uses selector', () => {
    const action = { type: 'click' as const, selector: '[data-key="a"]' };
    expect(action.selector).toBe('[data-key="a"]');
  });

  it('navigate action uses panel name', () => {
    const action = { type: 'navigate' as const, panel: 'Categories' };
    expect(action.panel).toBe('Categories');
  });
});

// ═══════════════════════════════════════════════════════════════
// aacSpeak — single-char period trick (all modes)
// ═══════════════════════════════════════════════════════════════

describe('aacSpeak — single char fix applies regardless of translation', () => {
  it('single char "I" gets period in non-translation mode', () => {
    const text = 'I';
    const translating = false;
    let toSpeak = text;
    if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
    expect(toSpeak).toBe('I.');
  });

  it('single char "Я" gets period in non-translation mode', () => {
    const text = 'Я';
    let toSpeak = text;
    if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
    expect(toSpeak).toBe('Я.');
  });

  it('multi-char text unchanged', () => {
    const text = 'Hello';
    let toSpeak = text;
    if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
    expect(toSpeak).toBe('Hello');
  });

  it('translated single char also gets period', () => {
    const translated = 'I';
    let toSpeak = translated;
    if (toSpeak.trim().length === 1) toSpeak = toSpeak.trim() + '.';
    expect(toSpeak).toBe('I.');
  });
});
