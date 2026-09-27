"""Reproduce two bounded counterexamples against source crates, never a user DB."""
import datetime, json, os, pathlib, shutil, subprocess, tempfile
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[4]
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
results = []
with tempfile.TemporaryDirectory(prefix='prompt-hub-architecture-probes-') as directory:
    base = pathlib.Path(directory)
    for name, source, write in [('core-boundary','core-boundary.rs',False),('draft-reentry','draft-reentry.rs',True)]:
        project = base / name
        (project/'src').mkdir(parents=True)
        dependencies = {'repo-core': {'path': str(ROOT/'src-tauri/crates/repo-core')}, 'tempfile': '3'}
        if write: dependencies['repo-write'] = {'path': str(ROOT/'src-tauri/crates/repo-write')}
        cargo = '[package]\nname = '+json.dumps(name)+'\nversion = "0.0.0"\nedition = "2021"\n[workspace]\n[dependencies]\n'
        for key,value in dependencies.items():
            cargo += key+' = '+ ('{ path = '+json.dumps(value['path'])+' }' if isinstance(value,dict) else json.dumps(value))+'\n'
        (project/'Cargo.toml').write_text(cargo)
        shutil.copy2(HERE/source,project/'src/main.rs')
        (HERE/(name+'.Cargo.toml')).write_text(cargo)
        env = os.environ.copy(); env['CARGO_TARGET_DIR'] = str(ROOT/'src-tauri/target')
        command = ['cargo','run','--offline','--manifest-path',str(project/'Cargo.toml')]
        p = subprocess.run(command,env=env,text=True,capture_output=True)
        (HERE/(name+'.log')).write_text(p.stdout+p.stderr)
        shutil.copy2(project/'Cargo.lock', HERE/(name+'.Cargo.lock'))
        results.append({'probe':name,'command':command,'exit_code':p.returncode,'observation':p.stdout.strip()})
        print(name,p.returncode,p.stdout.strip(),p.stderr[-500:] if p.returncode else '')
(HERE/'results.json').write_text(json.dumps({'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'results':results},indent=2)+'\n')
raise SystemExit(any(x['exit_code'] for x in results))
