/**
 * Google consent disclosure — contact-cap accuracy.
 *
 * The disclosure body is the text a caregiver reads before being sent to
 * Google's consent screen, and it is part of what Google reviews during
 * OAuth verification. It therefore has to describe what the app actually
 * retains.
 *
 * Regression: the copy said Prism AAC "may keep up to 200 Google-derived
 * contacts". MAX_CONTACTS is a SINGLE GLOBAL cap shared by manual contacts
 * and every connected provider — enforced against the combined list in
 * addContact (`s.contacts.length >= MAX_CONTACTS`), mergeFromIntegrations
 * (`merged.length >= MAX_CONTACTS`), setContacts and the persist validator.
 * There is no per-provider sub-quota and no Google reservation, so a
 * caregiver with 150 manual contacts can only ever sync 50 Google contacts.
 * The old wording framed a shared ceiling as a Google-specific allowance.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { MAX_CONTACTS, useContactsStore } from '../store/contactsStore';

const I18N_DIR = resolve(__dirname, '../i18n');
const KEY = 'google_oauth_disclosure_body';
/** Locales shipped when this guard was written. The count may grow, never shrink. */
const MIN_LOCALE_FILES = 28;

function localeFiles(): string[] {
    const files = readdirSync(I18N_DIR)
        .filter((f) => f.endsWith('.json') && f !== 'translations.json')
        .sort();
    // Fail loudly on an empty glob. Every per-locale assertion below runs
    // inside `for (const f of localeFiles())`, so a directory rename, a
    // broadened exclusion, or a typo'd extension filter would execute ZERO
    // expect() calls and Vitest would still report the suite green — a test
    // whose whole purpose is guarding 28 locale files silently guarding none.
    if (files.length < MIN_LOCALE_FILES) {
        throw new Error(
            `i18n locale glob returned ${files.length} file(s) (expected >= ${MIN_LOCALE_FILES}) — `
            + `the disclosure copy is NOT being checked. Fix the glob in ${__filename}, do not lower the floor.`,
        );
    }
    return files;
}

function bodyFor(file: string): string {
    const parsed = JSON.parse(readFileSync(resolve(I18N_DIR, file), 'utf8'));
    return parsed[KEY] ?? '';
}

describe('Google disclosure — contact retention cap', () => {
    beforeEach(() => {
        useContactsStore.setState({ contacts: [], lastSyncedAt: 0 });
    });

    // The premise the copy rests on, asserted BEHAVIORALLY by driving the real
    // store. An earlier version of this test grepped contactsStore.ts source for
    // `s.contacts.length >= MAX_CONTACTS`; a mutation to `MAX_CONTACTS + 50`
    // kept that substring intact and the test stayed green while the enforced
    // cap silently drifted away from the disclosed one. Source text is not
    // behavior — exercise the cap instead.
    it('CRITICAL — the cap is enforced globally, shared across manual and provider contacts', () => {
        const store = useContactsStore.getState();

        // Fill to the cap with MANUAL contacts only.
        for (let i = 0; i < MAX_CONTACTS; i++) {
            store.addContact({ name: `Manual ${i}`, provider: 'telegram', recipientId: `m-${i}` });
        }
        expect(useContactsStore.getState().contacts).toHaveLength(MAX_CONTACTS);

        // One more manual contact must be refused — the cap is real, and it is
        // exactly MAX_CONTACTS (this fails if enforcement drifts to +N).
        store.addContact({ name: 'Overflow', provider: 'telegram', recipientId: 'm-overflow' });
        expect(useContactsStore.getState().contacts).toHaveLength(MAX_CONTACTS);
        expect(
            useContactsStore.getState().contacts.some((c) => c.recipientId === 'm-overflow'),
        ).toBe(false);

        // With the cap already consumed by manual contacts, Google gets ZERO
        // slots — proving 200 is NOT a Google-specific allowance, which is the
        // exact claim the disclosure copy makes.
        useContactsStore.getState().mergeFromIntegrations(
            [{ name: 'Google Person', provider: 'mail', recipientId: 'g@example.com', sourceProvider: 'google' }],
            { authoritativeSources: [] },
        );
        const after = useContactsStore.getState().contacts;
        expect(after).toHaveLength(MAX_CONTACTS);
        expect(after.some((c) => c.sourceProvider === 'google')).toBe(false);
    });

    it('a half-full manual list leaves only the REMAINDER for Google, not a fresh 200', () => {
        const store = useContactsStore.getState();
        const manual = Math.floor(MAX_CONTACTS * 0.75); // 150 of 200
        for (let i = 0; i < manual; i++) {
            store.addContact({ name: `Manual ${i}`, provider: 'telegram', recipientId: `m-${i}` });
        }

        // Offer a FULL cap's worth of Google contacts.
        useContactsStore.getState().mergeFromIntegrations(
            Array.from({ length: MAX_CONTACTS }, (_, i) => ({
                name: `G ${i}`,
                provider: 'mail' as const,
                recipientId: `g-${i}@example.com`,
                sourceProvider: 'google' as const,
            })),
            { authoritativeSources: [] },
        );

        const contacts = useContactsStore.getState().contacts;
        const googleCount = contacts.filter((c) => c.sourceProvider === 'google').length;
        expect(contacts).toHaveLength(MAX_CONTACTS);
        // Only the leftover slots were available — NOT MAX_CONTACTS of them.
        expect(googleCount).toBe(MAX_CONTACTS - manual);
        expect(googleCount).toBeLessThan(MAX_CONTACTS);
    });

    it('actually covers every shipped locale (guards against a vacuous glob)', () => {
        const files = localeFiles();
        expect(files.length).toBeGreaterThanOrEqual(MIN_LOCALE_FILES);
        expect(files).toContain('en.json');
        // Every file must really carry the key — an empty/renamed key would
        // otherwise make bodyFor() return '' and the .not.toMatch assertions
        // below pass against an empty string.
        for (const f of files) {
            expect(bodyFor(f), `${f} is missing ${KEY}`).not.toBe('');
        }
    });

    it('declares no provider-scoped quota constant', () => {
        const store = readFileSync(resolve(__dirname, '../store/contactsStore.ts'), 'utf8');
        expect(store).not.toMatch(/MAX_GOOGLE_CONTACTS|GOOGLE_CONTACT_LIMIT|perProviderCap/);
    });

    it('CRITICAL — never frames the cap as a Google-specific allowance', () => {
        for (const file of localeFiles()) {
            expect(
                bodyFor(file),
                `${file} still promises a Google-specific contact allowance`,
            ).not.toMatch(/up to \d+ Google-derived contacts/i);
        }
    });

    it('states the cap is shared across manual and all provider contacts', () => {
        for (const file of localeFiles()) {
            const body = bodyFor(file);
            expect(body, `${file} omits the shared-cap qualifier`)
                .toMatch(/shared across manually entered contacts and every connected provider/i);
        }
    });

    it('quotes the cap number that the code actually enforces', () => {
        for (const file of localeFiles()) {
            expect(bodyFor(file), `${file} cap number drifted from MAX_CONTACTS`)
                .toContain(`${MAX_CONTACTS} contacts in total`);
        }
    });

    it('keeps the disconnect/removal promise intact', () => {
        // Unrelated to the cap, but this sentence is the other retention
        // promise in the same paragraph — guard it against collateral edits.
        for (const file of localeFiles()) {
            expect(bodyFor(file)).toMatch(/removed after a confirmed Google disconnect/i);
        }
    });

    it('applies the same correction to the aggregated translations file', () => {
        const raw = readFileSync(resolve(I18N_DIR, 'translations.json'), 'utf8');
        expect(raw).not.toMatch(/up to \d+ Google-derived contacts/i);
        expect(raw).toContain(`${MAX_CONTACTS} contacts in total`);
    });
});
