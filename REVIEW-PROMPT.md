# External Review Prompt — PrismAAC

Use this prompt when submitting the repomix files for external code review. Attach the relevant repomix file(s) along with the prompt.

---

## Repomix Files

| File | Repo | Contents |
|------|------|----------|
| `repomix-compact.txt` (prism-aac-web) | Web app | Next.js 16, React 19, Tailwind, zustand, Supabase sync |
| `repomix-full.txt` (prism-aac-web) | Web app | Same but includes tests (145 tests, 9 files) |
| `repomix-compact.txt` (prism-aac) | Native app | Expo/React Native iOS/Android AAC app |
| `repomix-full.txt` (prism-aac) | Native app | Same but includes tests |
| `repomix-compact.txt` (prism) | Prism MCP | Memory/session management server (Supabase backend) |
| `repomix-full.txt` (prism) | Prism MCP | Same but includes all source |

---

## Review Prompt

```
You are reviewing PrismAAC — an evidence-based AAC (Augmentative and Alternative Communication) web application designed for a disabled child with motor impairments. This is a clinical communication tool, not a consumer app. The primary user depends on this app for daily communication.

The codebase consists of three interconnected repositories:

1. **prism-aac-web** (attached) — The web application (Next.js 16 + React 19)
2. **prism-aac** — The native iOS/Android app (Expo + React Native)
3. **prism** — The Prism MCP server (session memory, Supabase backend)

Please conduct a thorough review covering:

### 1. Clinical Safety (HIGHEST PRIORITY)
- Can the app ever restrict, reduce, or block the child's ability to communicate?
- Can a caregiver accidentally delete critical vocabulary?
- Are all configuration changes documented with audit trail?
- Does the app work fully offline (no network = no communication loss)?
- Are AI responses properly gated (never auto-inserted, always require confirmation)?
- Review against BACB Ethics Code 2.01 (effective treatment) and 2.09 (least restrictive)
- Review against ASHA position on AAC: communication is a fundamental right

### 2. Motor Accessibility
- Are all touch targets ≥44×44px (WCAG 2.5.5)? Ideally ≥25mm per Koester & Simpson (2012)?
- Is haptic feedback present on every interaction?
- Is there audio feedback confirming button presses?
- Does the visual feedback (scale/brighten) work even when the user's finger covers the button?
- Is there undo functionality for accidental actions?
- Does the long-press delete have adequate timeout and pointer-cancel handling?
- Does the app respect prefers-reduced-motion?

### 3. Evidence Base
- Review RESEARCH.md — are the 19 citations properly applied to the code?
- Is the Modified Fitzgerald Key color coding correctly implemented per Goossens' et al. (1992)?
- Does the prediction engine match Trnka & McCoy (2008) recommendations (3-5 slots)?
- Are prediction positions LAMP-stable per Light & Drager (2007)?
- Does the AI preserve authorship per Valencia et al. (CHI 2023)?

### 4. Architecture
- Is the Synalux API routing correct (tier-based model selection, offline fallback)?
- Is the Supabase sync architecture sound (local-first, merge conflict resolution)?
- Are there race conditions in the zustand stores?
- Is the localStorage usage bounded (prediction data pruning)?
- Is the hydration handled correctly (SSR → client rehydration)?

### 5. Code Quality
- TypeScript type safety — any `any` types or missing types?
- Error handling — are all async operations wrapped?
- Component structure — unnecessary re-renders, missing memoization?
- Test coverage — are the 145 tests covering the right things?
- Are there any security issues (XSS, injection, credential exposure)?

### 6. AAC-Specific UX
- Can the child use the keyboard and category panel simultaneously?
- Is the auto-space bug fixed (words no longer concatenate without spaces)?
- Do ordering sequences (restaurants) work as user-editable data, not hardcoded?
- Can caregivers add/remove phrases and categories?
- Are caregiver notes properly timestamped and attributed?
- Does the AI Chat respect the child's communication context?

### 7. Do No Harm Checklist
- [ ] Default vocabulary cannot be deleted
- [ ] Keyboard is always visible regardless of panel state
- [ ] All changes require explicit confirmation
- [ ] Undo is available for text operations
- [ ] App works fully offline
- [ ] No feature gates communication behind subscription
- [ ] Clinical documentation (caregiver notes) is persisted
- [ ] AI never auto-speaks or auto-inserts on behalf of the child

Report findings as:
- CRITICAL: Would harm the child or break communication
- HIGH: Significant usability or safety issue
- MEDIUM: Should fix before production
- LOW: Nice to have

Include specific file paths and line numbers for each finding.
```

---

## How to Use

### For a quick review (web app only):
```
Attach: prism-aac-web/repomix-compact.txt
Use the prompt above
```

### For a thorough review (web app + tests):
```
Attach: prism-aac-web/repomix-full.txt
Use the prompt above
```

### For a full platform review (all three repos):
```
Attach all three repomix-compact.txt files
Add to prompt: "Review the integration between all three repositories,
focusing on how AI routing, data sync, and authentication flow across
the platform."
```
