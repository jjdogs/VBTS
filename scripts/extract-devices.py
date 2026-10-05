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
Devices also get what they inherit from parent devices (trigger_device gets Enable() and
Reset() from trigger_base_device). Abstract base devices are left out (they can't be placed),
and the vehicle spawners are included.
"""
import json, re, sys

src = open(sys.argv[1]).read()
section = src[src.index('## creative\\_devices'):src.index('## Teams')]
# A few declarations lost their name in the digest ("`<public> := class…`"); the heading above has it.
section = re.sub(r"### (\w+(?:\\_\w+)*)\n\n`<public> :=",
                 lambda m: f"### {m.group(1)}\n\n`{m.group(1).replace(chr(92), '')}<public> :=", section)
starts = list(re.finditer(r"`(\w+_device)<public> := class(?:<\w+>)*\(([^)]*)\)[^`]*`", section))
# Any other declaration ends a device's members too (fort_vehicle's come after the last spawner).
ends = [m.start() for m in re.finditer(r"`[\w<>]+ := (?:class|interface|struct)", section)] + [len(section)]
# The digest lists vehicle_spawner_device's own members under the first spawner after it.
OWNER = {'vehicle_spawner_sports_car_device': 'vehicle_spawner_device'}
own, parent, abstract = {}, {}, set()
# A required input of a simple type: Name:int, Name:float, Name:logic, Name:string, Name:agent
SIMPLE_PARAM = r"[A-Z]\w*:(int|float|logic|string|agent)"
for i, m in enumerate(starts):
    name = m.group(1)
    parent[name] = m.group(2).split(',')[0].strip()
    if '<abstract>' in m.group(0):
        abstract.add(name)
    body = section[m.end(): min(e for e in ends if e > m.start())]
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
    owner = OWNER.get(name, name)
    old = own.get(owner, ({}, [], []))
    own[owner] = ({**old[0], **events}, old[1] + methods, old[2] + with_inputs)
    own.setdefault(name, ({}, [], []))

catalog = {}
for name in own:
    if name in abstract:  # base classes can't be placed; their members go to the devices above
        continue
    # Parents first, so inherited members come before the device's own ones.
    chain, p = [], name
    while p in own:
        chain.insert(0, p)
        p = parent[p]
    events, methods, with_inputs = {}, [], []
    for c in chain:
        events.update(own[c][0]); methods += own[c][1]; with_inputs += own[c][2]
    methods = list(dict.fromkeys(methods))
    with_inputs = list(dict.fromkeys(with_inputs))
    if events or methods or with_inputs:
        catalog[name] = {'e': events, 'm': methods}
        if with_inputs:
            catalog[name]['a'] = with_inputs

out = 'src/engine/data/devices.json'
json.dump(catalog, open(out, 'w'), separators=(',', ':'))
print(f'{len(catalog)} devices written to {out}')
