"""Original synthetic process-boundary fixture; no algorithm-quality claim."""
from copy import deepcopy
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.credits import build
from scripts.provenance_gate import verify_ui
from engine.jobs import create_job, request_cancel, apply_result, atomic_write, read
from engine.project import create


def run(output):
    verify_ui(ROOT)
    credits = build(check=True)
    output.mkdir(parents=True, exist_ok=False)
    pixels = [[0, 0, 0, 0] for _ in range(64)]
    for offset in [18, 19, 20, 26, 34, 35, 36]:
        pixels[offset] = [25, 45, 80, 180]
    project = create(pixels, 8, 8, 12)
    atomic_write(output / 'original-project.json', project)
    started = time.perf_counter()
    for name, cancelled in [('job-complete', False), ('job-cancelled', True)]:
        job_dir = output / name
        create_job(project, 'source', 1, 0, job_dir)
        if cancelled:
            request_cancel(job_dir)
        result = subprocess.run([sys.executable, str(ROOT / 'scripts/worker.py'), '--job', str(job_dir)], cwd=ROOT, capture_output=True, text=True, timeout=15)
        (job_dir / 'worker-output.txt').write_text(result.stdout + result.stderr + '\nEXIT=' + str(result.returncode), encoding='utf-8')
        if result.returncode:
            raise RuntimeError('Worker failed: ' + result.stderr)
        if cancelled:
            assert read(job_dir / 'job.json')['state'] == 'cancelled'
            assert not (job_dir / 'result.json').exists()
    completed = output / 'job-complete'
    applied = apply_result(project, completed, 'proposal-from-worker', 'accepted-from-worker')
    atomic_write(output / 'accepted-project.json', applied)
    assert read(output / 'accepted-project.json') == applied
    assert project['drawings']['source'] == applied['drawings']['source']
    changed = deepcopy(project)
    changed['revision'] += 1
    stale_rejected = False
    try:
        apply_result(changed, completed, 'stale-proposal', 'stale-accepted')
    except ValueError as error:
        stale_rejected = 'Stale' in str(error)
    assert stale_rejected
    report = {'status': 'passed', 'evidence_level': 'separate Python worker with original synthetic grids, not a host editor',
              'checks': {'separate_process_completed': True, 'prestart_cancel_no_result': True, 'stale_commit_rejected': stale_rejected, 'source_preserved': True, 'save_reopen_exact': True, 'duration_preserved': applied['shot']['duration_frames'] == 12},
              'duration_seconds': time.perf_counter() - started,
              'source_ids': ['REF-PYTHON'], 'component_ids': ['COMP-PYTHON-3-13-1'],
              'credits_snapshot_sha256': credits['snapshot_sha256'],
              'limits': ['No character-aware motion', 'No host undo/redo', 'No interactive cancellation timing guarantee', 'No artist-effort measurement']}
    atomic_write(output / 'report.json', report)
    for name in ['CREDITS.md', 'credits.json', 'THIRD_PARTY_NOTICES.txt']:
        (output / name).write_bytes((ROOT / 'generated' / name).read_bytes())
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.output)
