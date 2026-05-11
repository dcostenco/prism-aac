import { create } from 'zustand';

export type EmergencyPhase = 'idle' | 'countdown' | 'dispatching' | 'dispatched' | 'cancelled';
export type EmergencySeverity = 'standard' | 'urgent' | 'medical' | 'critical';

interface EmergencyState {
    phase: EmergencyPhase;
    phrase: string;
    severity: EmergencySeverity;
    countdown: number; // seconds remaining
    cancelFn: (() => void) | null;
    setCountdown: (seconds: number) => void;
    setActive: (phrase: string, severity: EmergencySeverity, cancelFn: () => void) => void;
    setPhase: (phase: EmergencyPhase) => void;
    reset: () => void;
}

export const useEmergencyStore = create<EmergencyState>((set) => ({
    phase: 'idle',
    phrase: '',
    severity: 'standard',
    countdown: 10,
    cancelFn: null,
    setCountdown: (seconds) => set({ countdown: seconds }),
    setActive: (phrase, severity, cancelFn) =>
        set({ phase: 'countdown', phrase, severity, cancelFn }),
    setPhase: (phase) => set({ phase }),
    reset: () => set({ phase: 'idle', phrase: '', severity: 'standard', countdown: 10, cancelFn: null }),
}));
