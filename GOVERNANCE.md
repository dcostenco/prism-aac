# Project Governance

Prism AAC is a project of **Synalux** ([synalux.ai](https://synalux.ai)). This document describes how the project is governed and how decisions are made.

## Roles

### Maintainers
Maintainers have commit access and are responsible for reviewing PRs, releasing versions, and upholding the project's clinical and accessibility standards. The current maintainer is:

- **Dmitri Costenco** — Lead maintainer, Synalux

### Clinical Reviewers
Credentialed BCBAs and SLPs who review changes that affect AAC behavior, prediction logic, vocabulary, or ABA-aligned features. A clinical reviewer's approval is required for these changes to merge.

### Contributors
Anyone who has had a PR merged. Contributors do not have commit access by default.

## Decision-Making

For most changes, **lazy consensus** applies: a PR with at least one maintainer approval, no unresolved objections, and passing CI may merge after a 24-hour review window.

The following changes require **explicit consensus** from all active maintainers:

- License changes
- Changes to clinical-safety commitments listed in [README.md](README.md)
- Changes to default vocabulary that ship with the app
- Removal of supported languages
- Major architectural changes (data model, sync protocol, build pipeline)
- Changes to this governance document

Disagreements are resolved by discussion in the PR or a tracking issue. If consensus cannot be reached, the lead maintainer makes the final call and documents the rationale.

## Releases

- The project follows **semantic versioning** (`MAJOR.MINOR.PATCH`).
- Patch releases ship as needed for bug fixes and clinical-safety issues.
- Minor releases ship roughly monthly when there is meaningful new functionality.
- Major releases are rare and announced in advance.

## Roadmap

The public roadmap is maintained in GitHub Projects. Items are tagged by area: `aac`, `prediction`, `sync`, `ai-chat`, `accessibility`, `i18n`, `clinical`.

## Conflicts of Interest

Maintainers and clinical reviewers must disclose any commercial or clinical relationships that could influence their review of a contribution. Disclosure happens in the PR thread.

## Amending This Document

Changes to `GOVERNANCE.md` require explicit consensus from all active maintainers and a 7-day public comment window on the PR.

## Code of Conduct

All participation in project spaces is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Maintainers are responsible for enforcement.

## License

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).

The license was chosen so the project remains:
- Eligible for research and disability grants (OSI-approved open source)
- Sustainable as a hosted service via Synalux (Synalux retains copyright; offers free + paid subscription tiers)
- Resistant to closed-source SaaS forks (AGPL §13 requires modifications running on a server to be made available to remote users)

Synalux can dual-license the codebase to commercial users who cannot accept AGPL terms.
