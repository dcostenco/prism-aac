# Contributing to Prism AAC

Thanks for your interest in contributing. Prism AAC is an evidence-based communication tool, so contributions are reviewed against clinical, accessibility, and security criteria — not just code quality.

Before you start, please read [AGENTS.md](AGENTS.md), [README.md](README.md), and (if relevant) [RESEARCH.md](RESEARCH.md).

## Ground Rules

1. **Communication access is never gated.** No feature, paywall, error state, or onboarding step may prevent a user from typing or speaking output. PRs that violate this are rejected on sight.
2. **Default vocabulary is immutable.** Custom user additions can be removed; defaults cannot.
3. **Undo is always available.** Any destructive action must be reversible from the UI.
4. **Offline-first.** Features must work without a network unless they are explicitly online-only (AI chat, sync).
5. **AAC users are the primary stakeholder.** Caregivers and clinicians are secondary; engineers and designers are tertiary.

## Development Setup

```bash
git clone https://github.com/<org>/prism-aac.git
cd prism-aac
npm install
npm run dev
```

Run tests:

```bash
npm test          # vitest run
npm run lint      # eslint
```

This repo uses Next.js 16 with breaking changes from older versions. Read `node_modules/next/dist/docs/` before working on routing, server components, or build config.

## Branch & Commit Conventions

- Branch from `main`. Use prefixes: `feat/`, `fix/`, `docs/`, `chore/`, `refactor/`, `test/`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, etc.
- Keep commits focused. One logical change per commit.

## Pull Request Checklist

Before opening a PR:

- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] New behavior has a test (or an explicit note in the PR if it cannot be tested)
- [ ] No new dependency without justification in the PR description
- [ ] No secrets, tokens, or `.env` content in the diff
- [ ] Screenshots or screen recordings for UI changes
- [ ] Accessibility checked: keyboard navigation, focus rings, screen-reader labels, RTL languages, color contrast
- [ ] Clinical-impact note in the PR description if the change affects vocabulary, predictions, AAC behavior, or caregiver workflows

## Reviewing Clinical Changes

Changes that affect prediction logic, vocabulary, ABA-aligned behaviors, or AAC interaction patterns require sign-off from a credentialed BCBA or SLP. Tag `@clinical-review` in the PR.

## Reporting Security Issues

See [SECURITY.md](SECURITY.md). Do **not** file security issues as GitHub issues.

## Code of Conduct

Participation in this project is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By submitting a contribution, you agree that your contribution is licensed under the project's [LICENSE](LICENSE) (Business Source License 1.1).
