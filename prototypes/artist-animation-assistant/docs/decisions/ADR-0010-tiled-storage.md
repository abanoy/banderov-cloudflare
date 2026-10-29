# ADR-0010 — Packed tiles before artist-size live editing

Date 2026-10-20 23:39 EDT. Full master goal active; this is a storage increment.

Use immutable64x64RGBA8 bytes and content identities, sharing unchanged tiles across
versions and undo candidates. Use explicit JSON metadata plus hashed raw tile/source
assets, never pickle/extract. Central directory is budgeted before ZIP allocation;
tiles verify lazily, full verification explicit. Shared tile indices avoid repeating
64character hashes per drawing, motivated by actual near8MiB2048metadata. Retain
format1 reader; write format2. Preserve old JSON via save-as and exact semantic
roundtrip, not destructive in-place migration. Current host keeps legacy size guard.

This does not migrate live JSON fingerprinting, model/undo/jobs/renderer. Large
archives are deliberately refused by that old host before replacement, not silently
expanded or called supported editing. New live schema must preserve source identity
and old hash provenance, archive lifetime, Windows same-path atomic save, correction
locks, source alpha and rational holds. Native vectorized renderer may use justified
free runtime only after identity/license/component registration; current NumPy
research is not execution clearance or bundle audit. No artist artwork provided.
