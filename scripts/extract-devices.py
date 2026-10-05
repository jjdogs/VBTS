"""
Regenerates src/engine/data/devices.json from the snapshot of Epic's Verse API reference
(scripts/data/verse-api-devices.json, written by scripts/fetch-verse-api.py):

  python3 scripts/fetch-verse-api.py
  python3 scripts/extract-devices.py

For each Creative device it keeps:
  e: events and what they send: a type ('agent', '?agent', 'fort_vehicle'…), or 'none'
  m: actions with no inputs, or a single agent ("Name(Agent)").
  a: actions with simple inputs, written as Verse declares them ("SetTextSize(Size:int)").
     Only int, float, logic, string and agent inputs; none optional.
  u: the device's using path, when it isn't /Fortnite.com/Devices.
Failable (<decides>) and <suspends> actions are skipped, and so are abstract base devices
(they can't be placed).

The reference shows every event's type as "listenable(payload)", so what an event sends is kept
from the current devices.json, or read from the event's description for new events. New events
and anything else worth checking are printed, so a person can review them.
"""
import json, re, sys

SNAPSHOT = sys.argv[1] if len(sys.argv) > 1 else 'scripts/data/verse-api-devices.json'
OUT = 'src/engine/data/devices.json'
DEFAULT_MODULE = '/Fortnite.com/Devices'

# Base classes you can't place. The reference doesn't mark a class abstract, so these are
# known ones (from Epic's API digest) plus any device whose description starts "Base class".
ABSTRACT = {
    'base_item_spawner_device', 'effect_volume_device', 'gameplay_camera_device', 'gameplay_controls_device',
    'physics_object_base_device', 'powerup_device', 'prop_spawner_base_device', 'storm_controller_device',
    'trigger_base_device', 'vehicle_spawner_device',
}
NOT_DEVICES = {'creative_device'}  # the class your own Verse devices extend

# A required input of a simple type: Name:int, Name:float, Name:logic, Name:string, Name:agent
SIMPLE_PARAM = r"[A-Z]\w*:(int|float|logic|string|agent)"
# What an event's description says it sends → the type. Order matters: the first match wins.
SENDS = [
    (r'\bSource is\b|\bTarget is\b', 'device_ai_interaction_result'),
    (r'\bReturns? (?:false|an? agent) if\b|\bfalse if no agent\b|\boptional agent\b', '?agent'),
    (r'\bSends the (?:agent|player)\b|\bSends an? agent\b|\bSends the \w+ agent\b|\bagent (?:that|who)\b.*\bSends\b', 'agent'),
    (r'\bSends the fort_vehicle\b', 'fort_vehicle'),
]

snapshot = json.load(open(SNAPSHOT, encoding='utf-8'))
try:
    previous = json.load(open(OUT, encoding='utf-8'))
except FileNotFoundError:
    previous = {}
review = []


def sends(device: str, event: str, doc: str) -> str:
    known = previous.get(device, {}).get('e', {}).get(event)
    if known:
        return known
    # The same event on another device (e.g. a shared base class) usually sends the same thing.
    elsewhere = {d['e'][event] for d in previous.values() if event in d.get('e', {})}
    guess = next((t for pattern, t in SENDS if re.search(pattern, doc)), 'none' if not re.search(r'\bSends\b', doc) else None)
    if len(elsewhere) == 1 and (guess is None or guess in elsewhere):
        guess = elsewhere.pop()
    if guess is None:
        review.append(f'{device}.{event}: sends something unrecognised, skipped ("{doc}")')
        return ''
    review.append(f'{device}.{event}: new event, sends {guess} (from: "{doc}")')
    return guess


def keep_order(old: list, new: list) -> list:
    """Members already listed stay where they were (dropdowns don't reshuffle); new ones go last."""
    return [x for x in old if x in new] + sorted(x for x in new if x not in old)


catalog = {}
for name, info in snapshot.items():
    if name in NOT_DEVICES or name in ABSTRACT or info.get('doc', '').startswith('Base class'):
        continue
    events = {}
    for ev, doc in info['events'].items():
        t = sends(name, ev, doc)
        if t:
            events[ev] = t
    methods, with_inputs = [], []
    for sig in info['functions']:
        m = re.fullmatch(r'([A-Z]\w*)((?:<\w+>)*)\(([^)]*)\)((?:<\w+>)*):void', sig)
        if not m or '<public>' not in m.group(2) or '<override>' in m.group(2):
            continue
        fn, args, effects = m.group(1), m.group(3), m.group(4)
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
    old = previous.get(name, {})
    if events or methods or with_inputs:
        entry = {'e': {k: events[k] for k in keep_order(list(old.get('e', {})), list(events))},
                 'm': keep_order(old.get('m', []), list(dict.fromkeys(methods)))}
        actions = keep_order(old.get('a', []), list(dict.fromkeys(with_inputs)))
        if actions:
            entry['a'] = actions
        if info['module'] and info['module'] != DEFAULT_MODULE:
            entry['u'] = info['module']
        catalog[name] = entry

# Report what changed, so the pull request says it.
for name in sorted(set(previous) | set(catalog)):
    if name not in catalog:
        review.append(f'{name}: removed (no longer in the reference)')
    elif name not in previous:
        review.append(f'{name}: new device')
    else:
        for key, label in (('m', 'action'), ('a', 'action'), ('e', 'event')):
            gone = [x for x in previous[name].get(key, []) if x not in catalog[name].get(key, [])]
            if gone:
                review.append(f'{name}: {label}s no longer in the reference: {", ".join(gone)}')

with open(OUT, 'w', encoding='utf-8') as out:
    json.dump(catalog, out, separators=(',', ':'))
print(f'{len(catalog)} devices written to {OUT}')
for line in review:
    print('  ' + line)
