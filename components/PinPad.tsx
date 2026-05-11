'use client';
/**
 * PinPad — numeric PIN entry for caregiver authentication.
 * Used by SettingsModal to gate access to caregiver-only settings.
 */
import { useState, useEffect } from 'react';
import { hashPin, verifyPin } from '@/lib/pinCrypto';

const SESSION_KEY = 'prism-pin-lockout';

function getLockoutState(): { attempts: number; lockedUntil: number } {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (raw) return JSON.parse(raw);
    } catch {}
    return { attempts: 0, lockedUntil: 0 };
}
function saveLockoutState(s: { attempts: number; lockedUntil: number }) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
}

interface Props {
    onVerify: (verified: boolean) => void;
    pinHash: string; // SHA-256 hex hash
    onSetPin?: (newHash: string) => void; // for first-time setup
}

export default function PinPad({ onVerify, pinHash, onSetPin }: Props) {
    const [entered, setEntered] = useState('');
    const [error, setError] = useState(false);
    const [setupMode, setSetupMode] = useState(!pinHash && !!onSetPin);
    const [confirmPin, setConfirmPin] = useState('');
    const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
    const [lockState, setLockState] = useState(getLockoutState);
    const isLocked = Date.now() < lockState.lockedUntil;
    const lockSecondsLeft = Math.ceil((lockState.lockedUntil - Date.now()) / 1000);

    // Countdown interval: force re-render every second while locked so the
    // displayed countdown stays accurate and the UI unlocks automatically.
    useEffect(() => {
        if (!isLocked) return;
        const id = setInterval(() => {
            if (Date.now() >= lockState.lockedUntil) {
                clearInterval(id);
                setLockState(s => ({ ...s, lockedUntil: 0 })); // force re-render to unlock
            } else {
                setLockState(s => ({ ...s })); // force re-render to update seconds
            }
        }, 1000);
        return () => clearInterval(id);
    }, [isLocked, lockState.lockedUntil]);

    const press = (d: string) => {
        if (isLocked) return;
        if (entered.length >= 6) return;
        setEntered(p => p + d);
        setError(false);
    };

    const clear = () => setEntered(p => p.slice(0, -1));

    const submit = async () => {
        if (isLocked) return;
        if (setupMode) {
            if (setupStep === 'enter') {
                if (entered.length < 4) { setError(true); return; }
                setConfirmPin(entered);
                setEntered('');
                setSetupStep('confirm');
            } else {
                if (entered !== confirmPin) { setError(true); setEntered(''); setSetupStep('enter'); return; }
                const hash = await hashPin(entered);
                onSetPin?.(hash);
                onVerify(true);
            }
            return;
        }
        // Verify mode
        const ok = await verifyPin(entered, pinHash);
        if (ok) {
            onVerify(true);
        } else {
            // Brute-force protection: increment attempt count, persist across re-mounts
            const next = lockState.attempts + 1;
            const newState = {
                attempts: next,
                lockedUntil: next >= 5 ? Date.now() + next * 6_000 : 0,
            };
            saveLockoutState(newState);
            setLockState(newState);
            setError(true);
            setEntered('');
            setTimeout(() => setError(false), 1500);
        }
    };

    const digits = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#6b7280', textAlign: 'center' }}>
                {setupMode
                    ? setupStep === 'enter' ? 'Enter a 4–6 digit caregiver PIN' : 'Confirm your PIN'
                    : 'Enter caregiver PIN'}
            </div>

            {/* Dots */}
            <div style={{ display: 'flex', gap: '10px' }}>
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: i < entered.length ? (error ? '#dc2626' : '#2563eb') : '#e5e7eb',
                        transition: 'background 0.15s',
                    }} />
                ))}
            </div>

            {error && (
                <div style={{ color: '#dc2626', fontSize: '12px' }}>
                    {setupMode && setupStep === 'confirm' ? 'PINs do not match — try again' : 'Incorrect PIN'}
                </div>
            )}

            {isLocked && (
                <div style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center', padding: '8px' }}>
                    Too many attempts. Try again in {lockSecondsLeft}s.
                </div>
            )}

            {/* Keypad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {digits.flat().map((d, i) => (
                    <button key={i} type="button"
                        onClick={() => d === '⌫' ? clear() : d ? press(d) : undefined}
                        disabled={!d || isLocked}
                        style={{
                            width: '64px', height: '64px', borderRadius: '50%',
                            border: '1px solid #e5e7eb',
                            background: d ? '#f9fafb' : 'transparent',
                            fontSize: d === '⌫' ? '20px' : '22px',
                            fontWeight: 600, cursor: d && !isLocked ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: d ? (isLocked ? 0.5 : 1) : 0,
                        }}>
                        {d}
                    </button>
                ))}
            </div>

            <button
                type="button"
                onClick={() => { void submit(); }}
                disabled={entered.length < 4 || isLocked}
                style={{
                    padding: '12px 32px', borderRadius: '8px',
                    background: entered.length < 4 || isLocked ? '#e5e7eb' : '#2563eb',
                    color: entered.length < 4 || isLocked ? '#9ca3af' : '#fff',
                    border: 'none', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
                    width: '100%', marginTop: '4px',
                }}>
                {setupMode ? (setupStep === 'enter' ? 'Next' : 'Set PIN') : 'Unlock'}
            </button>

            {!setupMode && onSetPin && (
                <button type="button" onClick={() => { setSetupMode(true); setEntered(''); setSetupStep('enter'); }}
                    style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}>
                    Change PIN
                </button>
            )}
        </div>
    );
}
