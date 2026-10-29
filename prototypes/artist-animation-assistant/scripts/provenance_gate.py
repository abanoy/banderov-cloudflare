"""Reuse an observed UI-shell check when only validated credit data changes.

The complete exact user-tested viewer is retained; template changes invalidate
acceptance. This is not a claim that the owner has reviewed later source records.
"""
import hashlib
import json
from pathlib import Path


def verify_viewer_ui(root):
    root = Path(root)
    gate = root / 'evaluation/credits-ui-acceptance.json'
    if not gate.is_file():
        raise ValueError('Real CREDITS UI acceptance record is missing')
    proof = json.loads(gate.read_text(encoding='utf-8'))
    if not all(proof.get(key) for key in ('visible_button', 'keyboard_open', 'offline_readable', 'close_returns_focus')) or not proof.get('reviewer') or not proof.get('checked_on'):
        raise ValueError('Credits UI acceptance is incomplete')
    current = root / 'generated/viewer.html'
    if hashlib.sha256(current.read_bytes()).hexdigest() == proof.get('viewer_sha256'):
        return proof
    accepted = (root / proof.get('accepted_viewer', '')).resolve()
    if not accepted.is_relative_to((root / 'evaluation').resolve()) or not accepted.is_file():
        raise ValueError('Accepted viewer snapshot is unavailable')
    if hashlib.sha256(accepted.read_bytes()).hexdigest() != proof.get('viewer_sha256'):
        raise ValueError('Accepted viewer snapshot changed')
    template = root / 'viewer/template.html'
    if hashlib.sha256(template.read_bytes()).hexdigest() != proof.get('template_sha256'):
        raise ValueError('Credits UI template changed; recheck the user interface')
    # Only the embedded JSON payload may differ from the user-tested document.
    def shell(value):
        start = '<script id="data" type="application/json">'
        prefix, sep, rest = value.partition(start)
        payload, end, suffix = rest.partition('</script>')
        if not sep or not end:
            raise ValueError('Credits payload boundary missing')
        json.loads(payload)
        return prefix + start + '__CREDITS_DATA__' + end + suffix
    if shell(current.read_text(encoding='utf-8')) != shell(accepted.read_text(encoding='utf-8')):
        raise ValueError('Credits UI behavior changed; recheck the user interface')
    return proof


def verify_ui(root):
    """The selected native host can supply its own exact, recorded UI evidence.

    This does not renew the earlier owner report for a changed HTML shell.
    The native entry points/keyboard/focus code must be byte-identical to a
    retained tested host, except the separately tested absent-link guard.
    """
    root=Path(root)
    record=root/'evaluation/standalone-credits-lineage.json'
    if not record.exists():return verify_viewer_ui(root)
    proof=json.loads(record.read_text(encoding='utf-8'))
    if proof.get('evidence_kind')!='automated_native_lineage' or proof.get('host')!='standalone':raise ValueError('Invalid selected-host credits evidence')
    resolved={}
    for role,item in proof['files'].items():
        path=(root/item['path']).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Native credits evidence changed: '+role)
        resolved[role]=path
    current=resolved['current_app'].read_text(encoding='utf-8');base=resolved['tested_app'].read_text(encoding='utf-8')
    guard="            url=self.shown[self.credit_list.curselection()[0]][0]['canonical_url']\n            if url:webbrowser.open(url)\n            else:self.status.set('Private local source; no public link. Artwork is not included in credits.')"
    previous="            webbrowser.open(self.shown[self.credit_list.curselection()[0]][0]['canonical_url'])"
    if current.count(guard)!=1 or current.replace(guard,previous)!=base:raise ValueError('Native credits behavior changed; exact lineage unavailable')
    native=json.loads(resolved['native_report'].read_text(encoding='utf-8'));checks=native.get('checks',{})
    if native.get('status')!='passed' or not all(checks.get(k) is True for k in ('credits_visible_without_project','keyboard_opens_credits','offline_sources_and_full_notices','escape_returns_focus')):raise ValueError('Native credits acceptance incomplete')
    hidden=json.loads(resolved['hidden_report'].read_text(encoding='utf-8'))
    if hidden.get('status')!='passed' or hidden.get('root_mapped') is not False or hidden.get('credits_mapped') is not False or not hidden.get('private_reference_readable') or not hidden.get('no_browser_open'):raise ValueError('Private-link native evidence incomplete')
    extension=proof.get('extension')
    entry=root/'scripts/standalone.py'
    if entry.exists() and 'from hosts.standalone.native_app import NativeApp as App' in entry.read_text(encoding='utf-8') and not extension:raise ValueError('Selected native extension evidence is missing')
    if extension:
        required={'open_credits','filter_credits','credit_detail','open_source','copy_one','copy_shown','export_credits','close_credits'}
        base_roles={'entry','host','panel','report'}
        joint_roles=base_roles|{'joint_jobs','joint_panel','joint_compare'}
        learned_roles=joint_roles|{'learned_jobs','learned_panel'}
        pool_roles=learned_roles|{'learned_schedule_jobs'}
        correction_roles=pool_roles|{'candidate_editor'}
        rebind_roles=correction_roles|{'rebind_panel','rebind_jobs','rebind_compare'}
        if set(extension.get('inherited_credits_methods',[]))!=required or set(extension.get('files',{})) not in (base_roles,joint_roles,learned_roles,pool_roles,correction_roles,rebind_roles):raise ValueError('Native extension evidence schema incomplete')
        import ast
        paths={}
        for role,item in extension['files'].items():
            path=(root/item['path']).resolve()
            if not path.is_relative_to(root.resolve()) or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=item['sha256']:raise ValueError('Native extension credits evidence changed: '+role)
            paths[role]=path
        tree=ast.parse(paths['host'].read_text(encoding='utf-8'));host=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='NativeApp')
        if any(isinstance(n,ast.ImportFrom) and n.module=='hosts.standalone.joint_panel' for n in ast.walk(tree)) and not joint_roles<=set(paths):raise ValueError('Joint extension evidence is missing')
        if any(isinstance(n,ast.ImportFrom) and n.module=='hosts.standalone.learned_panel' for n in ast.walk(tree)) and not learned_roles<=set(paths):raise ValueError('Learned extension evidence is missing')
        if 'learned_panel' in paths and any(isinstance(n,ast.ImportFrom) and n.module=='hosts.standalone.learned_schedule_jobs' for n in ast.walk(ast.parse(paths['learned_panel'].read_text(encoding='utf-8')))) and not pool_roles<=set(paths):raise ValueError('Learned pool evidence is missing')
        if any(isinstance(n,ast.ImportFrom) and n.module=='hosts.standalone.candidate_editor' for n in ast.walk(tree)) and not correction_roles<=set(paths):raise ValueError('Candidate correction evidence is missing')
        if any(isinstance(n,ast.ImportFrom) and n.module=='hosts.standalone.rebind_panel' for n in ast.walk(tree)) and set(paths)!=rebind_roles:raise ValueError('Rebind editor evidence is missing')
        if len(host.bases)!=1 or not isinstance(host.bases[0],ast.Name) or host.bases[0].id!='App':raise ValueError('Native extension no longer inherits tested host')
        if set(extension['inherited_credits_methods'])&{n.name for n in host.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}:raise ValueError('Native extension overrides tested credits behavior')
        if 'from hosts.standalone.native_app import NativeApp as App' not in paths['entry'].read_text(encoding='utf-8'):raise ValueError('Selected entry does not use verified native host')
        report=json.loads(paths['report'].read_text(encoding='utf-8'))
        if report.get('status')!='passed' or not all(report.get(k) is True for k in ('base_credits_methods_identical','button_managed_and_return_binding_retained','offline_readable','no_browser_open')) or report.get('root_mapped') is not False or report.get('credits_mapped') is not False:raise ValueError('Native extension CREDITS evidence incomplete')
    return proof
