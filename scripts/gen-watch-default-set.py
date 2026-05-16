#!/usr/bin/env python3
"""Generate the Watch's iOSDefaultSet Swift literal from constants/phrases.ts.

Per-phrase arasaacId values come from scripts/arasaac-id-cache.json,
populated by scripts/fetch-arasaac-ids.py. Phrases without a resolved
arasaacId fall back to the per-category SF Symbol.

Run after editing constants/phrases.ts to keep the Watch in parity with iOS.
"""
import json, re, sys
from collections import defaultdict
from pathlib import Path

PHRASES_TS = Path('/Users/admin/prism-aac/constants/phrases.ts')
ARASAAC_CACHE = Path('/Users/admin/prism-aac/scripts/arasaac-id-cache.json')

TOP_CATS = {
    'core-pronouns':     ('person.2.fill',                    'I / You / We',     'person.fill'),
    'core-verbs':        ('bolt.fill',                        'Core Verbs',       'bolt'),
    'core-descriptors':  ('ruler.fill',                       'More / Not / All', 'arrow.up.and.down'),
    'core-little-words': ('link',                             'Little Words',     'textformat'),
    'help-needs':        ('sos',                              'Help / Needs',     'exclamationmark.triangle'),
    'quick-talk':        ('bubble.left.and.bubble.right.fill','Quick Talk',       'bubble.left'),
    'feelings':          ('face.smiling',                     'Feelings',         'face.smiling'),
    'questions':         ('questionmark.circle.fill',         'Questions',        'questionmark.circle'),
    'actions':           ('figure.run',                       'Actions',          'figure.walk'),
    'describing':        ('paintpalette.fill',                'Describing Words', 'paintpalette'),
    'people-social':     ('person.3.fill',                    'People',           'person.fill'),
    'food-ordering':     ('fork.knife',                       'Food & Drink',     'fork.knife'),
    'places-plans':      ('mappin.and.ellipse',               'Places',           'mappin.circle'),
    'school-work':       ('book.fill',                        'School / Work',    'book'),
    'health-body':       ('cross.case.fill',                  'Health / Body',    'cross'),
    'time':              ('clock.fill',                       'Time',             'clock'),
    'animals':           ('pawprint.fill',                    'Animals',          'pawprint'),
    'colors':            ('paintpalette',                     'Colors',           'circle.fill'),
    'clothes':           ('tshirt.fill',                      'Clothes',          'tshirt'),
    'transport':         ('car.fill',                         'Transportation',   'car'),
    'weather':           ('cloud.sun.fill',                   'Weather',          'cloud'),
    'toys-fun':          ('gamecontroller.fill',              'Toys & Fun',       'gamecontroller'),
}

SUB_TO_PARENT = {
    'time-clock': 'time', 'time-days': 'time', 'time-months': 'time',
    'time-dates': 'time', 'time-seasons': 'time',
    'food-meals': 'food-ordering', 'food-fruits': 'food-ordering',
    'food-veggies': 'food-ordering', 'food-snacks': 'food-ordering',
    'food-drinks': 'food-ordering', 'food-sweets': 'food-ordering',
    'people-family': 'people-social', 'people-school': 'people-social',
    'people-community': 'people-social',
    'health-body-parts': 'health-body', 'health-feelings': 'health-body',
    'health-medicines': 'health-body', 'health-routines': 'health-body',
    'animals-pets': 'animals', 'animals-farm': 'animals',
    'animals-wild': 'animals', 'animals-birds': 'animals', 'animals-sea': 'animals',
    'places-school': 'places-plans', 'places-home': 'places-plans',
    'places-outside': 'places-plans', 'places-stores': 'places-plans',
    'places-medical': 'places-plans',
}

EMERGENCY_IDS = {'cw-help', 'cw-hurt', 'help-need-help', 'help-call911'}

def main():
    c = PHRASES_TS.read_text()
    pattern = re.compile(r"p\('([^']+)', '([^']+)', '((?:[^'\\]|\\.)*)', \s*\d+\)")
    by_cat = defaultdict(list)
    for m in pattern.finditer(c):
        pid, cat, text = m.group(1), m.group(2), m.group(3).replace("\\'", "'")
        by_cat[cat].append((pid, text))

    rolled = defaultdict(list)
    for cat, items in by_cat.items():
        rolled[SUB_TO_PARENT.get(cat, cat)].extend(items)

    arasaac_ids: dict[str, int | None] = {}
    if ARASAAC_CACHE.exists():
        arasaac_ids = json.loads(ARASAAC_CACHE.read_text())

    out = []
    out.append('    /// iOS-parity default set — generated from constants/phrases.ts')
    out.append('    /// by scripts/gen-watch-default-set.py with arasaacId lookups from')
    out.append('    /// scripts/arasaac-id-cache.json. Sync rule: when phrases.ts changes,')
    out.append('    /// re-run fetch-arasaac-ids.py + gen-watch-default-set.py.')
    out.append('    static let iOSDefaultSet: [WatchCategory] = [')
    n_with_id = 0
    n_total = 0
    for cat_id, (cat_icon, cat_name, default_sym) in TOP_CATS.items():
        items = rolled.get(cat_id, [])
        if not items: continue
        out.append(f'        WatchCategory(id: "{cat_id}", icon: "{cat_icon}", name: "{cat_name}", phrases: [')
        for pid, text in items:
            n_total += 1
            esc = text.replace('\\', '\\\\').replace('"', '\\"')
            is_em = "true" if pid in EMERGENCY_IDS else "false"
            aid = arasaac_ids.get(text)
            aid_swift = f'{aid}' if isinstance(aid, int) and aid > 0 else 'nil'
            if aid_swift != 'nil':
                n_with_id += 1
            out.append(f'            WatchPhrase(id: "{pid[:50]}", label: "{esc}", arasaacId: {aid_swift}, sfSymbol: "{default_sym}", isEmergency: {is_em}),')
        out.append('        ]),')
    out.append('    ]')
    print(f'// {n_with_id}/{n_total} phrases have arasaacId ({100*n_with_id//n_total if n_total else 0}%)', file=sys.stderr)
    print('\n'.join(out))

if __name__ == '__main__':
    main()
