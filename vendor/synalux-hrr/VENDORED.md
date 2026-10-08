# Vendored package — do not edit by hand

Compiled `wasm-pack` output for `synalux-hrr` (HRR zero-search retrieval,
Apache-2.0). The Rust source of truth lives in a private repository; this copy exists so
`npm install` works from a plain clone of this repository.

Provenance: synalux_hrr_bg.wasm sha256
6b4205fdf01c3cd99b0d893dcca0865ff1ae6b6c1b12aac75f1bd6ca2a5826dd
(the private repo's build of 2026-08-12, sha256 1b54134f9bfc681061cc02d9cf415c4969bb1c2e62666bb03f0537d923d9960b,
with its 18 embedded build-machine path prefixes rewritten in place to `/build/cargo/`, the same
length: 180 bytes of panic-message text, no code. Original and rewritten builds gave identical
output on the same encode / probe / export / import calls).

To update: rebuild with `RUSTFLAGS="--remap-path-prefix=$HOME=/build" wasm-pack build --target web`
in the source repo (the flag keeps local paths out of the binary),
copy the build output here (drop its generated `.gitignore` — it contains `*` and
would silently unstage the whole package), and refresh the hash above.
The crate has changed twice since it was written; drift risk is low but
cannot be CI-checked from this repo, because public CI cannot see the
private source.
