"""Deterministic offline provenance validation/build. REF-PYTHON, REF-APA."""
from pathlib import Path
from collections import defaultdict
import argparse
import hashlib
import json
import re
import datetime

ROOT = Path(__file__).resolve().parents[1]
STATES = {"candidate", "consulted", "evaluated", "implemented", "shipped", "retired"}


def read(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def load():
    sources = read("provenance/sources.json")["sources"]
    components = read("provenance/components.json")["components"]
    uses = read("provenance/feature_uses.json")["uses"]
    experiments = [read(str(p.relative_to(ROOT))) for p in sorted((ROOT / "provenance/experiments").glob("*.json"))]
    for rows, key in [(sources, "source_id"), (components, "component_id"), (uses, "use_id")]:
        if len({r[key] for r in rows}) != len(rows):
            raise ValueError("Duplicate identity: " + key)
    sids, cids = {s["source_id"] for s in sources}, {c["component_id"] for c in components}
    for row in components + uses + experiments:
        if not set(row.get("source_ids", [])) <= sids or not set(row.get("component_ids", [])) <= cids:
            raise ValueError("Unresolved attribution reference")
    for source in sources:
        if source["use_state"] not in STATES or not source["metadata_checked_on"] or not source["inspection_scope"]:
            raise ValueError("Incomplete source state/evidence")
        if source.get("type")=="unpublished_artwork":
            if (any(source.get(k) is not None for k in ("canonical_url","free_access_url","doi"))
                    or source.get("permission_state")!="permitted_private_local_evaluation_only"
                    or source.get("category")!="data" or not source.get("apa_override")):
                raise ValueError("Private artwork requires explicit nonpublic citation and evaluation-only scope")
        else:
            for key in ("canonical_url", "free_access_url"):
                if not isinstance(source.get(key),str) or not source[key].startswith("https://"):
                    raise ValueError("Only explicit HTTPS source links allowed")
    for comp in components:
        if not set(comp["dependencies"]) <= cids:
            raise ValueError("Unknown component dependency")
        if comp["execution_allowed"] and (not re.fullmatch(r"[a-f0-9]{64}", comp.get("artifact_sha256") or "") or not comp["license"]["evidence_url"] or not comp["permission_state"].startswith("permitted")):
            raise ValueError("Execution without exact identity and permission")
        if comp["distribution_allowed"] and (not comp["dependencies_audited"] or not comp["license"]["notice_file"]):
            raise ValueError("Distribution audit incomplete")
        notice = comp["license"]["notice_file"]
        if notice and not (ROOT / notice).is_file():
            raise ValueError("Missing notice")
    for exp in experiments:
        if exp["status"] not in {"proposed", "blocked", "abandoned"}:
            for cid in exp["component_ids"]:
                comp = next(c for c in components if c["component_id"] == cid)
                if not comp["execution_allowed"]:
                    raise ValueError("Experiment executed an uncleared component")
    # APA suffixes must be derived from the whole catalog, not hand-maintained.
    groups = defaultdict(list)
    for s in sources:
        groups[(s["authors"], s["year"])].append(s)
    for group in groups.values():
        for index, s in enumerate(sorted(group, key=lambda s: s["title"].casefold())):
            suffix = chr(97 + index) if len(group) > 1 else ""
            year = s["year"] + ("-" if s["year"] == "n.d." and suffix else "") + suffix
            date = (s.get("date") or year)
            if s.get("date") and suffix:
                date = date.replace(s["year"], year, 1)
            checked_date=datetime.date.fromisoformat(s["metadata_checked_on"])
            months=("January","February","March","April","May","June","July","August","September","October","November","December")
            retrieved=f"Retrieved {months[checked_date.month-1]} {checked_date.day}, {checked_date.year}, from " if s["year"]=="n.d." else ""
            s["apa_reference"] = s.get("apa_override") or f'{s["authors"]}. ({date}). {s["title"]}. {retrieved}{s["canonical_url"]}'
    sources.sort(key=lambda s: (s["authors"].casefold(), s["year"], s["title"].casefold()))
    notices = "External tools are used locally and are not bundled. No third-party implementation code, models or datasets are bundled.\n\n"
    for comp in components:
        notices += f'{comp["component_id"]}\n{comp["license"]["identifier"]}\n{comp["scope"]}\n{comp["license"]["evidence_url"]}\n\n'
        if comp["license"]["notice_file"]:
            notices += (ROOT / comp["license"]["notice_file"]).read_text(encoding="utf-8") + "\n\n"
    data = {"schema_version": "1.0", "sources": sources, "components": components, "uses": uses, "experiments": experiments, "notices": notices}
    data["snapshot_sha256"] = hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return data


def build(check=False):
    data = load()
    markdown = "# CREDITS\n\nGenerated from provenance/. Source verification is separate from reproduction and permission.\n\n"
    for s in data["sources"]:
        markdown += f'## {s["source_id"]}\n\n{s["apa_reference"]}\n\n{s["role"]} — {s["use_state"]}; {s["permission_state"]}.\n\n{s["inspection_scope"]}\n\n'
    markdown += "## License notices\n\nSee THIRD_PARTY_NOTICES.txt (full local interpreter notices). No third-party binaries are bundled.\n"
    template = (ROOT / "viewer/template.html").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    outputs = {"credits.json": json.dumps(data, indent=2, ensure_ascii=False) + "\n", "CREDITS.md": markdown,
               "THIRD_PARTY_NOTICES.txt": data["notices"], "viewer.html": template.replace("__CREDITS_DATA__", payload)}
    (ROOT / "generated").mkdir(exist_ok=True)
    for name, value in outputs.items():
        target = ROOT / "generated" / name
        if check:
            if not target.exists() or target.read_bytes() != value.encode("utf-8"):
                raise ValueError("Generated file stale: " + name)
        else:
            target.write_bytes(value.encode("utf-8"))
    return data


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--credits", action="store_true")
    args = parser.parse_args()
    data = build(args.check)
    print((ROOT / "generated/CREDITS.md").read_text(encoding="utf-8") if args.credits else f'Credits valid: {len(data["sources"])} sources; snapshot {data["snapshot_sha256"]}')
