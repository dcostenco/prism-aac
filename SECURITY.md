# Security Policy

Prism AAC is a clinical communication tool for children with complex communication needs. Security incidents can affect a child's ability to communicate, so we treat them as clinical-safety issues, not just engineering issues.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security reports.

Email: `security@synalux.ai`

Include:
- A description of the issue and the affected component (web app, sync API, AI chat, etc.)
- Steps to reproduce, or a proof-of-concept
- The version or commit hash you tested against
- Your assessment of impact (data exposure, denial-of-service, privilege escalation, clinical-safety risk)

We aim to:
- Acknowledge receipt within **2 business days**
- Provide an initial assessment within **5 business days**
- Ship a fix or mitigation for high-severity issues within **30 days**

## Scope

In scope:
- This repository's web application code
- The Supabase schema and policies under `supabase/` (if present)
- Build, sync, and AI-chat pipelines that ship with the app

Out of scope:
- Third-party services (Supabase, Vercel, model providers) — please report to the vendor
- Social-engineering or physical attacks against Synalux staff
- Issues requiring a rooted device or compromised local environment

## Supported Versions

Only the `main` branch and the latest tagged release receive security fixes. Older releases are not patched.

## Handling User Data

If you find a vulnerability that exposes user vocabulary, caregiver notes, sync tokens, or any child's communication history, mark the report **CLINICAL-SAFETY** in the subject line. These reports are escalated immediately.

## Disclosure

We follow coordinated disclosure. We will work with you on a public advisory once a fix is available, and we are happy to credit researchers who report responsibly.
