#!/usr/bin/env python3
"""Submit Prism AAC 1.9.1 (build 54) for App Review.

Differs from scripts/submit-for-review.py, which targets 1.8.1 and only ever
sets en-US release notes:

  * What's New is written to EVERY localization on the version. Apple rejects
    the submission with a 409 if any listing locale is missing it.
  * The build attachment is read back and asserted. "Upload succeeded" does not
    mean "build selected on version" — a version can sit with no build attached
    and the submission silently describes nothing.
  * stdlib + cryptography only (ES256 signed as P1363, not DER — openssl's
    default DER encoding is accepted by the signer and rejected by Apple, which
    presents as an opaque 401).

Run with --dry-run first: it prints the state it would change and exits.
"""
import argparse, base64, json, sys, time, urllib.error, urllib.request
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

BUNDLE_ID = "ai.synalux.prism-aac"
TARGET_VERSION = "1.9.1"
TARGET_BUILD = "54"
API = "https://api.appstoreconnect.apple.com/v1"

WHATS_NEW = """Fixes and improvements:

• Hands-free control works again. Head tracking, eye gaze and camera switch access were unable to start; they now work as intended on iPhone and iPad.
• Creating a custom picture symbol with the camera works again.
• Stronger privacy in diagnostics: personal details are masked before any diagnostic report leaves the device."""


def _creds():
    """Key id and issuer from the environment only.

    Credentials are never read from a path baked into this file: it lives in a
    public repository, so even the location of a private credential store is
    not something to publish.
    """
    import os
    key_id = os.environ.get("ASC_KEY_ID")
    issuer = os.environ.get("ASC_ISSUER_ID")
    if not (key_id and issuer):
        sys.exit("set ASC_KEY_ID and ASC_ISSUER_ID (see ~/.zshenv), then re-run")
    return key_id, issuer


KEY_ID, ISSUER_ID = _creds()
KEY_PATH = Path.home() / "private_keys" / f"AuthKey_{KEY_ID}.p8"


def token():
    b64 = lambda d: base64.urlsafe_b64encode(d).rstrip(b"=")
    hdr = b64(json.dumps({"alg": "ES256", "kid": KEY_ID, "typ": "JWT"}).encode())
    now = int(time.time())
    pl = b64(json.dumps({"iss": ISSUER_ID, "iat": now, "exp": now + 1140,
                         "aud": "appstoreconnect-v1"}).encode())
    signing_input = hdr + b"." + pl
    key = serialization.load_pem_private_key(KEY_PATH.read_bytes(), password=None)
    r, s = decode_dss_signature(key.sign(signing_input, ec.ECDSA(hashes.SHA256())))
    sig = b64(r.to_bytes(32, "big") + s.to_bytes(32, "big"))
    return (signing_input + b"." + sig).decode()


TOKEN = token()


def call(method, path, body=None):
    url = path if path.startswith("http") else f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:600]
        raise SystemExit(f"{method} {path} -> {e.code}\n{detail}")


def app_id():
    d = call("GET", f"/apps?filter[bundleId]={BUNDLE_ID}")
    return d["data"][0]["id"]


def wait_for_build(app, dry):
    """Build 54 must exist and be VALID before it can be attached."""
    for attempt in range(60):
        d = call("GET", f"/builds?filter[app]={app}&filter[version]={TARGET_BUILD}&limit=1")
        if d["data"]:
            b = d["data"][0]
            state = b["attributes"]["processingState"]
            print(f"  build {TARGET_BUILD}: {state}")
            if state == "VALID":
                return b["id"]
            if state in ("INVALID", "FAILED"):
                sys.exit(f"build {TARGET_BUILD} is {state} — cannot submit")
        else:
            print(f"  build {TARGET_BUILD}: not visible yet")
        if dry:
            return None
        time.sleep(30)
    sys.exit("build did not become VALID within 30 minutes")


def find_or_create_version(app, dry):
    d = call("GET", f"/apps/{app}/appStoreVersions?filter[platform]=IOS&limit=20")
    for v in d["data"]:
        if v["attributes"]["versionString"] == TARGET_VERSION:
            print(f"  version {TARGET_VERSION} exists: {v['attributes']['appStoreState']}")
            return v["id"]
    print(f"  version {TARGET_VERSION} does not exist — would create")
    if dry:
        return None
    d = call("POST", "/appStoreVersions", {"data": {
        "type": "appStoreVersions",
        "attributes": {"platform": "IOS", "versionString": TARGET_VERSION,
                       "releaseType": "AFTER_APPROVAL"},
        "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})
    return d["data"]["id"]


def attach_and_verify(version_id, build_id, dry):
    if dry:
        cur = call("GET", f"/appStoreVersions/{version_id}/relationships/build") if version_id else {}
        print(f"  current build relationship: {(cur.get('data') or {}).get('id', 'none')}")
        return
    call("PATCH", f"/appStoreVersions/{version_id}/relationships/build",
         {"data": {"type": "builds", "id": build_id}})
    back = call("GET", f"/appStoreVersions/{version_id}/relationships/build")
    got = (back.get("data") or {}).get("id")
    if got != build_id:
        sys.exit(f"build attach NOT confirmed: wanted {build_id}, version reports {got}")
    print(f"  ✓ build attachment verified ({build_id})")


def set_whats_new_all_locales(version_id, dry):
    locs = call("GET", f"/appStoreVersions/{version_id}/appStoreVersionLocalizations?limit=50")
    print(f"  {len(locs['data'])} localizations on this version")
    for loc in locs["data"]:
        code = loc["attributes"]["locale"]
        existing = (loc["attributes"].get("whatsNew") or "").strip()
        if dry:
            print(f"    {code:<8} whatsNew={'set' if existing else 'EMPTY'}")
            continue
        call("PATCH", f"/appStoreVersionLocalizations/{loc['id']}", {"data": {
            "type": "appStoreVersionLocalizations", "id": loc["id"],
            "attributes": {"whatsNew": WHATS_NEW}}})
        print(f"    ✓ {code}")
    return [l["attributes"]["locale"] for l in locs["data"]]


def submit(app, version_id, dry):
    subs = call("GET", f"/reviewSubmissions?filter[app]={app}&limit=20")
    active = [s for s in subs["data"]
              if s["attributes"].get("state") not in ("COMPLETE", "CANCELING")]
    print(f"  active submissions: {len(active)}")
    if dry:
        print("  would: POST reviewSubmissions -> POST reviewSubmissionItems -> PATCH submitted=true")
        return
    sub_id = active[0]["id"] if active else call("POST", "/reviewSubmissions", {"data": {
        "type": "reviewSubmissions",
        "relationships": {"app": {"data": {"type": "apps", "id": app}}}}})["data"]["id"]
    print(f"  reviewSubmission {sub_id}")
    call("POST", "/reviewSubmissionItems", {"data": {
        "type": "reviewSubmissionItems",
        "relationships": {
            "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
            "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}}}}})
    print("  item added")
    # Without this PATCH the app sits in READY_FOR_REVIEW and never enters the queue.
    call("PATCH", f"/reviewSubmissions/{sub_id}", {"data": {
        "type": "reviewSubmissions", "id": sub_id, "attributes": {"submitted": True}}})
    print("  ✓ submitted=true")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    tag = "DRY RUN" if a.dry_run else "LIVE"
    print(f"=== Prism AAC {TARGET_VERSION} ({TARGET_BUILD}) — {tag} ===")
    print(f"auth: key {KEY_ID}, issuer {ISSUER_ID[:8]}…")
    app = app_id()
    print(f"app: {app}\n[1/5] build")
    build_id = wait_for_build(app, a.dry_run)
    print("[2/5] version")
    version_id = find_or_create_version(app, a.dry_run)
    print("[3/5] attach build")
    attach_and_verify(version_id, build_id, a.dry_run)
    print("[4/5] What's New (all locales)")
    if version_id:
        set_whats_new_all_locales(version_id, a.dry_run)
    else:
        print("  (version not created in dry run — locales unknown)")
    print("[5/5] submit")
    submit(app, version_id, a.dry_run)
    print(f"\n{'Nothing was changed.' if a.dry_run else 'Submitted.'} "
          f"https://appstoreconnect.apple.com/apps/{app}/appstore")


if __name__ == "__main__":
    main()
