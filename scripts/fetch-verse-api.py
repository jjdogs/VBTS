"""
Reads Epic's live Verse API reference (https://dev.epicgames.com/documentation/fortnite/verse-api)
and writes a snapshot of every Creative device to scripts/data/verse-api-devices.json:

  python3 scripts/fetch-verse-api.py             # pages are cached in .cache/verse-api
  python3 scripts/fetch-verse-api.py --refresh   # fetch every page again

Then scripts/extract-devices.py turns the snapshot into src/engine/data/devices.json.
The weekly workflow (.github/workflows/verse-api.yml) runs both and opens a pull request into
dev when anything changed.

For each device the snapshot keeps:
  module:    its using path ("/Fortnite.com/Devices", "/Fortnite.com/Devices/Patchwork"…)
  parent:    the class it derives from
  doc:       the first line of its description
  events:    event name → its description (the reference shows every event's type as
             "listenable(payload)", so extract-devices.py works out what each one sends)
  functions: every function it has, inherited ones included, as Verse declares them
"""
import argparse, hashlib, html, json, os, re, sys, threading, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor

SITE = 'https://dev.epicgames.com'
ROOT = '/documentation/fortnite/verse-api/fortnitedotcom/devices'
OUT = 'scripts/data/verse-api-devices.json'

args = argparse.ArgumentParser()
args.add_argument('--cache', default='.cache/verse-api')
args.add_argument('--refresh', action='store_true', help='ignore cached pages')
args.add_argument('--delay', type=float, default=0.2, help='seconds each worker waits between requests')
args.add_argument('--workers', type=int, default=4, help='pages fetched at the same time')
args.add_argument('--out', default=OUT)
opts = args.parse_args()
os.makedirs(opts.cache, exist_ok=True)
fetched = 0
lock = threading.Lock()
pool = ThreadPoolExecutor(opts.workers)


def get(path: str) -> str:
    """One page of the reference, from the cache when we have it."""
    global fetched
    file = os.path.join(opts.cache, hashlib.sha1(path.encode()).hexdigest() + '.html')
    if not opts.refresh and os.path.exists(file):
        return open(file, encoding='utf-8').read()
    for attempt in range(4):
        try:
            time.sleep(opts.delay)
            req = urllib.request.Request(SITE + path, headers={'User-Agent': 'verse-blocks-api-sync (github.com/jjdogs/VBTS)'})
            page = urllib.request.urlopen(req, timeout=60).read().decode('utf-8')
            break
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return ''
            if attempt == 3:
                raise
            time.sleep(2 ** attempt * 2)
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
            time.sleep(2 ** attempt * 2)
    with lock:
        fetched += 1
        if fetched % 100 == 0:
            print(f'  {fetched} pages fetched…', file=sys.stderr)
    open(file, 'w', encoding='utf-8').write(page)
    return page


def text(fragment: str) -> str:
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', fragment)).split())


def kind(page: str) -> str:
    """'module', 'class', 'function', 'enum'… from the page title."""
    m = re.search(r'<title>Verse API reference page for the \S+ (\w+)', page)
    return m.group(1) if m else ''


def section(page: str, heading_id: str) -> str:
    """The HTML from <h2|h3 id=heading_id> to the next heading of any level."""
    m = re.search(rf'<h[23] id="{heading_id}">(.*?)(?=<h[1-6][ >]|$)', page, re.S)
    return m.group(1) if m else ''


def rows(fragment: str) -> list:
    return [re.findall(r'<td>(.*?)</td>', r, re.S) for r in re.findall(r'<tr>(.*?)</tr>', fragment, re.S)]


def using(page: str) -> str:
    m = re.search(r'<code>using \{ ([^}]+?) \}</code>', page)
    return m.group(1) if m else ''


def links_under(page: str, base: str) -> list:
    return sorted(set(re.findall(rf'href="({re.escape(base)}/[^"#?]+)"', page)))


def signature(path: str, name: str) -> str:
    """The Verse declaration on a function's page: "Enable<public>():void"."""
    page = get(path)
    # Type names are links, so a declaration spans several <code> tags in one paragraph.
    for para in re.findall(r'<p>(<code>.*?)</p>', page, re.S):
        sig = html.unescape(re.sub(r'<[^>]+>', '', para)).strip()
        if sig.startswith(name + '<') or sig.startswith(name + '('):
            return sig
    return ''


def device(path: str, page: str) -> dict:
    hierarchy = rows(section(page, 'inheritancehierarchy'))
    intro = re.search(r'<h1>.*?</h1>(.*?)<div class="table-responsive">', page, re.S)
    doc = text(intro.group(1)) if intro else ''
    doc = re.sub(r'^.*?On this page\s*', '', doc)
    doc = re.sub(r'^Verse path: \S+\s*', '', doc)
    events = {}
    for cells in rows(section(page, 'data')):
        if len(cells) == 3 and text(cells[1]).startswith('listenable'):
            events[text(cells[0])] = text(cells[2])
    calls = []
    for cells in rows(section(page, 'functions')):
        link = re.search(r'href="([^"#?]+)"', cells[0]) if cells else None
        if link:
            calls.append((link.group(1), text(cells[0])))
    functions = [sig for sig in pool.map(lambda c: signature(*c), calls) if sig]
    return {
        'module': using(page),
        'parent': text(hierarchy[-1][0]) if hierarchy else '',
        'doc': doc.split('. ')[0].rstrip('.') + '.' if doc else '',
        'events': dict(sorted(events.items())),
        'functions': sorted(set(functions)),
    }


def crawl(path: str, devices: dict) -> None:
    page = get(path)
    links = [l for l in links_under(page, path) if l.count('/') == path.count('/') + 1]
    # Only module pages and *_device class pages matter; skip the rest without fetching them.
    links = [l for l in links if l.endswith('_device') or '_' not in l.rsplit('/', 1)[1]]
    for link, sub in zip(links, pool.map(get, links)):
        name = link.rsplit('/', 1)[1]
        k = kind(sub)
        if k == 'module':
            crawl(link, devices)
        elif k == 'class' and name.endswith('_device') and name not in devices:
            devices[name] = device(link, sub)
            print(f'{name}: {len(devices[name]["events"])} events, {len(devices[name]["functions"])} functions', file=sys.stderr)


devices: dict = {}
crawl(ROOT, devices)
if len(devices) < 100:
    sys.exit(f'Only {len(devices)} devices found: the reference may have changed shape. Nothing written.')
os.makedirs(os.path.dirname(opts.out), exist_ok=True)
with open(opts.out, 'w', encoding='utf-8') as out:
    json.dump(dict(sorted(devices.items())), out, indent=1, ensure_ascii=False)
    out.write('\n')
print(f'{len(devices)} devices written to {opts.out} ({fetched} pages fetched)')
