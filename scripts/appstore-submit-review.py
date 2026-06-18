#!/usr/bin/env python3
"""
appstore-submit-review.py — App Store Connect automated submission for review.

Flow
----
1. Generate ES256 JWT from the .p8 API key
2. Find the app by bundle ID
3. Find or create an App Store version in "Prepare for Submission" state
4. Wait for the uploaded build to finish processing (up to POLL_MAX_MINUTES)
5. Attach the build to the version
6. Set "What's New" text on the en-US localization (required before submit)
7. Create a reviewSubmissions entry and add the version as an item
   — uses the v1 reviewSubmissions API (replaces deprecated appStoreVersionSubmissions
     which returns 403 with App Manager keys)

Usage
-----
  python3 scripts/appstore-submit-review.py
  python3 scripts/appstore-submit-review.py --build-version 18
  python3 scripts/appstore-submit-review.py --dry-run   # prints plan, no writes

Requirements
------------
  pip install PyJWT cryptography   (already satisfied: jwt 2.12.1 detected)
"""

import sys
import os
import time
import json
import argparse
import urllib.request
import urllib.error
from pathlib import Path
from datetime import datetime, timezone

try:
    import jwt
except ImportError:
    sys.exit("ERROR: pip install PyJWT cryptography")

# ── Credentials ───────────────────────────────────────────────────────────────

KEY_ID      = os.environ.get("ASC_KEY_ID") or sys.exit("ASC_KEY_ID not set")
ISSUER_ID   = os.environ.get("ASC_ISSUER_ID") or sys.exit("ASC_ISSUER_ID not set")
BUNDLE_ID   = "ai.synalux.prism-aac"
KEY_PATH    = Path(os.environ.get("ASC_KEY_PATH", str(Path.home() / "private_keys" / f"AuthKey_{KEY_ID}.p8")))
BASE_URL    = "https://api.appstoreconnect.apple.com/v1"
TOKEN_TTL   = 1200  # 20 min max per ASC docs

# Marketing version matching our Info.plist
MARKETING_VERSION  = "1.8.5"
BUILD_VERSION      = "37"   # overridable via --build-version
PLATFORM           = "IOS"

# Sanctioned / restricted territories to exclude (OFAC + EU sanctions 2026)
EXCLUDED_TERRITORIES = {"CUB", "IRN", "PRK", "SYR"}

# Poll interval for build processing state
POLL_INTERVAL_SECS = 30
POLL_MAX_MINUTES   = 20

# What's New text shown on the App Store listing
WHATS_NEW_EN_US = (
    "Deep accessibility audit — 70 fixes:\n"
    "• Switch scanning — Bluetooth switch, gamepad, or keyboard support\n"
    "• Simplified keyboard — 15-key layout for severe motor impairment\n"
    "• Head tracking — repositioned PIP, toolbar scroll arrows, 800ms min dwell\n"
    "• Emergency — cancel for all severities, high contrast, 8-language support\n"
    "• System a11y — prefers-reduced-motion, prefers-contrast:more\n"
    "• iPhone landscape layout fix, iPad Split View support\n"
    "• 16 emergency words × 8 languages in crash recovery\n"
    "• Pinch-to-zoom enabled, ARIA landmarks, haptic differentiation"
)


# ── JWT ───────────────────────────────────────────────────────────────────────

def make_token() -> str:
    key_text = KEY_PATH.read_text()
    now = int(time.time())
    payload = {
        "iss": ISSUER_ID,
        "iat": now,
        "exp": now + TOKEN_TTL,
        "aud": "appstoreconnect-v1",
    }
    return jwt.encode(payload, key_text, algorithm="ES256",
                      headers={"kid": KEY_ID, "typ": "JWT"})


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def asc_request(method: str, path: str, body=None, token: str = "") -> dict:
    url = f"{BASE_URL}/{path.lstrip('/')}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept", "application/json")
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} {method} {url}\n{body_text}") from e


def asc_get(path: str, token: str) -> dict:
    return asc_request("GET", path, token=token)


def asc_post(path: str, body: dict, token: str) -> dict:
    return asc_request("POST", path, body=body, token=token)


def asc_patch(path: str, body: dict, token: str) -> dict:
    return asc_request("PATCH", path, body=body, token=token)


# ── Core steps ────────────────────────────────────────────────────────────────

def find_app(token: str) -> str:
    resp = asc_get(f"apps?filter[bundleId]={BUNDLE_ID}&fields[apps]=bundleId,name", token)
    apps = resp.get("data", [])
    if not apps:
        raise RuntimeError(f"App with bundle ID '{BUNDLE_ID}' not found in App Store Connect")
    app_id = apps[0]["id"]
    name   = apps[0]["attributes"].get("name", "?")
    print(f"  App: {name}  id={app_id}")
    return app_id


def find_or_create_version(app_id: str, token: str) -> str:
    """Return the id of an editable App Store version for MARKETING_VERSION.

    Priority order:
    1. Existing PREPARE_FOR_SUBMISSION draft for this version
    2. Any existing version record for MARKETING_VERSION (reuse it)
    3. Create a new version (only when MARKETING_VERSION has never been used)
    """
    # 1. Look for an existing draft
    resp = asc_get(
        f"apps/{app_id}/appStoreVersions"
        f"?filter[platform]={PLATFORM}"
        f"&filter[appStoreState]=PREPARE_FOR_SUBMISSION",
        token,
    )
    for v in resp.get("data", []):
        if v["attributes"]["versionString"] == MARKETING_VERSION:
            print(f"  Found existing draft {MARKETING_VERSION}  id={v['id']}")
            return v["id"]

    # 2. Look for any existing version record with this version string
    resp_all = asc_get(
        f"apps/{app_id}/appStoreVersions"
        f"?filter[platform]={PLATFORM}"
        f"&filter[versionString]={MARKETING_VERSION}",
        token,
    )
    for v in resp_all.get("data", []):
        state = v["attributes"]["appStoreState"]
        print(f"  Found existing version {MARKETING_VERSION} (state={state})  id={v['id']}")
        if state not in ("PREPARE_FOR_SUBMISSION",):
            print(f"  WARNING: version is in state {state} — it may not be editable")
        return v["id"]

    # 3. No existing record — create a new one
    print(f"  No version found — creating {MARKETING_VERSION}...")
    body = {
        "data": {
            "type": "appStoreVersions",
            "attributes": {
                "platform": PLATFORM,
                "versionString": MARKETING_VERSION,
            },
            "relationships": {
                "app": {"data": {"type": "apps", "id": app_id}},
            },
        }
    }
    resp = asc_post("appStoreVersions", body, token)
    v_id = resp["data"]["id"]
    print(f"  Created version {MARKETING_VERSION}  id={v_id}")
    return v_id


def wait_for_build(app_id: str, build_version: str, token: str) -> str:
    """Poll until the build finishes processing and return its id."""
    deadline = time.time() + POLL_MAX_MINUTES * 60
    print(f"  Waiting for build {build_version} to finish processing "
          f"(max {POLL_MAX_MINUTES} min)...")
    while time.time() < deadline:
        resp = asc_get(
            f"builds"
            f"?filter[app]={app_id}"
            f"&filter[version]={build_version}"
            f"&sort=-uploadedDate&limit=1",
            token,
        )
        builds = resp.get("data", [])
        if builds:
            b = builds[0]
            state = b["attributes"]["processingState"]
            b_id  = b["id"]
            print(f"    build id={b_id}  processingState={state}")
            if state == "VALID":
                print(f"  ✓ Build {build_version} is VALID  id={b_id}")
                return b_id
            elif state in ("INVALID", "FAILED"):
                raise RuntimeError(f"Build {build_version} processing failed: state={state}")
        time.sleep(POLL_INTERVAL_SECS)
    raise RuntimeError(f"Build {build_version} did not finish processing within {POLL_MAX_MINUTES} min")


def attach_build(version_id: str, build_id: str, token: str) -> None:
    path = f"appStoreVersions/{version_id}/relationships/build"
    body = {"data": {"type": "builds", "id": build_id}}
    asc_patch(path, body, token)
    print(f"  ✓ Build {build_id} attached to version {version_id}")


def set_whats_new(version_id: str, whats_new: str, token: str) -> None:
    """Set the What's New text on the en-US localization. Required before submit."""
    resp = asc_get(
        f"appStoreVersions/{version_id}/appStoreVersionLocalizations"
        f"?filter[locale]=en-US",
        token,
    )
    locs = resp.get("data", [])
    if not locs:
        print("  ⚠ No en-US localization found — skipping whatsNew")
        return
    loc_id = locs[0]["id"]
    existing = locs[0]["attributes"].get("whatsNew")
    if existing:
        print(f"  ✓ whatsNew already set (len={len(existing)}) — skipping update")
        return
    body = {
        "data": {
            "type": "appStoreVersionLocalizations",
            "id": loc_id,
            "attributes": {"whatsNew": whats_new},
        }
    }
    asc_patch(f"appStoreVersionLocalizations/{loc_id}", body, token)
    print(f"  ✓ whatsNew set on {loc_id} (len={len(whats_new)})")


def find_existing_review_submission(app_id: str, version_id: str, token: str) -> str | None:
    """Return the id of an open review submission that already contains this version."""
    resp = asc_get(
        f"apps/{app_id}/reviewSubmissions"
        f"?filter[platform]={PLATFORM}"
        f"&filter[state]=WAITING_FOR_REVIEW,READY_FOR_REVIEW,IN_REVIEW",
        token,
    )
    for sub in resp.get("data", []):
        sub_id = sub["id"]
        items = asc_get(f"reviewSubmissions/{sub_id}/items", token)
        for item in items.get("data", []):
            rel = item.get("relationships", {}).get("appStoreVersion", {}).get("data", {})
            if rel.get("id") == version_id:
                return sub_id
    return None


def submit_for_review(app_id: str, version_id: str, token: str) -> str:
    """
    Submit using the reviewSubmissions API (v1).

    Handles the case where the version is already in a review submission
    (e.g. READY_FOR_REVIEW from a prior run) — returns that submission id.
    """
    # Check if version is already in a review submission
    existing = find_existing_review_submission(app_id, version_id, token)
    if existing:
        print(f"  ✓ Version already in review submission  id={existing}")
        return existing

    # Step A: Create the reviewSubmission
    sub_body = {
        "data": {
            "type": "reviewSubmissions",
            "attributes": {"platform": PLATFORM},
            "relationships": {
                "app": {"data": {"type": "apps", "id": app_id}}
            },
        }
    }
    sub_resp = asc_post("reviewSubmissions", sub_body, token)
    sub_id = sub_resp["data"]["id"]
    print(f"  reviewSubmission created  id={sub_id}")

    # Step B: Add version as an item — transitions version to READY_FOR_REVIEW
    item_body = {
        "data": {
            "type": "reviewSubmissionItems",
            "relationships": {
                "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}},
            },
        }
    }
    try:
        item_resp = asc_post("reviewSubmissionItems", item_body, token)
        item_state = item_resp.get("data", {}).get("attributes", {}).get("state", "unknown")
        print(f"  ✓ Version added to review submission  item_state={item_state}")
    except RuntimeError as e:
        if "ITEM_PART_OF_ANOTHER_SUBMISSION" in str(e):
            print(f"  ✓ Version already queued for review (in another submission) — treating as success")
        else:
            raise
    return sub_id


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Submit Prism AAC to App Store review")
    parser.add_argument("--build-version", default=BUILD_VERSION,
                        help=f"Build number to attach (default: {BUILD_VERSION})")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print plan without making any writes to App Store Connect")
    args = parser.parse_args()

    if not KEY_PATH.exists():
        sys.exit(f"ERROR: API key not found at {KEY_PATH}")

    print(f"\n{'='*60}")
    print(f" Prism AAC {MARKETING_VERSION} (build {args.build_version}) — App Store submission")
    print(f" Bundle ID : {BUNDLE_ID}")
    print(f" Key       : {KEY_ID}  Issuer: {ISSUER_ID[:8]}…")
    print(f" Dry run   : {args.dry_run}")
    print(f"{'='*60}\n")

    token = make_token()

    print("[1/6] Finding app…")
    app_id = find_app(token)

    print("[2/6] Finding or creating App Store version…")
    if args.dry_run:
        print("  (dry-run: skipping version lookup/create)")
        version_id = "DRY_RUN_VERSION_ID"
    else:
        version_id = find_or_create_version(app_id, token)

    print(f"[3/6] Waiting for build {args.build_version} to be VALID…")
    if args.dry_run:
        print("  (dry-run: skipping build poll)")
        build_id = "DRY_RUN_BUILD_ID"
    else:
        build_id = wait_for_build(app_id, args.build_version, token)

    print("[4/6] Attaching build to version…")
    if not args.dry_run:
        attach_build(version_id, build_id, token)

    print("[5/6] Setting What's New text (required before submit)…")
    if not args.dry_run:
        set_whats_new(version_id, WHATS_NEW_EN_US, token)
    else:
        print(f"  (dry-run: would set whatsNew, len={len(WHATS_NEW_EN_US)})")

    print("[6/6] Submitting for review via reviewSubmissions API…")
    if not args.dry_run:
        submission_id = submit_for_review(app_id, version_id, token)
    else:
        print("  (dry-run: skipping reviewSubmissions POST)")
        submission_id = "DRY_RUN_SUBMISSION_ID"

    print(f"\n{'='*60}")
    if args.dry_run:
        print(" DRY RUN COMPLETE — no changes made")
    else:
        print(f" ✅  Submitted for review")
        print(f"     Version  : {MARKETING_VERSION} (build {args.build_version})")
        print(f"     Submission ID: {submission_id}")
        print(f"     Next: App Store Connect → My Apps → Prism AAC → Activity")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
