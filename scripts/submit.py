import json, re, sys, subprocess, html, os, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from parse import parse

name, url = sys.argv[1], sys.argv[2]
outdir = sys.argv[3]
d = json.load(open(f'data/{name}.json'))
ans = {q['qid']: q['answer'] for q in d['questions']}
jar = tempfile.mktemp()
UA = 'Mozilla/5.0'
page = subprocess.run(['curl', '-sL', '-A', UA, '-c', jar, '-b', jar, url], capture_output=True, text=True).stdout
open(f'{outdir}/{name}.get.html', 'w').write(page)
form = re.search(r'<form action="([^"]+)"[^>]*id="sg_FormFor\d+".*?</form>', page, re.S)
action = 'https://survey.alchemer.com' + html.unescape(form.group(1))
args = []
for m in re.finditer(r'<input type="hidden"[^>]*>', form.group(0)):
    tag = m.group(0)
    n = re.search(r'name="([^"]*)"', tag); v = re.search(r'value="([^"]*)"', tag)
    if n:
        args += ['-F', f'{n.group(1)}={html.unescape(v.group(1)) if v else ""}']
args = [a.replace('sg_navchoice=', 'sg_navchoice=sGizmoSubmitButton') if a == 'sg_navchoice=' else a for a in args]
_, qs = parse(page)
for q in qs:
    args += ['-F', f"{q['name']}={ans[q['qid']]}"]
args += ['-F', 'sGizmoSubmitButton=Submit']
r = subprocess.run(['curl', '-sSL', '-A', UA, '-c', jar, '-b', jar, '-e', url] + args + [action], capture_output=True, text=True); res = r.stdout; sys.stderr.write(r.stderr)
open(f'{outdir}/{name}.result.html', 'w').write(res)
print(name, len(res))
