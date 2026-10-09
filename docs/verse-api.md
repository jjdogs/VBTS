# Verse API data

[← Back to the README](../README.md)

Verse Blocks knows Epic's API from two sources, both kept in this repository:

| Source | What it gives | Where |
|---|---|---|
| **Epic's Verse API reference** (https://dev.epicgames.com/documentation/fortnite/verse-api) | every Creative device, its events and actions, its module | snapshot in `scripts/data/verse-api-devices.json` |
| **Epic's API digests** (copied from a UEFN project) | exact signatures and types for everything, including what each event sends | `scripts/data/digest/` (currently Fortnite 42.30) |

The Verse book (https://verselang.github.io/book) covers the language itself.

## The device list

`src/engine/data/devices.json` is generated. Don't edit it by hand:

```bash
npm run api        # scripts/fetch-verse-api.py: reads the reference into the snapshot (cached in .cache/)
npm run devices    # scripts/extract-devices.py: builds devices.json and prints what changed
```

For each device it keeps its events and what each one sends, its actions with no inputs or one
agent, its actions with simple inputs (int, float, logic, string, agent), and its `using` path when
it isn't `/Fortnite.com/Devices` (Patchwork devices). Base classes you can't place are left out,
and so are failable and `<suspends>` actions. A device stays listed once it is, so saved projects
keep working.

Epic's web reference shows every event as `listenable(payload)`, so **what an event sends comes from
the digest**. Events newer than the digest have their type read from their description, and the
report says so. Events that send a type blocks can't receive yet are left out, with the reason in
the report.

## The digests

`scripts/data/digest/` holds three files from UEFN:

- `Fortnite.digest.verse`: `/Fortnite.com/…`, every device, character, team, UI and game API;
- `UnrealEngine.digest.verse`: `/UnrealEngine.com/…`, SpatialMath (`vector3`, `rotation`,
  `transform`), the UI base types and diagnostics;
- `Verse.digest.verse`: `/Verse.org/…`, the built-in library (`agent`, `team`, `Sleep`, random,
  colours, concurrency).

`tests/digest.test.ts` checks the Verse the blocks write against them: every type's module, the
`using` list, handler inputs, value events, and the signature of each function a block calls.

**To update them** (after a big Fortnite update, or when the weekly sync says an event isn't in the
digest):

1. In UEFN, open your project's Verse files in VS Code. The digests are in the file list under
   *Fortnite.com*, *UnrealEngine.com* and *Verse.org*; right-click one → *Reveal in File Explorer*.
2. Copy the three `.digest.verse` files over the ones in `scripts/data/digest/`.
3. Run `npm run devices`, then `npm test`. The digest test names anything Epic moved, renamed or
   changed; fix those in the blocks or data it points to.
4. Update "currently Fortnite 42.30" at the top of this page to the new build (it's in the files'
   first lines: `Generated from build: …`).

## The weekly Verse API sync

Every Monday at 06:17 UTC the *Verse API sync* workflow (`.github/workflows/verse-api.yml`) runs
both scripts on `dev`. When Epic's reference changed, it opens (or updates) a pull request into
`dev` from the `verse-api-sync` branch, listing new devices, actions and events, with the result of
the type-check, tests and build. Nothing is merged automatically: check the list (especially events
typed from their description), then merge it. You can also run it by hand: **Actions → Verse API
sync → Run workflow**.

It needs **Settings → Actions → General → "Allow GitHub Actions to create and approve pull
requests"** turned on.
