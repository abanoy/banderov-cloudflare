"""One-time initialization of the foundation's traceability and proposed studies."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        if isinstance(value, str):
            stream.write(value)
        else:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")


if __name__ == "__main__":
    requirements = [
        ("Read sketches/sequences faithfully", "partial", "RGBA8 fixture model", "Native import, image formats and bounds"),
        ("Krita .kra workflows", "planned", "Native probe prepared, not executed", "Save/reopen on installed host"),
        ("Character/color references", "planned", "No reference assets supplied", "Reference ingestion and influence ablation"),
        ("Broken boundaries and fills", "planned", "No gap algorithm executed", "Invisible barriers and intentional openings"),
        ("Refined line art", "planned", "No cleanup implementation", "Compare procedural/learned cleanup"),
        ("Color assignment/propagation", "planned", "No palette engine", "Stable palette and corrected anchors"),
        ("Intermediate drawings", "planned", "Integer translation is an integration baseline only", "Useful correspondence/motion proposals"),
        ("Economical drawing schedules", "partial", "Unique drawings and exposure lengths separate", "Artist-editable schedule and events"),
        ("Stylized motion", "planned", "No timing/smear generator", "Separate path, easing and smears"),
        ("Organized editable output", "partial", "Stable drawing/layer IDs in fixture JSON", "Native editable layers and semantic parts"),
        ("Preserve approvals", "partial", "Unit checks reject replacing locked/approved drawings", "Native locks, pixel/stroke scopes and undo"),
        ("Iterative local regeneration", "partial", "Correction revisions and stale acceptance tested", "Dependency-local invalidation and real jobs"),
        ("APA CREDITS", "partial", "12 sources, deterministic build, static shell checks", "Actual offline/keyboard/visual UI acceptance"),
        ("Suitable free components", "partial", "Installed Python only; no paid dependencies", "Release-specific dependency audit"),
        ("Custom research/learned components", "planned", "Frite, ToonComposer, HyperSketch candidate triage", "Failure-driven experiment, held-out lawful data"),
        ("Minimize setup/friction", "partial", "No-package offline foundation", "Target-host journey, progress and cancellation"),
        ("Optional remote processing", "planned", "No service or upload", "Transport-independent jobs before authorized hosting"),
        ("Cross-session continuation", "implemented", "State/decisions/next actions/registry/tests", "Keep records current and append root handoff"),
        ("Usable exports", "planned", "Credits exports implemented; drawing export unverified", "Editable artwork and playback fidelity separately"),
        ("Practical usefulness", "planned", "No artist test or time-saving claim", "Representative artwork and whole-task comparison"),
    ]
    matrix = "# Requirements traceability\n\nAll twenty requirements remain active. Partial scaffolding is not product acceptance.\n\n| ID | Capability | Status | Evidence | Remaining / next action |\n| --- | --- | --- | --- | --- |\n"
    for i, row in enumerate(requirements, 1):
        matrix += "| REQ-%02d | %s | %s | %s | %s |\n" % (i, *row)
    matrix += "\nEvidence: tests/test_foundation.py; evaluation/foundation-tests.txt; generated/; docs/research/initial-comparison.md. No target-host or artist-evaluated rows.\n"
    write("REQUIREMENTS.md", matrix)
    common = {"schema_version": "1.0", "date": "2026-10-20", "component_ids": ["COMP-PYTHON-3-13-1"], "source_ids": ["REF-PYTHON"], "input_provenance": "Original synthetic RGBA grids defined in project scripts; no private or external artwork", "hardware": "See evaluation/environment.json and PROJECT_STATE.md", "seeds": None, "training_evaluation_separation": "No training; engineering diagnostics only"}
    write("provenance/experiments/EXP-0001-portable-loop.json", dict(common, experiment_id="EXP-0001-portable-loop", status="blocked", use_state="candidate", feature_ids=["REQ-01", "REQ-08", "REQ-11", "REQ-12"], question="Can still/shot proposals be corrected and locked without losing originals or time?", hypothesis="The original project representation can preserve revisions and exposure durations", configuration={"width": 8, "height": 8, "duration_frames": [1, 12], "operation": "integer translation", "scope": "integration only"}, baseline="Source snapshot and explicit holds", budget="CPU only, at most a few seconds; no downloads", stop_condition="Credits UI gate absent or any invariant failure", observations="Foundation unit tests passed separately; this fixture run is blocked before output creation", outcome="No experiment outputs produced; native UI acceptance required", command="python scripts/run_fixture.py --output experiments/EXP-0001-portable-loop/outputs"))
    native = dict(common, experiment_id="EXP-0002-native-roundtrip", status="proposed", use_state="candidate", feature_ids=["REQ-02", "REQ-10", "REQ-11", "REQ-19"], question="Does the installed Krita retain synthetic pixel, lock, annotation and exposure data after native reopen?", configuration={"width": 8, "height": 8, "unique_images": 2, "imported_slots": 5, "import_step": 1}, baseline="Raw pixel/annotation snapshots before native save", budget="Tiny local fixture; no artwork, downloads or training", stop_condition="Credits UI gate missing, no host, failed assertion or API exception", observations="Not executed", outcome="Pending native execution; no .kra file exists", command="Run hosts/krita/roundtrip_probe.py in installed Krita Scripter")
    native["source_ids"] += ["REF-KRITA-API", "REF-KRITA-NODE", "REF-KRITA-PLUGIN", "REF-KRITA-LICENSE"]
    native["component_ids"] += ["COMP-KRITA-5-3-2-1"]
    write("provenance/experiments/EXP-0002-native-roundtrip.json", native)
    write("provenance/decisions/PERM-0001-local-foundation.json", {"schema_version": "1.0", "decision_id": "PERM-0001", "reviewer": "OpenAI Codex", "date": "2026-10-20", "source_ids": ["REF-PYTHON-LICENSE", "REF-KRITA-LICENSE", "REF-HTML"], "decision": "Existing interpreter and host may be used locally; no binary packaging approved. Research candidates are references only. Independently authored HTML functionality; no copied vendor code.", "uncertainties": ["Full binary dependency inventories not audited", "Final plugin/engine distribution licensing not selected", "Model code/weights/data permissions unresolved"], "supersedes": None})
    write("experiments/EXP-0001-portable-loop/results.md", "# EXP-0001 — Portable proposal/correction fixture\n\nStatus: blocked before execution. No output assets exist.\n\nQuestion, source/component identities, configuration, original input provenance, budget and exact command are in provenance/experiments/EXP-0001-portable-loop.json.\n\nAttempt: scripts/run_fixture.py returned exit 1, explicitly requiring credits UI acceptance. This proves only that the gate prevented output generation. No quality or motion result. The separate 13 foundation unit tests verify engineering invariants, not a native host session.\n\nNext: NEXT_ACTIONS.md step 1, then run this exact recorded fixture.\n")
    write("experiments/EXP-0002-native-roundtrip/results.md", "# EXP-0002 — Native document probe\n\nStatus: proposed, unexecuted. Prepared script: hosts/krita/roundtrip_probe.py.\n\nNo .kra or native result exists. The installed executable's file version is evidence of installation only. Expected test and stop conditions are in the provenance manifest.\n")
    write("CHANGELOG.md", "# Changelog\n\n## 2026-10-20 — Phase 0 foundation\n\nAdded deterministic provenance/CREDITS build and offline experiment shell, original portable RGBA8/project/exposure/approval scaffolding, 13 engineering tests, gated still/shot fixture runner, unexecuted native Krita probe, current primary-source triage and complete continuation/requirements records.\n\nNo model or borrowed-method experiment executed. Actual browser interaction was blocked by local-file URL security policy. No target-host, artist usefulness, final release or deployment claim. See PROJECT_STATE.md.\n")
