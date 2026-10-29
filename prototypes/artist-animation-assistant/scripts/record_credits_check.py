"""Human acceptance recorder. Run only after observing the saved viewer."""
import datetime
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if __name__ == "__main__":
    answers = {"reviewer": input("Reviewer name: ").strip(), "environment": input("Browser and version: ").strip()}
    for key, question in [
        ("visible_button", "Is a button labelled exactly CREDITS visible without a project?"),
        ("keyboard_open", "Can Tab and Enter open CREDITS and reach search/filter/Close?"),
        ("offline_readable", "With networking disconnected, do references AND full notices remain readable?"),
        ("close_returns_focus", "Does Escape close credits and return focus to CREDITS?")]:
        answers[key] = input(question + " [yes/no]: ").strip().lower() == "yes"
    if not answers["reviewer"] or not answers["environment"] or not all(answers[k] for k in ("visible_button", "keyboard_open", "offline_readable", "close_returns_focus")):
        raise SystemExit("Gate remains pending; no acceptance record written")
    answers["checked_on"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    answers["viewer_sha256"] = hashlib.sha256((ROOT / "generated/viewer.html").read_bytes()).hexdigest()
    target = ROOT / "evaluation/credits-ui-acceptance.json"
    with target.open("x", encoding="utf-8") as stream:
        json.dump(answers, stream, indent=2)
    print("Recorded observed acceptance for this exact viewer. Recheck if it changes.")
