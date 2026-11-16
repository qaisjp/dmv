import json, re, os
ORDER = ['Chapter-4-Traffic-Control', 'Chapter-5-Intersections-and-Turns', 'Chapter-6-Passing',
         'Chapter-7-Parallel-Parking', 'Chapter-8-Defensive-Driving', 'Chapter-9-Alcohol-and-Other-Drugs',
         'Chapter-10-Special-Driving-Conditions', 'Chapter-11-Sharing-the-Road', 'Road-Signs-You-Need-To-Know']
out = []
for n in ORDER:
    d = json.load(open(f'data/{n}.json'))
    qs = []
    for q in d['questions']:
        text = q['question']
        imgs = ['img/' + os.path.basename(u) for u in q['images']]
        if imgs:
            text = re.sub(r'\s*\([^)]*\)', '', text)
        qs.append({'id': f"{d['questions'][0]['name'].split('-')[1]}-{q['qid']}", 'q': text, 'img': imgs[0] if imgs else None,
                   'options': [o['text'].strip() for o in q['options']],
                   'answer': next(i for i, o in enumerate(q['options']) if o['value'] == q['answer'])})
    out.append({'id': n, 'title': d['title'], 'questions': qs})
open('app/data.js', 'w').write('window.DMV_DATA = ' + json.dumps(out, indent=1, ensure_ascii=False) + ';\n')
print(sum(len(c['questions']) for c in out), 'questions')
