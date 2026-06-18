'use client';
/**
 * EmergencyCountdownModal — primary emergency UI
 *
 * Replaces the cosmetic AlertOverlay. Mounts unconditionally at the root level.
 * Shows: countdown timer, phrase text, severity indicator, cancel button.
 * Cancel is PIN-gated for urgent/medical severity.
 */
import { useEmergencyStore } from '@/store/emergencyStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useEffect, useRef, useState } from 'react';
import { cancelEmergencyVerified } from '@/services/emergencyService';
import { verifyPin } from '@/lib/pinCrypto';

export default function EmergencyCountdownModal() {
    const { phase, phrase, severity, countdown, reset } = useEmergencyStore();
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState(false);
    const [pinAttempts, setPinAttempts] = useState(0);
    const [pinLockedUntil, setPinLockedUntil] = useState(0);
    const isLocked = Date.now() < pinLockedUntil;

    // Timer to force re-render while locked so countdown display updates
    useEffect(() => {
        if (!isLocked) return;
        const id = setInterval(() => {
            if (Date.now() >= pinLockedUntil) clearInterval(id);
            else setPinAttempts(a => a); // force re-render
        }, 1000);
        return () => clearInterval(id);
    }, [isLocked, pinLockedUntil]);

    // Get caregiver PIN hash from settings
    const caregiverPinHash = useSettingsStore(s => s.caregiverPinHash);
    const requiresPin = (severity === 'urgent' || severity === 'medical') && !!caregiverPinHash;

    if (phase === 'idle' || phase === 'cancelled') return null;

    const handleCancel = async () => {
        if (isLocked) return;
        if (requiresPin) {
            const entered = pinInput.trim();
            const ok = entered ? await verifyPin(entered, caregiverPinHash!) : false;
            if (!ok) {
                const next = pinAttempts + 1;
                setPinAttempts(next);
                if (next >= 3) setPinLockedUntil(Date.now() + next * 10_000); // 30s, 40s, 50s...
                setPinError(true);
                setPinInput('');
                setTimeout(() => setPinError(false), 2000);
                return;
            }
        }
        // Use cancelEmergencyVerified — bypasses severity block after PIN confirmed
        cancelEmergencyVerified();
        setPinInput('');
    };

    const isCritical = severity === 'critical';
    const bgColor = isCritical ? '#dc2626' : severity === 'urgent' ? '#d97706' : severity === 'medical' ? '#2563eb' : '#2563eb';
    const urgencyLabel = isCritical ? '🚨 EMERGENCY' : severity === 'urgent' ? '⚠️ URGENT' : severity === 'medical' ? '🏥 MEDICAL' : '🆘 ALERT';

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-live="assertive"
            aria-label={`${urgencyLabel}: ${phrase}`}
            className="fixed inset-0 flex flex-col items-center justify-center p-6"
            style={{ zIndex: 999999, background: 'rgba(0,0,0,0.85)' }}
            onKeyDown={e => { if (e.key === 'Escape' && !isCritical) void handleCancel(); }}
            tabIndex={-1}
        >
            <div className="surface-bar rounded-2xl w-full max-w-[480px] text-center p-8" style={{ boxShadow: `0 0 0 6px ${bgColor}, 0 32px 64px rgba(0,0,0,0.5)` }}>
                {/* Severity badge */}
                <div className="text-sm font-bold tracking-wider mb-3" style={{ color: bgColor }}>
                    {urgencyLabel}
                </div>

                {/* Phrase */}
                <div className="text-2xl font-bold text-primary mb-5 leading-snug">
                    &ldquo;{phrase}&rdquo;
                </div>

                {/* Countdown ring */}
                {phase === 'countdown' && (
                    <div className="mb-6">
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl font-bold text-white mx-auto" style={{ background: bgColor, boxShadow: `0 0 0 4px ${bgColor}44` }}>
                            {countdown}
                        </div>
                        <div className="mt-2 text-sm text-muted">
                            {isCritical ? 'Sending emergency alert…' : 'Sending in seconds…'}
                        </div>
                    </div>
                )}

                {phase === 'dispatching' && (
                    <div className="mb-6 text-muted text-sm">
                        Sending alert to caregivers…
                    </div>
                )}

                {phase === 'dispatched' && (
                    <div className="mb-6">
                        <div className="text-4xl">✓</div>
                        <div className="text-[#16a34a] font-semibold">Alert sent</div>
                    </div>
                )}

                {/* PIN input for urgent/medical cancel */}
                {requiresPin && phase === 'countdown' && (
                    <div className="mb-4">
                        <div className="text-xs text-muted mb-2">
                            Caregiver PIN required to cancel
                        </div>
                        {isLocked && (
                            <div className="text-[#dc2626] text-xs mb-2">
                                Too many attempts — wait {Math.ceil((pinLockedUntil - Date.now()) / 1000)}s
                            </div>
                        )}
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            value={pinInput}
                            onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))}
                            onKeyDown={e => { if (e.key === 'Enter') void handleCancel(); }}
                            placeholder="Enter PIN"
                            disabled={isLocked}
                            className="border-2 border-theme rounded-lg px-3 py-2 text-lg text-center w-[120px] tracking-widest text-primary"
                            style={pinError ? { borderColor: '#dc2626' } : undefined}
                            autoFocus
                        />
                        {pinError && (
                            <div className="text-[#dc2626] text-xs mt-1">Incorrect PIN</div>
                        )}
                    </div>
                )}

                {/* Cancel / Dismiss buttons */}
                <div className="flex gap-3 justify-center">
                    {phase === 'countdown' && (
                        <button
                            onClick={() => { void handleCancel(); }}
                            disabled={isLocked}
                            className="aac-btn min-h-[52px] px-7 rounded-xl surface-key border-2 border-theme text-primary text-lg font-semibold disabled:opacity-50"
                        >
                            Cancel
                        </button>
                    )}
                    {phase === 'dispatched' && (
                        <button
                            onClick={() => reset()}
                            className="aac-btn min-h-[52px] px-7 rounded-xl bg-[#16a34a] text-white text-lg font-semibold"
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
