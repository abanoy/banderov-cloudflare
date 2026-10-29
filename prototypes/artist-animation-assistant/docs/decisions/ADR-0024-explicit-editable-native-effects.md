# ADR0024 — Explicit editable native effects

Status: experimental API/CLI retained; 2026-10-21 18:25 EDT.

Choose an independent bounded effect renderer and editable settings with source binding. Keeping only raw pixels preserves bytes but loses appearance; a flattened cached canvas loses layers/parameter editing. Preserve both original source data and separate parameterized effect preview. Keep current strict importer and normal host RAW behavior until background integration and sufficient fidelity evidence.

Updated 2026-10-21 18:25 EDT. Full master and all twenty requirements remain ACTIVE.

EXP0028 adds independent explicit native effect parameter compilation/rendering in
engine/native_effects.py, scripts/preview_native_effects.py and nine focused tests.
Session validates attached parameters and provides set_native_effects with revision,
undo/redo and direct/ancestor layer-lock protection. Exact native ASL/source keys and
original planes remain immutable. Effects are stored as editable JSON parameters;
they are recomputed from current corrected pixels and retained native off-canvas
alpha, not baked into original raster layers. No external archive is opened to render.
Parameters bind the retained native source manifest; altered source/settings schemas
refuse. Rendering is explicit API/CLI only: normal host packed renderer still RAW.
Opening an effects .aaa in the normal editor does NOT display the styled preview.

Supported experimental subset: native100percent scale, linear contour, soft solid-RGB
drop shadow/edge-source inner glow/outer glow, normal/multiply/linear-dodge blends,
zero spread/noise/jitter,100percent range. Strict native styles default still refuse.
Unsupported masks, gradients, nonlinear contours and unknown enabled settings refuse.
Finite Gaussian uses native radius convention and independent separable block FFT
with zero extension; the inverted source uses complement convolution to avoid
artificial edge glow. Padded exact native keys retain off-canvas contribution; the
current retained-plane4096px bound includes the halo and refuses oversize previews.
No silently enlarged host budgets, profile conversion, default importer fallback or
general native fidelity claim. Cancellation checkpoints run between blocks/layers/tiles.

Actual animation opening frame0:6styled layers/9enabled effects. Compared against
the original saved cached projection, raw composition differs1,260,032pixels/max253;
effects composition differs77,335pixels/max4. All3,686,400alpha samples match exactly.
Mean absolute RGB error falls4.5265842to0.01135163; mean premultiplied RGB error falls
3.57212181to0.01064172. RGB differences remain: this is NOT exact native parity or
an artist-accepted output. No tolerance threshold used to declare parity. Thumbnails
of effects/native were visually inspected and appear closely matched, not proof of
native exactness. Further rounding/overlay compositing diagnosis remains open.

Actual moving native keys75/78/81 also render and exact-save/reopen independently;
these have no matching native cached references, so no native-fidelity comparison
is claimed there. Each trial uses NEW private outputs; older raw/order-bug artifacts
remain preserved. Opening renderer runtime19.918s, moving75/78/81=21.781/21.047/20.839s
on existing local CPU/NumPy. These are measured preview/load/compile intervals, not
interactive latency or peak-RSS benchmarks. Do not run such work in Tk callbacks.
The final CLI additionally writes private provenance/runs/effects-preview.json with
input revision/fingerprint, parameters, source binding, credits and output hashes.

11new primary references cover pipeline, alpha/contour utilities, Gaussian radius,
effect ordering/defaults/offsets, ASL mappings, opacity, blend/threshold research and
NumPy FFT API. Now100APA references with full local dependency notices. Supplemental
reading was split into distinct APA entries after the first exploratory render;
original scoped default-reference notes already named companion offset research.
No upstream code copied/linked/executed; source passages consulted as interoperability
facts. Current master sources are mutable; hashes/scopes retained in research.json.
No newly installed packages/models, training, art upload, purchased compute or public
deployment. All processing stays hidden; fresh withdrawn offline CREDITS verification
opens neither mapped windows nor browser. No native OS focus/visual-layout/tablet/
screen-reader/artist-usefulness verification implied. Full-master scope is preserved.
