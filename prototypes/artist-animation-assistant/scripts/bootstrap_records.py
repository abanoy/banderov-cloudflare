"""One-time initial records. Refuses to overwrite existing canonical records."""
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def write(path, value):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("x", encoding="utf-8", newline="\n") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def source(sid, author, year, title, url, role, scope, category="research", date=None):
    return {"source_id": sid, "type": "documentation", "authors": author, "year": year,
            "date": date, "title": title, "canonical_url": url, "free_access_url": url,
            "publisher_or_repository": author, "doi": None, "metadata_checked_on": "2026-10-20",
            "role": role, "inspection_scope": scope, "category": category,
            "use_state": "consulted", "permission_state": "reference_only",
            "modules": [], "evidence": {"reviewer": "OpenAI Codex", "checked_on": "2026-10-20", "note": scope}}


if __name__ == "__main__":
    sources = [
        source("REF-PYTHON", "Python Software Foundation", "2024", "Python (Version 3.13.1) [Computer software]", "https://www.python.org/downloads/release/python-3131/", "Local engine, credits generator and unit-test runtime", "Installed 3.13.1; local LICENSE.txt preserved. Interpreter is used, not redistributed.", "runtime", "2024, December 3"),
        source("REF-PYTHON-LICENSE", "Python Software Foundation", "n.d.", "History and license", "https://docs.python.org/3.13/license.html", "Permission review and interpreter notices", "Official license page consulted; exact installed license preserved under provenance/licenses/COMP-PYTHON-3-13-1/.", "notices"),
        source("REF-HTML", "WHATWG", "n.d.", "HTML standard: Interactive elements", "https://html.spec.whatwg.org/multipage/interactive-elements.html", "Offline dialog, details and keyboard interaction", "Dialog and details specification consulted; implementation independently authored, no copied snippets.", "runtime"),
        source("REF-APA", "American Psychological Association", "2022", "Missing reference information", "https://apastyle.apa.org/style-grammar-guidelines/references/missing-information", "Missing-date treatment in APA records", "Author/date/title/source structure and missing-date table consulted.", date="2022, July"),
        source("REF-KRITA-API", "Krita", "n.d.", "Document class reference", "https://api.kde.org/legacy/krita/html/classDocument.html", "Native document probe design", "Read importAnimation uniform-step semantics, saveAs, open-related and annotation APIs. Legacy documentation is not installed-version proof."),
        source("REF-KRITA-NODE", "Krita", "n.d.", "Node class reference", "https://api.kde.org/legacy/krita/html/classNode.html", "Layer and time-specific pixel probe design", "Node pixelDataAtTime, setPixelData, bounds and child layer APIs consulted; native behavior unverified."),
        source("REF-KRITA-PLUGIN", "Krita", "n.d.", "How to make a Krita Python plugin", "https://docs.krita.org/en/user_manual/python_scripting/krita_python_plugin_howto.html", "Initial host selection and isolated probe planning", "Plugin tutorial inspected; no plugin installed in user settings."),
        source("REF-KRITA-LICENSE", "Krita", "n.d.", "License for usage", "https://krita.org/en/about/license/", "Plugin distribution policy", "Official GPL plugin requirement consulted. Final product license remains undecided; no Krita binaries distributed.", "notices"),
        source("REF-KRITA-RELEASE", "Krita", "2026", "Krita 5.3.4 released!", "https://krita.org/en/posts/2026/krita-5.3.4-released/", "Compatibility planning", "Official release page distinguishes production 5.3.4 and experimental 6.0.4. Installed 5.3.2.1 left unchanged.", date="2026, September 15"),
        source("REF-FRITE", "Even, M., Bénard, P., & Barla, P.", "2023", "Non-linear rough 2D animation using transient embeddings", "https://mostyle.github.io/blog/eg2023/", "Procedural motion candidate", "Author project page and abstract only; full paper/code not examined or executed. Candidate requires grouping/preparation investigation."),
        source("REF-TOONCOMPOSER", "TencentARC", "n.d.", "ToonComposer [Source code repository]", "https://github.com/TencentARC/ToonComposer", "Learned sparse-key motion candidate", "README inspected only. Code, weights and dependencies not acquired, executed or cleared for distribution."),
        source("REF-HYPERSKETCH", "Zhu, X., Yang, X., Yang, Y., Li, M., Gao, F., & Chen, J.", "2026", "HyperSketch: Controllable video sketching in a style hyperspace [Preprint]", "https://arxiv.org/abs/2609.00919", "New vector-control candidate discovered in current search", "Metadata and abstract inspected only; video-to-vector-sketch input differs from sparse artist keys. No reproduction or full-method claim."),
    ]
    sources[0].update(use_state="implemented", permission_state="permitted_local_use", modules=["engine", "scripts", "tests"])
    sources[2].update(use_state="implemented", permission_state="permitted_reference_use", modules=["viewer/template.html"])
    sources[-3].update(type="project_page", apa_override="Even, M., Bénard, P., & Barla, P. (2023). Non-linear rough 2D animation using transient embeddings. Computer Graphics Forum, 42, 411–425. https://doi.org/10.1111/cgf.14771", doi="10.1111/cgf.14771")
    sources[-1].update(type="preprint", doi="10.48550/arXiv.2609.00919")
    write("provenance/sources.json", {"schema_version": "1.0", "sources": sources})
    components = [{"component_id": "COMP-PYTHON-3-13-1", "kind": "external_runtime", "source_ids": ["REF-PYTHON", "REF-PYTHON-LICENSE"], "revision": "3.13.1 (0671451)", "origin_url": sources[0]["canonical_url"], "artifact_sha256": "03573716a7fcbd8b7fed8fe0163bbfbd3a852546920d6a666123f307c8dac7d9", "dependencies": [], "dependencies_audited": False, "license": {"identifier": "Python-2.0 and included notices", "evidence_url": sources[1]["canonical_url"], "notice_file": "provenance/licenses/COMP-PYTHON-3-13-1/LICENSE.txt"}, "use_state": "implemented", "permission_state": "permitted_local_use", "execution_allowed": True, "distribution_allowed": False, "scope": "Installed interpreter/stdlib only; no interpreter bundle or third-party packages. Distribution dependency audit pending."},
        {"component_id": "COMP-KRITA-5-3-2-1", "kind": "external_host", "source_ids": ["REF-KRITA-API", "REF-KRITA-LICENSE"], "revision": "5.3.2.1 (0619060)", "origin_url": "https://krita.org/", "artifact_sha256": "35bd934ce60472ca8e030210799c6f1f6dcd9aef9b4c2647ebf2d27543c6e9d5", "dependencies": [], "dependencies_audited": False, "license": {"identifier": "GPL-3.0; bundled libraries separately licensed", "evidence_url": "https://krita.org/en/about/license/", "notice_file": None}, "use_state": "candidate", "permission_state": "permitted_local_use", "execution_allowed": True, "distribution_allowed": False, "scope": "Existing installed host for isolated synthetic probe only. No binaries packaged."}]
    write("provenance/components.json", {"schema_version": "1.0", "components": components})
    write("provenance/feature_uses.json", {"schema_version": "1.0", "uses": [
        {"use_id": "USE-CREDITS", "feature_ids": ["REQ-13", "REQ-18"], "source_ids": ["REF-PYTHON", "REF-PYTHON-LICENSE", "REF-HTML", "REF-APA"], "component_ids": ["COMP-PYTHON-3-13-1"], "scope": "Locally generated offline credits shell", "use_state": "implemented", "date": "2026-10-20"},
        {"use_id": "USE-RESEARCH", "feature_ids": ["REQ-02", "REQ-07", "REQ-15"], "source_ids": [s["source_id"] for s in sources[4:]], "component_ids": [], "scope": "Documentation and candidate research only; no model execution", "use_state": "consulted", "date": "2026-10-20"}]})
    notice = ROOT / "provenance/licenses/COMP-PYTHON-3-13-1/LICENSE.txt"
    notice.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(Path("C:/Program Files/Python313/LICENSE.txt"), notice)
