'use client';
/**
 * PIN hashing utilities using SubtleCrypto (SHA-256 + per-device salt).
 * The salt is stored in localStorage — separate from the hash.
 * Even with the hash, an attacker needs the salt to verify a PIN.
 */

const SALT_KEY = 'prism-aac-pin-salt';

function getOrCreateSalt(): string {
    let salt = localStorage.getItem(SALT_KEY);
    if (!salt) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        salt = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(SALT_KEY, salt);
    }
    return salt;
}

export async function hashPin(pin: string): Promise<string> {
    const salt = getOrCreateSalt();
    const data = new TextEncoder().encode(pin + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(entered: string, storedHash: string): Promise<boolean> {
    const computed = await hashPin(entered);
    // Constant-time compare (both are hex strings of equal length)
    if (computed.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
        diff |= computed.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return diff === 0;
}

/** Legacy: detect and migrate btoa-encoded PINs from old versions */
export function isLegacyBtoaHash(hash: string): boolean {
    // btoa('1234') = 'MTIzNA==' — base64 pattern, not hex
    return /^[A-Za-z0-9+/]+=*$/.test(hash) && !(/^[0-9a-f]+$/i.test(hash));
}
