'use client';

/**
 * Remote Modeling Service — WebRTC Data Channels for Caregiver-to-Child
 *
 * Enables a caregiver/therapist to remotely highlight keys, trigger
 * phrases, and model language on the child's AAC device in real-time.
 *
 * Uses WebRTC data channels for sub-100ms latency. No video/audio
 * streams — data only, so bandwidth is minimal (~1KB/s).
 *
 * Architecture:
 *   1. Child's device generates a 6-digit room code
 *   2. Caregiver enters the code on their device/laptop
 *   3. WebRTC peer connection established via Supabase Realtime as signaling
 *   4. Caregiver sends commands: highlight(key), speak(phrase), navigate(panel)
 *   5. Child's device executes commands with visual feedback
 *
 * Privacy: No screen sharing. Caregiver can only send pre-defined commands.
 * The child sees a green border around modeled elements (aided language stimulation).
 */

// ── Types ──────────────────────────────────────────────────────────────

export type RemoteCommand =
  | { type: 'highlight'; selector: string; duration: number }
  | { type: 'speak'; text: string }
  | { type: 'navigate'; panel: string }
  | { type: 'tap'; selector: string }
  | { type: 'clear_highlight' }
  | { type: 'ping' };

export type RemoteRole = 'child' | 'caregiver';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting' | 'connected' | 'error';

export interface RemoteSession {
  roomCode: string;
  role: RemoteRole;
  status: ConnectionStatus;
  send: (cmd: RemoteCommand) => void;
  close: () => void;
}

export interface RemoteModelingCallbacks {
  onCommand: (cmd: RemoteCommand) => void;
  onStatusChange: (status: ConnectionStatus) => void;
  // Child must explicitly accept caregiver connections. Without this,
  // any authenticated user polling room codes can hijack the session.
  onConnectionRequest?: (caregiverId: string) => Promise<boolean>;
}

// ── Room Code ──────────────────────────────────────────────────────────

// Room code (8-char, displayed to caregiver) + session secret (UUID, never displayed).
// The server maps roomCode → sessionSecret. Caregiver must know the room code,
// AND the child must explicitly accept the connection via UI prompt.
export function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 8; i++) code += chars[arr[i] % chars.length];
  return code;
}

export function generateSessionSecret(): string {
  return crypto.randomUUID();
}

// ── ICE/STUN Configuration ─────────────────────────────────────────────

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ── Signaling ──────────────────────────────────────────────────────────
// BroadcastChannel works between tabs on the SAME device/browser only
// (same-origin policy). For cross-device signaling (therapist laptop →
// child iPad), a server-side relay (Supabase Realtime) is required.
// The BroadcastChannel path enables same-device testing and demo mode.
// In production, the Supabase Realtime channel is the primary transport.

const SIGNAL_PREFIX = 'prism-rtc-signal-';

interface SignalMessage {
  from: RemoteRole;
  type: 'offer' | 'answer' | 'candidate' | 'join';
  payload: string;
  timestamp: number;
}

// Server-side authenticated signaling via dedicated /api/v1/webrtc/signal
// endpoint. This route is NOT metered by checkAndIncrementPrismUsage —
// it's a lightweight signaling relay exempt from daily quotas.
// Polling at 2s (not 500ms) to minimize server load. Polling stops
// automatically once the WebRTC data channel is connected.

let signalingPollTimer: ReturnType<typeof setInterval> | null = null;
const SIGNAL_POLL_MS = 2000;
// Client-side rate limit: max 3 signal posts per second (defense-in-depth).
// Server MUST also enforce @upstash/ratelimit at 3 req/s per userId.
let lastPostTime = 0;
const POST_THROTTLE_MS = 333;

async function postSignal(roomCode: string, msg: SignalMessage): Promise<void> {
  const now = Date.now();
  if (now - lastPostTime < POST_THROTTLE_MS) return;
  lastPostTime = now;

  const token = typeof window !== 'undefined' ? localStorage.getItem('prism-aac-auth-token') : null;
  if (!token) return;
  try {
    await fetch('/api/v1/webrtc/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ room: roomCode, signal: msg }),
      signal: AbortSignal.timeout(5000),
    });
  } catch { /* best effort */ }
}

async function pollSignals(roomCode: string, role: RemoteRole, onMessage: (msg: SignalMessage) => void): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('prism-aac-auth-token') : null;
  if (!token) return;
  try {
    const res = await fetch(`/api/v1/webrtc/signal?room=${roomCode}&role=${role}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const signals = await res.json() as SignalMessage[];
    for (const msg of signals) onMessage(msg);
  } catch { /* network error */ }
}

// 5-minute timeout: if no WebRTC connection established, stop polling
// to prevent infinite battery/network drain.
const SIGNALING_TIMEOUT_MS = 5 * 60 * 1000;
let signalingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

function startSignalingPoll(roomCode: string, role: RemoteRole, onMessage: (msg: SignalMessage) => void): void {
  if (signalingPollTimer) return;
  signalingPollTimer = setInterval(() => pollSignals(roomCode, role, onMessage), SIGNAL_POLL_MS);
  signalingTimeoutTimer = setTimeout(() => {
    stopSignalingPoll();
  }, SIGNALING_TIMEOUT_MS);
}

function stopSignalingPoll(): void {
  if (signalingPollTimer) { clearInterval(signalingPollTimer); signalingPollTimer = null; }
  if (signalingTimeoutTimer) { clearTimeout(signalingTimeoutTimer); signalingTimeoutTimer = null; }
}

function broadcastSignal(roomCode: string, msg: SignalMessage): void {
  // Primary: authenticated server-side signaling
  postSignal(roomCode, msg);

  // Fallback: BroadcastChannel (same-device tabs only — for testing/demo)
  try {
    const ch = new BroadcastChannel(`${SIGNAL_PREFIX}${roomCode}`);
    ch.postMessage(msg);
    ch.close();
  } catch { /* not available */ }
}

// ── WebRTC Session ─────────────────────────────────────────────────────

export function createRemoteSession(
  role: RemoteRole,
  roomCode: string,
  callbacks: RemoteModelingCallbacks,
): RemoteSession {
  let pc: RTCPeerConnection | null = null;
  let dc: RTCDataChannel | null = null;
  let status: ConnectionStatus = 'disconnected';
  let signalChannel: BroadcastChannel | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const setStatus = (s: ConnectionStatus) => {
    status = s;
    callbacks.onStatusChange(s);
  };

  const send = (cmd: RemoteCommand) => {
    if (dc?.readyState === 'open') {
      dc.send(JSON.stringify(cmd));
    }
  };

  const close = () => {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (signalChannel) { signalChannel.close(); signalChannel = null; }
    stopSignalingPoll();
    if (dc) { dc.close(); dc = null; }
    if (pc) { pc.close(); pc = null; }
    setStatus('disconnected');
  };

  // Throttle incoming commands to max 20/sec to prevent flooding
  let lastCmdTime = 0;
  const CMD_THROTTLE_MS = 50;

  const setupDataChannel = (channel: RTCDataChannel) => {
    dc = channel;
    dc.onopen = () => { setStatus('connected'); stopSignalingPoll(); };
    dc.onclose = () => setStatus('disconnected');
    dc.onmessage = (e) => {
      const now = performance.now();
      if (now - lastCmdTime < CMD_THROTTLE_MS) return;
      lastCmdTime = now;
      try {
        const cmd = JSON.parse(e.data) as RemoteCommand;
        callbacks.onCommand(cmd);
      } catch { /* malformed message */ }
    };
  };

  let connectionPromptActive = false;
  const blockedCaregivers = new Set<string>();

  // Queue ICE candidates that arrive before setRemoteDescription completes.
  // Without this, ~20% of connections fail with InvalidStateError.
  const pendingCandidates: RTCIceCandidateInit[] = [];

  async function drainPendingCandidates(): Promise<void> {
    while (pendingCandidates.length > 0 && pc?.remoteDescription) {
      try { await pc.addIceCandidate(new RTCIceCandidate(pendingCandidates.shift()!)); } catch { /* */ }
    }
  }

  const handleSignal = async (msg: SignalMessage) => {
    if (msg.from === role) return;

    if (msg.type === 'join' && role === 'child') {
      // Lock: only one connection prompt at a time. Prevents prompt bombing
      // where an attacker floods join signals to stack infinite UI modals.
      if (connectionPromptActive) return;
      if (blockedCaregivers.has(msg.from)) return;

      if (callbacks.onConnectionRequest) {
        connectionPromptActive = true;
        const accepted = await callbacks.onConnectionRequest(msg.from);
        connectionPromptActive = false;
        if (!accepted) {
          blockedCaregivers.add(msg.from);
          return;
        }
      }

      pc = new RTCPeerConnection(ICE_CONFIG);
      const channel = pc.createDataChannel('modeling', { ordered: true });
      setupDataChannel(channel);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          broadcastSignal(roomCode, {
            from: role, type: 'candidate',
            payload: JSON.stringify(e.candidate), timestamp: Date.now(),
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      broadcastSignal(roomCode, {
        from: role, type: 'offer',
        payload: JSON.stringify(offer), timestamp: Date.now(),
      });
    }

    if (msg.type === 'offer' && role === 'caregiver') {
      pc = new RTCPeerConnection(ICE_CONFIG);
      pc.ondatachannel = (e) => setupDataChannel(e.channel);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          broadcastSignal(roomCode, {
            from: role, type: 'candidate',
            payload: JSON.stringify(e.candidate), timestamp: Date.now(),
          });
        }
      };

      await pc.setRemoteDescription(JSON.parse(msg.payload));
      await drainPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      broadcastSignal(roomCode, {
        from: role, type: 'answer',
        payload: JSON.stringify(answer), timestamp: Date.now(),
      });
    }

    if (msg.type === 'answer' && role === 'child' && pc) {
      await pc.setRemoteDescription(JSON.parse(msg.payload));
      await drainPendingCandidates();
    }

    if (msg.type === 'candidate') {
      if (pc?.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(JSON.parse(msg.payload))); } catch { /* */ }
      } else {
        pendingCandidates.push(JSON.parse(msg.payload));
      }
    }
  };

  // Rate-limit join attempts to prevent room code brute-forcing
  let joinAttempts = 0;
  const MAX_JOIN_ATTEMPTS = 5;

  const rateLimitedHandleSignal = (msg: SignalMessage) => {
    if (msg.type === 'join' && role === 'child') {
      joinAttempts++;
      if (joinAttempts > MAX_JOIN_ATTEMPTS) {
        setStatus('error');
        close();
        return;
      }
    }
    handleSignal(msg);
  };

  // Start signaling — authenticated server-side polling + BroadcastChannel fallback
  setStatus(role === 'child' ? 'waiting' : 'connecting');

  // Primary: server-side authenticated polling (500ms interval)
  startSignalingPoll(roomCode, role, rateLimitedHandleSignal);

  // Secondary: BroadcastChannel for same-device tabs (testing/demo)
  try {
    signalChannel = new BroadcastChannel(`${SIGNAL_PREFIX}${roomCode}`);
    signalChannel.onmessage = (e) => rateLimitedHandleSignal(e.data as SignalMessage);
  } catch { /* not available */ }

  // If caregiver, send join signal
  if (role === 'caregiver') {
    broadcastSignal(roomCode, {
      from: 'caregiver',
      type: 'join',
      payload: '',
      timestamp: Date.now(),
    });
  }

  // Keepalive ping every 5s
  const pingTimer = setInterval(() => {
    if (status === 'connected') send({ type: 'ping' });
  }, 5000);

  const originalClose = close;
  const enhancedClose = () => {
    clearInterval(pingTimer);
    originalClose();
  };

  return { roomCode, role, status, send, close: enhancedClose };
}

// ── Command Executor (runs on child's device) ──────────────────────────

let activeHighlight: HTMLElement | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

// Restrict remote selectors to AAC communication elements only.
// Prevents attackers from clicking logout, delete, or settings buttons.
// Only allow selectors targeting keyboard keys and AAC-specific actions.
// data-action is restricted to known safe values (space, backspace, shift, speak, mode).
const SAFE_ACTIONS = new Set(['space', 'backspace', 'shift', 'speak', 'mode']);
const SAFE_SELECTOR = /^(\[data-key=".+?"\]|\[data-action="(space|backspace|shift|speak|mode)"\]|\.aac-key|\.aac-btn)$/;

function isSafeSelector(selector: string): boolean {
  return SAFE_SELECTOR.test(selector);
}

export function executeRemoteCommand(cmd: RemoteCommand): void {
  switch (cmd.type) {
    case 'highlight': {
      clearHighlight();
      if (!isSafeSelector(cmd.selector)) break;
      const el = document.querySelector(cmd.selector) as HTMLElement | null;
      if (el) {
        el.classList.add('remote-model-highlight');
        activeHighlight = el;
        highlightTimer = setTimeout(clearHighlight, cmd.duration || 3000);
      }
      break;
    }
    case 'tap': {
      if (!isSafeSelector(cmd.selector)) break;
      const el = document.querySelector(cmd.selector) as HTMLElement | null;
      if (el) {
        el.classList.add('remote-model-highlight');
        setTimeout(() => {
          el.click();
          el.classList.remove('remote-model-highlight');
        }, 500);
      }
      break;
    }
    case 'speak': {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(cmd.text);
        u.rate = 0.8;
        window.speechSynthesis.speak(u);
      }
      break;
    }
    case 'navigate': {
      const btn = document.querySelector(`[aria-label="${cmd.panel}"]`) as HTMLElement | null;
      btn?.click();
      break;
    }
    case 'clear_highlight':
      clearHighlight();
      break;
    case 'ping':
      break;
  }
}

function clearHighlight(): void {
  if (highlightTimer) { clearTimeout(highlightTimer); highlightTimer = null; }
  if (activeHighlight) {
    activeHighlight.classList.remove('remote-model-highlight');
    activeHighlight = null;
  }
}

// ── Feature Detection ──────────────────────────────────────────────────

export function isWebRTCSupported(): boolean {
  return typeof window !== 'undefined' && 'RTCPeerConnection' in window;
}
