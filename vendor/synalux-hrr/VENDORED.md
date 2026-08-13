# Vendored package — do not edit by hand

Compiled `wasm-pack` output for `synalux-hrr` (HRR zero-search retrieval,
Apache-2.0). The Rust source of truth lives in the private platform repo at
`packages/hrr-wasm/`; this copy exists so `npm install` works from a plain
clone of this repository.

Provenance: synalux_hrr_bg.wasm sha256
1b54134f9bfc681061cc02d9cf415c4969bb1c2e62666bb03f0537d923d9960b
(identical to the private repo's pkg-web build, 2026-08-12).

To update: rebuild with `wasm-pack build --target web` in the source repo,
copy `pkg-web/` here (drop its generated `.gitignore` — it contains `*` and
would silently unstage the whole package), and refresh the hash above.
The crate has changed twice since it was written; drift risk is low but
cannot be CI-checked from this repo, because public CI cannot see the
private source.
