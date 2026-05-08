# Math-panel keyboard coverage — workflow gap analysis

This is the gap list for `tests/workflows/*.md`. Each subject
workflow declares the math-panel keys it expects (the
`<!-- expected math-panel keys: ... -->` HTML comment in the file).
The "Keys missing" column is what the kbd commit `dbd23a1` does NOT
expose on its dedicated chip — they're either reachable via fallback
to `main` / `adv-math` / `letters`, or not at all.

The Playwright workflow specs at `e2e/math-workflows/*.spec.ts` use
the same gap list to `test.skip()` instead of failing when a glyph
isn't reachable. Filling these gaps later (without breaking existing
muscle memory) is what the spec coverage drives.

| Subject | Keys needed | Keys present on dedicated chip | Keys missing on dedicated chip (reachable via fallback) | Truly unreachable |
|---|---|---|---|---|
| algebra (reference) | `0-9 + − × ÷ = . , ( ) x y a b ²` | all on `main` + `adv-math` | — | — |
| geometry | `0-9 + − × ÷ = . a b c h l w r ² √ π °` | `geom`: `°`, `r`, `d`, `A`, `V`, `P`, `π` | `²`, `√`, `≈`, lowercase `a b c h l w` (fallback to `adv-math` / `letters`) | none |
| physics | `0-9 + − × ÷ = . v u a t f i d k m s kg N J V W Ω` | `physics-units`: `m s kg A K mol N J W V Ω Hz Pa T C eV` | uppercase variables `F P I E V` overlap with units (`V` = volt OK; `F P I E` not on physics) | none — variables substituted with lowercase letters in workflow |
| chemistry | `0-9 + − × ÷ = . H O C N Na Cl ₂ ₃ ₄ → mol n g m` | `chemistry-elements`: H O C N Na Cl + 18 more; `chemistry-ops`: `→ ₂ ₃ ₄ mol pH (s) (l) (g) (aq) ⁺ ⁻ ²⁺ ²⁻ Δ ⇌ ↑ ↓ + · ` | lowercase var fallback to `letters` | none |
| biology | `0-9 + − × ÷ = . AA Aa aa Bb bb A T G C U DNA RNA → b c d r h n` | `biology-genetics`: AA Aa aa BB Bb bb F1 F2 P × ♂ ♀; `biology-nucleotides`: A T G C U DNA RNA mRNA tRNA rRNA → ⇒ | lowercase variables fallback to `letters` | none |
| statistics | `0-9 + − × ÷ = . n μ σ z x α p H0 Ha < ≈ ≠ s` | `stats-params`: μ σ σ² ρ x̄ s s² r n N p̂ p; `stats-dist`: 𝒩 z t χ² F df α β p-value ≈ ≠ ∼; `stats-ops`: Σ ∏ P( E[ Var[ SE CI H0 Ha ! C( | `<` not on stats; falls back to `adv-math`. Lowercase Latin letters fall back to `letters` (e.g. `r`, `e`, `j`, `c`, `t` for "reject") | none |
| programming-python | `a-z 0-9 _ + − * / = == ( ) [ ] { } : , . " ' for if else def return print range len` | full 26 letters + 10 digits + `_` + 24 ops + 28 keyword shortcut tiles | `−` (minus sign) NOT on prog kb (the prog kb has plain `-`); workflow uses `*` and `/` instead of `×` `÷` | none — workflow already uses ASCII operators |
| programming-java | `a-z 0-9 _ + − * / = == ( ) [ ] { } : ; , . " ' public class void int String for if else return new` | full 26 letters + 10 digits + `_` + 24 ops + 28 keyword shortcut tiles | same as Python — `−` not on prog kb; workflow uses `-` | none |
| advanced-math | `0-9 + − × ÷ = . x y a b ² ³ √ ± log ln e π ( )` | `adv-math`: ( ) < > ≤ ≥ ≠ % π x y a b √ ² ³ ∛ _ . , d p r m n ± ≈ ≡ \| ! log ln | `e` (Euler) NOT a dedicated key — falls back to `letters`; `−` is on `main` (`÷` too) | none |
| misc-math | `0-9 + − × ÷ = . x y a b s f g ∈ ∪ ∩ ⊂ ∅ ≠ ≈ ( )` | `misc-math`: ∈ ∉ ⊂ ⊆ ∪ ∩ ∅ ∀ ∃ ¬ ∧ ∨ ∞ ∂ ∇ ∝ ≡ ≅ ≈ ± ∓ [ ] { } : / ∴ ∵ ⊥ ∥ ⇒ ⇔ | lowercase var letters fall back to `letters`; `+ − = .` fall back to `main` | none |
| earth-science | `0-9 + − × ÷ = . AU ly Mya km °C mph s e d r y t a` | `earth-units`: AU ly pc Mya Gya km mb °C °F mph; `earth-plates`: → ← ↑ ↓ ⇄ ⊕ ⊖; `earth-weather`: ☀ ☁ ☂ ❄ ⚡ ☈ ☄ 🌫 🌪 🌊; `earth-astro`: ☉ ☾ ⊕ + planets | lowercase variables fall back to `letters` | none |
| language-arts | `N V ADJ ADV PRON PREP CONJ ART AUX DET DECL INT IMP EXCL COMP CPLX = . , ! ?` | `la-pos`: N V ADJ ADV PRON PREP CONJ ART INTJ AUX DET NUM; `la-sentence`: DECL INT IMP EXCL COMP CPLX; `la-punct`: . , ; : ! ? ' " ( ) – — … | `=` falls back to `main`; lowercase letters fall back to `letters` (e.g. typing the words being tagged) | none |
| history | `0-9 + − × ÷ = . BCE CE BC AD c. – 1st 5th 17th 19th 20th 21st a y c e s` | `hist-eras`: BCE CE BC AD c. fl. – → ↦; `hist-centuries`: 1st 2nd 3rd 4th 5th 10th 15th 17th 18th 19th 20th 21st; `hist-periods` + `hist-events` (locale-aware) | lowercase var letters fall back to `letters`; digits & ops fall back to `main` | none |

## Most under-supported subjects

Ranked by how often the workflow needs to leave its dedicated chip:

1. **language-arts** — every workflow types lowercase words to label, requiring a chip-flip to `letters` per word. Adding a "lowercase identifier" mini-row to the language-arts chip would cut ~12 chip-flips per problem.

2. **earth-science** — variables (`d`, `y`, `t`, `s`, `e`) all live on `letters`. Earth-science chip is units + arrows only. A small variable-letter row would help.

3. **history** — same pattern as earth-science: ordinals + eras are on the chip, but the variable LHS (`y =`, `s =`, `e =`) is not.

4. **biology** — workflows need lowercase variables (b, c, d, r, h, n) plus the genetics tiles. No big gap, but a 2-row variables strip would localise the workflow to one chip.

5. **physics** — uppercase variable letters (`F`, `P`, `I`, `E`) are not on the physics chip. The workflows here side-step by using lowercase Latin (which fallback to `letters`), but a teacher writing "F = ma" by hand would expect `F` on the physics chip itself.

## Subjects that are well-supported

- **chemistry** — every glyph used by the workflow is reachable on `chemistry-elements` or `chemistry-ops`. Zero fallback needed except for free-text variables.
- **misc-math** — set-theory glyphs are all on the chip.
- **adv-math** — quadratic formula, log/ln, square root, ², ³, ± all single-chip.
- **statistics** — μ, σ, z, p, α, H0, Ha, ≈, ≠ all on `statistics`.

## Truly missing keys (none reach via fallback)

None across the 12 subjects as currently defined. Every glyph in
every workflow resolves either on its dedicated chip OR falls back to
`main` / `adv-math` / `letters`. The "missing on dedicated chip"
column above is therefore an ergonomics list, not a correctness list
— the workflow specs PASS without modifying the keyboard arrays.
