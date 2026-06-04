#!/usr/bin/env python3
"""Full App Store submission for Prism AAC via App Store Connect API.

Flow:
  1. Wait for build 1.4.1(1) to finish processing
  2. Create or update App Store Version 1.4.1
  3. Attach the uploaded build to that version
  4. Set release notes ("What's New")
  5. Submit for App Review

Requires: pyjwt + cryptography + requests (install in venv).
Run via: /tmp/asc-venv/bin/python scripts/submit-for-review.py
"""
import json, os, sys, time
from datetime import datetime, timedelta
from pathlib import Path
import jwt
import requests

KEY_ID    = os.environ.get("ASC_KEY_ID") or sys.exit("ASC_KEY_ID not set")
ISSUER_ID = os.environ.get("ASC_ISSUER_ID") or sys.exit("ASC_ISSUER_ID not set")
KEY_PATH  = Path(os.environ.get("ASC_KEY_PATH", str(Path.home() / "private_keys" / f"AuthKey_{KEY_ID}.p8")))
BUNDLE_ID = "ai.synalux.prism-aac"
TARGET_VERSION = "1.8.1"
TARGET_BUILD = "33"

WHATS_NEW = """• Apple Watch: mic dictation now opens in 1 tap (fixed 2-step bug)
• Caregiver Insights: 7 live monitoring widgets — prediction effectiveness, vocabulary adoption, communication topics, motor trend, tracking reliability, voice reliability, correction burden
• Background metrics: 5-min collector, 7-day history, zero impact on prediction speed
• SVG sparklines in caregiver dashboard (0 dependencies, ~2KB)
• Drift detection engine: BCBA clinical safety, coding quality, AAC monitoring
• 306 tests, zero failures"""

API = "https://api.appstoreconnect.apple.com/v1"

def make_token():
    """ES256 JWT for App Store Connect API auth."""
    key = KEY_PATH.read_text()
    now = int(time.time())
    return jwt.encode(
        {
            "iss": ISSUER_ID,
            "iat": now,
            "exp": now + 600,
            "aud": "appstoreconnect-v1",
        },
        key,
        algorithm="ES256",
        headers={"kid": KEY_ID, "typ": "JWT"},
    )

def session():
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {make_token()}",
                      "Content-Type": "application/json"})
    return s

def get_app_id(s):
    r = s.get(f"{API}/apps?filter[bundleId]={BUNDLE_ID}")
    r.raise_for_status()
    data = r.json()["data"]
    if not data:
        sys.exit(f"No app found with bundle id {BUNDLE_ID}")
    return data[0]["id"]

def wait_for_build(s, app_id, version, build_number, max_wait_s=900):
    """Poll until the build finishes processing (state=VALID)."""
    deadline = time.time() + max_wait_s
    while time.time() < deadline:
        r = s.get(f"{API}/builds?filter[app]={app_id}"
                  f"&filter[preReleaseVersion.version]={version}"
                  f"&filter[version]={build_number}"
                  "&include=preReleaseVersion&limit=1")
        r.raise_for_status()
        data = r.json()["data"]
        if data:
            b = data[0]
            state = b["attributes"]["processingState"]
            print(f"  build {version}({build_number}) state={state}", flush=True)
            if state == "VALID":
                return b["id"]
            if state == "FAILED" or state == "INVALID":
                sys.exit(f"Build failed processing: {state}")
        else:
            print(f"  build not yet visible…", flush=True)
        time.sleep(30)
    sys.exit("Timeout waiting for build to process")

def find_or_create_version(s, app_id, version):
    """Get existing draft version or create a new one for App Store."""
    r = s.get(f"{API}/apps/{app_id}/appStoreVersions"
              f"?filter[versionString]={version}&limit=1")
    r.raise_for_status()
    items = r.json()["data"]
    if items:
        v = items[0]
        state = v["attributes"]["appStoreState"]
        print(f"  existing version {version} state={state}")
        if state in ("PREPARE_FOR_SUBMISSION", "WAITING_FOR_REVIEW",
                     "DEVELOPER_REJECTED", "METADATA_REJECTED",
                     "REJECTED", "INVALID_BINARY", "READY_FOR_REVIEW"):
            return v["id"]
        # If already approved or in another state we can't edit, prompt manually
        print(f"⚠ version {version} state={state} — cannot resubmit via API")
        return v["id"]
    print(f"  creating new App Store version {version}")
    r = s.post(f"{API}/appStoreVersions", json={
        "data": {
            "type": "appStoreVersions",
            "attributes": {
                "platform": "IOS",
                "versionString": version,
                "releaseType": "AFTER_APPROVAL",
            },
            "relationships": {
                "app": {"data": {"type": "apps", "id": app_id}},
            }
        }
    })
    if r.status_code >= 300:
        print(r.text); r.raise_for_status()
    return r.json()["data"]["id"]

def set_whats_new(s, version_id, locale_code, text):
    """Set release notes for the given locale."""
    r = s.get(f"{API}/appStoreVersions/{version_id}/appStoreVersionLocalizations")
    r.raise_for_status()
    locs = r.json()["data"]
    target = next((l for l in locs if l["attributes"]["locale"] == locale_code), None)
    if target:
        loc_id = target["id"]
        r = s.patch(f"{API}/appStoreVersionLocalizations/{loc_id}", json={
            "data": {"type": "appStoreVersionLocalizations", "id": loc_id,
                     "attributes": {"whatsNew": text}}
        })
        if r.status_code >= 300:
            print(r.text); r.raise_for_status()
        print(f"  release notes set for {locale_code}")
    else:
        print(f"  no {locale_code} localization (skipping)")

def attach_build(s, version_id, build_id):
    r = s.patch(f"{API}/appStoreVersions/{version_id}/relationships/build", json={
        "data": {"type": "builds", "id": build_id}
    })
    if r.status_code >= 300:
        print(r.text); r.raise_for_status()
    print("  build attached")

def submit_for_review(s, app_id, version_id):
    # New API: create a reviewSubmission, attach the version as an item,
    # then PATCH submitted=true.
    print("  creating reviewSubmission…")
    r = s.post(f"{API}/reviewSubmissions", json={
        "data": {
            "type": "reviewSubmissions",
            "attributes": {"platform": "IOS"},
            "relationships": {
                "app": {"data": {"type": "apps", "id": app_id}}
            }
        }
    })
    if r.status_code == 409:
        # Already a pending submission for this app — find it
        print("  pending submission exists; looking up…")
        r2 = s.get(f"{API}/apps/{app_id}/reviewSubmissions"
                   "?filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES")
        r2.raise_for_status()
        existing = r2.json()["data"]
        if not existing:
            print(r.text); r.raise_for_status()
        sub_id = existing[0]["id"]
    else:
        if r.status_code >= 300:
            print(r.text); r.raise_for_status()
        sub_id = r.json()["data"]["id"]
    print(f"  reviewSubmission id={sub_id}")

    print("  adding version as submission item…")
    r = s.post(f"{API}/reviewSubmissionItems", json={
        "data": {
            "type": "reviewSubmissionItems",
            "relationships": {
                "reviewSubmission": {"data": {"type": "reviewSubmissions", "id": sub_id}},
                "appStoreVersion": {"data": {"type": "appStoreVersions", "id": version_id}},
            }
        }
    })
    if r.status_code >= 300 and r.status_code != 409:
        print(r.text); r.raise_for_status()

    print("  marking submission as submitted…")
    r = s.patch(f"{API}/reviewSubmissions/{sub_id}", json={
        "data": {
            "type": "reviewSubmissions",
            "id": sub_id,
            "attributes": {"submitted": True}
        }
    })
    if r.status_code >= 300:
        print(r.text); r.raise_for_status()
    print("  ✅ submitted for App Review")

def main():
    print(f"=== Prism AAC submit-for-review v{TARGET_VERSION}({TARGET_BUILD}) ===")
    s = session()
    app_id = get_app_id(s)
    print(f"App id: {app_id}")
    print("[1/5] Waiting for build to finish processing…")
    build_id = wait_for_build(s, app_id, TARGET_VERSION, TARGET_BUILD)
    print(f"  build_id={build_id}")
    print("[2/5] Finding/creating App Store version…")
    version_id = find_or_create_version(s, app_id, TARGET_VERSION)
    print(f"  version_id={version_id}")
    print("[3/5] Attaching build…")
    attach_build(s, version_id, build_id)
    print("[4/5] Setting What's New (en-US)…")
    set_whats_new(s, version_id, "en-US", WHATS_NEW)
    print("[5/5] Submitting for App Review…")
    submit_for_review(s, app_id, version_id)
    print()
    print(f"✅ DONE — track at https://appstoreconnect.apple.com/apps/{app_id}/appstore")

if __name__ == "__main__":
    main()
