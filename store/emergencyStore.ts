import { create } from 'zustand';

/** not_sent: the countdown ended and no one could be reached. */
export type EmergencyPhase = 'idle' | 'countdown' | 'dispatching' | 'dispatched' | 'not_sent' | 'cancelled';
export type NotSentReason = 'no_contact' | 'unreached' | 'queued';
export type EmergencySeverity = 'standard' | 'urgent' | 'medical' | 'critical';

interface EmergencyState {
    phase: EmergencyPhase;
    phrase: string;
    severity: EmergencySeverity;
    countdown: number; // seconds remaining
    cancelFn: (() => void) | null;
    /** With phase not_sent: why. no_contact — no emergency contact or caregiver
     *  is set up; unreached — no one could be reached; queued — the device slept
     *  through the countdown, so nothing was attempted yet. */
    notSentReason: NotSentReason;
    setCountdown: (seconds: number) => void;
    setActive: (phrase: string, severity: EmergencySeverity, cancelFn: () => void) => void;
    setPhase: (phase: EmergencyPhase) => void;
    setNotSent: (reason: NotSentReason) => void;
    reset: () => void;
}

export const useEmergencyStore = create<EmergencyState>((set) => ({
    phase: 'idle',
    phrase: '',
    severity: 'standard',
    countdown: 10,
    cancelFn: null,
    notSentReason: 'unreached',
    setCountdown: (seconds) => set({ countdown: seconds }),
    setActive: (phrase, severity, cancelFn) =>
        set({ phase: 'countdown', phrase, severity, cancelFn }),
    setPhase: (phase) => set({ phase }),
    setNotSent: (notSentReason) => set({ phase: 'not_sent', notSentReason }),
    reset: () => set({ phase: 'idle', phrase: '', severity: 'standard', countdown: 10, cancelFn: null, notSentReason: 'unreached' }),
}));
