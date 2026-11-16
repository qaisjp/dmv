import re, html, json, sys

def clean(t):
    t = re.sub(r'<br\s*/?>', ' ', t)
    imgs = re.findall(r'<img[^>]*src="([^"]+)"', t)
    t = re.sub(r'<[^>]+>', '', t)
    return re.sub(r'\s+', ' ', html.unescape(t)).strip(), imgs

def parse(s):
    title = clean(re.search(r'<title>(.*?)</title>', s, re.S).group(1))[0]
    qs = []
    for m in re.finditer(r'<fieldset id="(sgE-(\d+)-(\d+)-(\d+))-box"\s+class="sg-question sg-type-(\w+)[^"]*">(.*?)</fieldset>', s, re.S):
        fid, _, page, qid, typ, body = m.groups()
        leg = re.search(r'<legend[^>]*>(.*?)</legend>', body, re.S)
        text, imgs = clean(leg.group(1)) if leg else ('', [])
        # images may also sit in question description
        desc = re.search(r'class="sg-question-description"[^>]*>(.*?)</div>', body, re.S)
        if desc:
            imgs += clean(desc.group(1))[1]
        opts = []
        for o in re.finditer(r'<input type="radio"\s+id="[^"]+"[^>]*name="([^"]+)"[^>]*value="(\d+)"/>\s*<label[^>]*>(.*?)</label>', body, re.S):
            ot, oimgs = clean(o.group(3))
            opts.append({'value': o.group(2), 'text': ot, 'images': oimgs})
        qs.append({'name': fid, 'page': page, 'qid': qid, 'type': typ, 'question': text, 'images': imgs, 'options': opts})
    return title, qs

if __name__ == '__main__':
    title, qs = parse(open(sys.argv[1]).read())
    print(json.dumps({'title': title, 'questions': qs}, indent=1))
