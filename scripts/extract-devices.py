"""
Regenerates src/engine/data/devices.json from Epic's Fortnite Verse API digest.

The digest comes from a Markdown mirror of Epic's official docs:
  git clone --depth 1 https://github.com/LilWikipedia/UEFNVersePocketWiki digest
  python3 scripts/extract-devices.py digest/fortnite-digest.md

For each Creative device it keeps:
  e: events and what they send: a type ('agent', '?agent', 'device_ai_interaction_result'…),
     or 'none' for tuple()
  m: actions with no inputs, or a single agent ("Name(Agent)").
  a: actions with simple inputs, written as Verse declares them ("SetTextSize(Size:int)").
     Only int, float, logic, string and agent inputs; none optional.
  Failable (<decides>) and <suspends> actions are skipped.
"""
import json, re, sys

src = open(sys.argv[1]).read()
section = src[src.index('## creative\\_devices'):src.index('## vehicles')]
starts = list(re.finditer(r"`(\w+_device)<public> := class[^`]*`", section))
catalog = {}
# A required input of a simple type: Name:int, Name:float, Name:logic, Name:string, Name:agent
SIMPLE_PARAM = r"[A-Z]\w*:(int|float|logic|string|agent)"
for i, m in enumerate(starts):
    name = m.group(1)
    body = section[m.end(): starts[i + 1].start() if i + 1 < len(starts) else len(section)]
    events, methods, with_inputs = {}, [], []
    for ev, payload in re.findall(r"`(\w+Event)<public>:listenable\(([^)]*\)?)\)", body):
        payload = payload.strip()
        if payload.startswith('tuple('):
            events[ev] = 'none'
        elif re.fullmatch(r"\??[a-z_]\w*", payload):
            events[ev] = payload
    for fn, args, effects in re.findall(r"`([A-Z]\w*)<public>\(([^)]*)\)((?:<[^>]+>)*):void", body):
        if 'decides' in effects or 'suspends' in effects:
            continue
        if args == '':
            methods.append(fn + '()')
        elif args == 'Agent:agent':
            methods.append(fn + '(Agent)')
        else:
            params = [p.strip() for p in args.split(',')]
            if all(re.fullmatch(SIMPLE_PARAM, p) for p in params):
                with_inputs.append(f"{fn}({', '.join(params)})")
    methods = list(dict.fromkeys(methods))
    with_inputs = list(dict.fromkeys(with_inputs))
    if events or methods or with_inputs:
        catalog[name] = {'e': events, 'm': methods}
        if with_inputs:
            catalog[name]['a'] = with_inputs

out = 'src/engine/data/devices.json'
json.dump(catalog, open(out, 'w'), separators=(',', ':'))
print(f'{len(catalog)} devices written to {out}')
