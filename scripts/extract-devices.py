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
# What an event's description says it sends → the type ('' = a type blocks can't receive).
# The first match wins; they are checked against every event whose type is known.
SENDS = [
    (r'(?i)\btuple\b|\b(?:Sends|and) the (?:int|float|logic|string)\b', ''),  # more than one value
    (r'\bSource is\b.*\bTarget is\b', 'device_ai_interaction_result'),
    (r'\bfort_vehicle\b', 'fort_vehicle'),
    (r'(?i)\b(?:Sends|passing|Returns|returning|Includes)\b.*\bagent\b.*(?:\bfalse\b|\bif (?:any|applicable)\b)'
     r'|\bfalse\b.*\bagent\b|\bReturns an? agent if\b', '?agent'),
    (r'(?i)\b(?:Sends|passing)\b.*\b(?:agent|player)\b|\bReturns the \w+ agent\b', 'agent'),
    # No "Sends" and no one mentioned: it sends nothing. Mentioning an agent without saying it's sent
    # is unclear (most such events do send the agent).
    (r'(?i)^(?=.*\w)(?!.*\b(?:Sends|passing|Returns|agents?|players?|guards?|creative_prop|vehicle|value)\b)', 'none'),
]


def described(doc: str):
    """The type an event's description says it sends, or None if it isn't clear."""
    doc = re.sub(r"[`']", ' ', doc)
    return next((t for pattern, t in SENDS if re.search(pattern, doc)), None)


snapshot = json.load(open(SNAPSHOT, encoding='utf-8'))
try:
    previous = json.load(open(OUT, encoding='utf-8'))
except FileNotFoundError:
    previous = {}
review = []
# Inherited events have the same name and description on every device that has them, so a known
# type carries over (every vehicle spawner's DestroyedEvent: "Signaled when a vehicle is destroyed.").
same_event: dict = {}
for _device, _entry in previous.items():
    for _event, _type in _entry.get('e', {}).items():
        _doc = snapshot.get(_device, {}).get('events', {}).get(_event)
        if _doc is not None:
            same_event.setdefault((_event, _doc), set()).add(_type)


def sends(device: str, event: str, doc: str) -> str:
    guess = described(doc)
    known = previous.get(device, {}).get('e', {}).get(event)
    if known and guess != '':
        return known
    inherited = same_event.get((event, doc), set())
    if len(inherited) == 1 and guess != '':
        return next(iter(inherited))
    if guess is None:
        review.append(f'{device}.{event}: unclear what it sends, left out ("{doc}")')
        return ''
    if guess == '':
        review.append(f'{device}.{event}: sends a type blocks can\'t receive yet, left out ("{doc}")')
        return ''
    review.append(f'{device}.{event}: new event, sends {guess} (from: "{doc}")')
    return guess


def keep_order(old: list, new: list) -> list:
    """Members already listed stay where they were (dropdowns don't reshuffle); new ones go last."""
    return [x for x in old if x in new] + sorted(x for x in new if x not in old)


catalog, base_classes = {}, set()
for name, info in snapshot.items():
    if name in NOT_DEVICES:
        continue
    if name in ABSTRACT or info.get('doc', '').startswith('Base class'):
        base_classes.add(name)
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
    if name in base_classes and name in previous:
        review.append(f'{name}: left out, it is a base class ("{snapshot[name]["doc"]}")')
    elif name not in catalog:
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
