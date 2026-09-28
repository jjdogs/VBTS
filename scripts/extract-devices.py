"""
Regenerates src/engine/data/devices.json from Epic's Fortnite Verse API digest.

The digest comes from a Markdown mirror of Epic's official docs:
  git clone --depth 1 https://github.com/LilWikipedia/UEFNVersePocketWiki digest
  python3 scripts/extract-devices.py digest/fortnite-digest.md

For each Creative device it keeps:
  e: events and what they send ('agent', '?agent', or 'none' for tuple())
  m: actions with no inputs, or a single agent ("Name(Agent)"). Failable (<decides>) ones are skipped.
"""
import json, re, sys

src = open(sys.argv[1]).read()
section = src[src.index('## creative\\_devices'):src.index('## vehicles')]
starts = list(re.finditer(r"`(\w+_device)<public> := class[^`]*`", section))
catalog = {}
for i, m in enumerate(starts):
    name = m.group(1)
    body = section[m.end(): starts[i + 1].start() if i + 1 < len(starts) else len(section)]
    events, methods = {}, []
    for ev, payload in re.findall(r"`(\w+Event)<public>:listenable\(([^)]*\)?)\)", body):
        payload = payload.strip()
        if payload in ('agent', '?agent'):
            events[ev] = payload
        elif payload.startswith('tuple('):
            events[ev] = 'none'
    for fn, args, effects in re.findall(r"`([A-Z]\w*)<public>\(([^)]*)\)((?:<[^>]+>)*):void", body):
        if 'decides' in effects:
            continue
        if args == '':
            methods.append(fn + '()')
        elif args == 'Agent:agent':
            methods.append(fn + '(Agent)')
    methods = list(dict.fromkeys(methods))
    if events or methods:
        catalog[name] = {'e': events, 'm': methods}

out = 'src/engine/data/devices.json'
json.dump(catalog, open(out, 'w'), separators=(',', ':'))
print(f'{len(catalog)} devices written to {out}')
