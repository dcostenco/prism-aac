#!/usr/bin/env python3
"""Resolve ARASAAC pictogram IDs for every phrase in constants/phrases.ts.

Queries https://api.arasaac.org/v1/pictograms/en/search/<keyword> and writes
a {label → arasaacId} JSON map. Cached so re-runs are no-op after first
complete run. Used by `gen-watch-default-set.py` to populate the Watch's
iOSDefaultSet with proper pictogram IDs (instead of generic SF Symbols).
"""
import json, re, sys, time, urllib.parse
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from collections import defaultdict

PHRASES_TS = Path('/Users/admin/prism-aac/constants/phrases.ts')
CACHE = Path('/Users/admin/prism-aac/scripts/arasaac-id-cache.json')

# Same logic as the iOS pictogramService.ts pickHeadWord — try full phrase
# first, then fall back to a shorter "head word" if no match.
STOPWORDS = {'the','a','an','to','i','of','for','at','in','on','am','is','are','my','your','his','her'}
def head_word(s: str) -> str:
    # Strip punctuation, take first non-stopword (mirroring picture search heuristic).
    tokens = re.findall(r"[a-zA-Z']+", s.lower())
    for t in tokens:
        if t not in STOPWORDS and len(t) > 1:
            return t
    return tokens[0] if tokens else s.lower()

def fetch_one(keyword: str) -> int | None:
    url = f"https://api.arasaac.org/v1/pictograms/en/search/{urllib.parse.quote(keyword)}"
    req = Request(url, headers={'User-Agent': 'prism-aac-watch/1.0'})
    try:
        with urlopen(req, timeout=8) as r:
            data = json.loads(r.read())
            if isinstance(data, list) and data:
                # First match is the highest-scoring by ARASAAC's relevance.
                return int(data[0].get('_id', 0)) or None
            return None
    except HTTPError as e:
        if e.code == 404: return None
        print(f"[{keyword}] HTTP {e.code}", file=sys.stderr)
        return None
    except (URLError, json.JSONDecodeError, ValueError) as e:
        print(f"[{keyword}] {e}", file=sys.stderr)
        return None

def main():
    c = PHRASES_TS.read_text()
    pattern = re.compile(r"p\('([^']+)', '([^']+)', '((?:[^'\\]|\\.)*)', \s*\d+\)")
    labels = []
    seen = set()
    for m in pattern.finditer(c):
        text = m.group(3).replace("\\'", "'")
        if text not in seen:
            seen.add(text)
            labels.append(text)
    print(f"unique labels: {len(labels)}", file=sys.stderr)

    cache: dict[str, int | None] = {}
    if CACHE.exists():
        cache = json.loads(CACHE.read_text())
        print(f"cache hits already: {len(cache)}", file=sys.stderr)

    n_fetch = 0
    for i, label in enumerate(labels):
        if label in cache: continue
        # Try full phrase first, then head word
        aid = fetch_one(label)
        if aid is None:
            head = head_word(label)
            if head != label.lower():
                time.sleep(0.15)
                aid = fetch_one(head)
        cache[label] = aid
        n_fetch += 1
        if n_fetch % 25 == 0:
            CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
            print(f"  ... {n_fetch} fetched, {sum(1 for v in cache.values() if v)} hits", file=sys.stderr)
        time.sleep(0.15)   # ~6 req/sec, polite

    CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0))
    hits = sum(1 for v in cache.values() if v)
    print(f"done — {hits}/{len(cache)} resolved ({100*hits//len(cache)}%)", file=sys.stderr)

if __name__ == '__main__':
    main()
