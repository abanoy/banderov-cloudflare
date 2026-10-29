"""Launch the installed native host in an owned, bounded, isolated process.

REF-KRITA-RUNNER, REF-KRITA-SOURCE and REF-QT-OFFSCREEN. This tests native
serialization through application APIs, not desktop interaction or browser access.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui


def launch(name):
    isolation = ROOT / 'evaluation/native-isolation-acceptance.json'
    if not isolation.is_file():
        raise RuntimeError('Native launch paused: verify Windows settings isolation or use the documented GUI probe; see NEXT_ACTIONS.md')
    if not re.fullmatch(r'attempt-[0-9]{2}', name):
        raise ValueError('Use a new attempt-NN identifier')
    verify_ui(ROOT)
    build(check=True)
    runner = Path('C:/Program Files/Krita (x64)/bin/kritarunner.com')
    expected = 'd14705e89387aea5f32d5f144dfec71a79c01bc5d4271dcbc904c347e47759e6'
    if hashlib.sha256(runner.read_bytes()).hexdigest() != expected:
        raise ValueError('Installed runner identity changed; reassess provenance')
    trial = ROOT / 'experiments/EXP-0002-native-roundtrip' / name
    trial.mkdir(parents=True, exist_ok=False)
    runtime = trial / 'isolated-runtime'
    settings = {}
    for key, leaf in [('APPDATA', 'appdata'), ('LOCALAPPDATA', 'localdata'), ('XDG_CONFIG_HOME', 'config'), ('XDG_DATA_HOME', 'data'), ('XDG_CACHE_HOME', 'cache'), ('TEMP', 'temp'), ('TMP', 'temp')]:
        directory = runtime / leaf
        directory.mkdir(parents=True, exist_ok=True)
        settings[key] = str(directory)
    env = os.environ.copy()
    env.update(settings)
    env['QT_QPA_PLATFORM'] = 'minimal'
    env['PYTHONPATH'] = os.pathsep.join([str(ROOT / 'hosts/krita'), str(ROOT)])
    env['PATH'] = str(runner.parent) + os.pathsep + env.get('PATH', '')
    command = [str(runner), '-s', 'runner_entry', '-f', 'main', str(trial / 'outputs')]
    started = time.perf_counter()
    with (trial / 'stdout.txt').open('wb') as stdout, (trial / 'stderr.txt').open('wb') as stderr:
        process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=stdout, stderr=stderr, creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        timed_out = False
        try:
            code = process.wait(timeout=90)
        except subprocess.TimeoutExpired:
            timed_out = True
            subprocess.run(['taskkill.exe', '/PID', str(process.pid), '/T', '/F'], capture_output=True) if os.name == 'nt' else process.kill()
            code = process.wait(timeout=10)
    report_path = trial / 'outputs/report.json'
    report = json.loads(report_path.read_text(encoding='utf-8')) if report_path.is_file() else None
    result = {'command': command, 'process_id': process.pid, 'exit_code': code, 'timed_out': timed_out,
              'duration_seconds': round(time.perf_counter() - started, 3),
              'isolation': {**settings, 'QT_QPA_PLATFORM': 'minimal'},
              'native_report_status': report.get('status') if report else 'missing',
              'success': code == 0 and not timed_out and report is not None and report['status'] == 'passed'}
    (trial / 'execution.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result, indent=2))
    if report:
        print(json.dumps(report, indent=2))
    else:
        print((trial / 'stderr.txt').read_text(encoding='utf-8', errors='replace')[-4000:])
    return 0 if result['success'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', required=True)
    args = parser.parse_args()
    raise SystemExit(launch(args.name))
