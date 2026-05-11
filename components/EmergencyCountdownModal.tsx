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
            style={{
                position: 'fixed', inset: 0, zIndex: 999999,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.85)',
                padding: '24px',
            }}
        >
            <div style={{
                background: '#fff', borderRadius: '16px', padding: '32px 24px',
                maxWidth: '480px', width: '100%', textAlign: 'center',
                boxShadow: `0 0 0 6px ${bgColor}, 0 32px 64px rgba(0,0,0,0.5)`,
            }}>
                {/* Severity badge */}
                <div style={{ fontSize: '14px', fontWeight: 700, color: bgColor, letterSpacing: '0.1em', marginBottom: '12px' }}>
                    {urgencyLabel}
                </div>

                {/* Phrase */}
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#111', marginBottom: '20px', lineHeight: 1.3 }}>
                    &ldquo;{phrase}&rdquo;
                </div>

                {/* Countdown ring */}
                {phase === 'countdown' && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{
                            width: '80px', height: '80px', borderRadius: '50%',
                            background: bgColor, color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '36px', fontWeight: 700, margin: '0 auto',
                            boxShadow: `0 0 0 4px ${bgColor}44`,
                        }}>
                            {countdown}
                        </div>
                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#666' }}>
                            {isCritical ? 'Sending emergency alert…' : 'Sending in seconds…'}
                        </div>
                    </div>
                )}

                {phase === 'dispatching' && (
                    <div style={{ marginBottom: '24px', color: '#666', fontSize: '14px' }}>
                        Sending alert to caregivers…
                    </div>
                )}

                {phase === 'dispatched' && (
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '32px' }}>✓</div>
                        <div style={{ color: '#16a34a', fontWeight: 600 }}>Alert sent</div>
                    </div>
                )}

                {/* PIN input for urgent/medical cancel */}
                {requiresPin && phase === 'countdown' && (
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                            Caregiver PIN required to cancel
                        </div>
                        {isLocked && (
                            <div style={{ color: '#dc2626', fontSize: '12px', marginBottom: '8px' }}>
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
                            style={{
                                border: `2px solid ${pinError ? '#dc2626' : '#d1d5db'}`,
                                borderRadius: '8px', padding: '8px 12px',
                                fontSize: '18px', textAlign: 'center', width: '120px',
                                letterSpacing: '0.2em',
                            }}
                        />
                        {pinError && (
                            <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>Incorrect PIN</div>
                        )}
                    </div>
                )}

                {/* Cancel / Dismiss buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    {!isCritical && phase === 'countdown' && (
                        <button
                            onClick={() => { void handleCancel(); }}
                            disabled={isLocked}
                            style={{
                                padding: '12px 28px', borderRadius: '10px',
                                background: '#f3f4f6', border: '2px solid #d1d5db',
                                fontSize: '16px', fontWeight: 600, cursor: isLocked ? 'not-allowed' : 'pointer', color: '#374151',
                                opacity: isLocked ? 0.5 : 1,
                            }}
                        >
                            Cancel
                        </button>
                    )}
                    {phase === 'dispatched' && (
                        <button
                            onClick={() => reset()}
                            style={{
                                padding: '12px 28px', borderRadius: '10px',
                                background: '#16a34a', border: 'none',
                                fontSize: '16px', fontWeight: 600, cursor: 'pointer', color: '#fff',
                            }}
                        >
                            Done
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
