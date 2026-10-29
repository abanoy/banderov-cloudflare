# ADR-0003 — Standalone selected; native Tk integration slice

Date: 2026-10-20 21:28 EDT. Status: owner selects standalone; Tk is the current reversible
engineering framework choice. Supersedes provisional Krita-first host choice in
ADR-0001. Preserves previous evidence and complete master requirements.

Repeated owner-operated editor checks constrain development. Owner explicitly
authorized switching to standalone for more autonomous work. The master Phase9
allows moving its host shell alongside Phases1–2. Do that; stop treating the
pending Krita animation reply as a prerequisite. No new owner question is needed.

Choose installed Python/Tk8.6.15 for this bounded desktop increment: no package
install, server or account, native widgets and PNG images, and event-loop tests of
our own app. Official Python tkinter/ttk docs and Tcl/Tk licenses inspected and
registered before experiments (REF-TKINTER, REF-TKINTER-TTK,
REF-TCL-TK-LICENSE). Exact local binding/DLL hashes and full notice retained.
Runtime used locally, not redistributed; final installer/license audit unfinished.

An engine-independent controller owns revisions/undo/correction actions; Tk owns
selection, canvas/preview, timelines, dialogs and jobs. Existing separate Python
worker keeps processing outside widget callbacks. .aaa.json is the supported
editable project format. CSV/PNG export remains limited interchange with full
project sidecar. Do not claim .kra layers/animation support until independently
implemented and tested; it remains a required fidelity project.

Rejected for this increment: embedding processing in the UI; adding a large GUI
framework before an observed need; repeating failed headless Krita starts; relying
on owner answers for routine regression. Previous browser file-policy restriction
remains and is not bypassed. This is the separately selected desktop application.

Verified slice:41unit tests,21native own-control checks, exact source/alpha/holds/
project/correction preservation and actual Tk image round trip. Human aesthetic,
screen-reader/device and whole-task effort evaluation remain unmeasured. These
tests enable autonomous engineering, not a promise that every creative choice can
be validated automatically. Current one-layer/256px/600slot/64drawing bounds and
RGBA8-only import are temporary research constraints, not the final product scope.

Reconsider GUI/serialization on measured scale or latency failure, needed vector/
high-bit-depth/structure support, accessibility findings or packaging constraints.
Preserve project migrations and invariant tests if changing them. Procedural,
existing/adapted models and custom neural components remain eligible by evidence.
