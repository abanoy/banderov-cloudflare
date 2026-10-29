"""No downloads, account inspection or changes. Local development inventory."""
from pathlib import Path
import argparse
import hashlib
import json
import platform
import shutil
import sys


def inspect():
    krita = Path("C:/Program Files/Krita (x64)/bin/krita.exe")
    return {"schema_version": "1.0", "os": platform.platform(), "python": sys.version,
            "python_executable_sha256": hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest(),
            "node_present": shutil.which("node") is not None,
            "krita_executable_present": krita.is_file(),
            "krita_executable_sha256": hashlib.sha256(krita.read_bytes()).hexdigest() if krita.is_file() else None,
            "gpu_execution": "not tested", "models_acquired": [],
            "native_host_round_trip": "not tested", "network_required": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    value = json.dumps(inspect(), indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(value, encoding="utf-8")
    print(value)
