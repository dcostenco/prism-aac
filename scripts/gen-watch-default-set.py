#!/usr/bin/env python3
"""Generate the Watch's iOSDefaultSet Swift literal from constants/phrases.ts.

Run after editing constants/phrases.ts to keep the Watch in parity with iOS.
Output is pasted manually into
  ios-native/PrismAACWatch/Sources/AI/WatchVocabSync.swift
inside the `extension WatchCategory { … }` block.
"""
import re, sys
from collections import defaultdict
from pathlib import Path

PHRASES_TS = Path('/Users/admin/prism-aac/constants/phrases.ts')

# Per-category metadata (id → category SF symbol, display name, per-phrase symbol)
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

# Subcategory rollups — phrases tagged with a subcategory id get folded into parent
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

# Phrases that should render in emergency-red on the Watch
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

    out = []
    out.append('    /// iOS-parity default set — generated from constants/phrases.ts')
    out.append('    /// by scripts/gen-watch-default-set.py. Sync rule: when phrases.ts')
    out.append('    /// changes, re-run the generator and paste the output here.')
    out.append('    static let iOSDefaultSet: [WatchCategory] = [')
    for cat_id, (cat_icon, cat_name, default_sym) in TOP_CATS.items():
        items = rolled.get(cat_id, [])
        if not items: continue
        out.append(f'        WatchCategory(id: "{cat_id}", icon: "{cat_icon}", name: "{cat_name}", phrases: [')
        for pid, text in items:
            esc = text.replace('\\', '\\\\').replace('"', '\\"')
            is_em = "true" if pid in EMERGENCY_IDS else "false"
            out.append(f'            WatchPhrase(id: "{pid[:50]}", label: "{esc}", arasaacId: nil, sfSymbol: "{default_sym}", isEmergency: {is_em}),')
        out.append('        ]),')
    out.append('    ]')
    total = sum(len(v) for v in rolled.values())
    print(f'// generated: {total} phrases × {len(TOP_CATS)} categories', file=sys.stderr)
    print('\n'.join(out))

if __name__ == '__main__':
    main()
