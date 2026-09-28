/**
 * Phase 5.2 (positions & movement) and 5.3 (UI widgets): blocks, converter, checks, lessons
 * and the parkour and shop templates.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CANVAS_POSITIONS, canvasCode } from '../src/engine/data/ui.ts';
import { engine, generateFrom } from './helpers.ts';

function convert(src: string) {
  const parsed = engine.parseVerse(src);
  assert.ok(parsed.ok, parsed.ok ? '' : parsed.error);
  const r = generateFrom(parsed.state);
  return { ...r, raw: parsed.report.raw, blocks: JSON.stringify(parsed.state), errors: r.warnings.filter(w => w.level === 'error').map(w => w.msg) };
}
const stable = (code: string) => assert.equal(convert(code).code, code, 'round trip');
const hasBlocks = (r: { blocks: string }, ...types: string[]) => { for (const t of types) assert.ok(r.blocks.includes(`"${t}"`), t); };
/** A device with a linked button whose OnPressed(Agent) holds these lines. */
const pressed = (lines: string[], members: string[] = [], extra = '') => `my_device := class(creative_device):
    @editable
    MyButton:button_device = button_device{}
${members.map(l => `    ${l}\n`).join('')}
    OnBegin<override>()<suspends>:void =
        MyButton.InteractedWithEvent.Subscribe(OnPressed)

    OnPressed(Agent:agent):void =
${lines.map(l => `        ${l}\n`).join('')}${extra}`;

describe('positions and movement', () => {
  test('positions, rotations, transforms, distances and teleports become blocks', () => {
    const r = convert(pressed([
      'if (FortChar := Agent.GetFortCharacter[]):',
      '    Here := FortChar.GetTransform().Translation',
      '    Spot := vector3{X := 100.0, Y := 0.0, Z := Here.Z + 200.0}',
      '    if (Distance(Here, Goal.GetTransform().Translation) < 500.0):',
      '        if (FortChar.TeleportTo[Spot, MakeRotationFromYawPitchRollDegrees(90.0, 0.0, 0.0)]):',
      '            Print("moved")',
      '    if (FortChar.GetTransform().Translation.Z < 0.0):',
      '        if (FortChar.TeleportTo[Goal.GetTransform().Translation, IdentityRotation()]):',
      '            Print("saved")',
    ], ['@editable', 'Goal:trigger_device = trigger_device{}']));
    assert.deepEqual(r.raw, []);
    hasBlocks(r, 'verse_transform_of', 'verse_vector', 'verse_distance', 'verse_teleport', 'verse_rotation', 'verse_identity_rotation', 'verse_vector_part');
    assert.match(r.code, /using \{ \/UnrealEngine\.com\/Temporary\/SpatialMath \}/);
    assert.deepEqual(r.errors, []);
    stable(r.code);
  });

  test('a linked prop moves over time in a loop without a "never waits" warning', () => {
    const r = convert(`my_device := class(creative_device):
    @editable
    Platform:creative_prop = creative_prop{}

    OnBegin<override>()<suspends>:void =
        Start := Platform.GetTransform().Translation
        loop:
            Platform.MoveTo(vector3{X := 0.0, Y := 0.0, Z := 500.0}, IdentityRotation(), 2.0)
            Platform.MoveTo(Start, IdentityRotation(), 2.0)
`);
    assert.deepEqual(r.raw, []);
    hasBlocks(r, 'verse_move_to');
    assert.ok(r.blocks.includes('"DTYPE":"creative_prop"'), 'creative_prop can be linked');
    assert.deepEqual(r.warnings.filter(w => w.level !== 'tip').map(w => w.msg), []);
    stable(r.code);
  });

  test('MoveTo outside suspending code, TeleportTo outside an if, and int positions are reported', () => {
    const r = convert(pressed(['if (FortChar := Agent.GetFortCharacter[]):',
      '    if (FortChar.TeleportTo[vector3{X := 1, Y := 0.0, Z := 0.0}, IdentityRotation()]):', '        Print("x")',
      '    Moved := FortChar.TeleportTo[vector3{X := 0.0, Y := 0.0, Z := 0.0}, IdentityRotation()]',
      'Platform.MoveTo(vector3{X := 0.0, Y := 0.0, Z := 1.0}, IdentityRotation(), 2.0)'],
      ['@editable', 'Platform:creative_prop = creative_prop{}']));
    const msgs = r.warnings.map(w => w.msg);
    assert.ok(msgs.some(m => m.includes('TeleportTo[…] can fail')), msgs.join(' | '));
    assert.ok(msgs.some(m => m.includes('MoveTo waits until the prop arrives')), msgs.join(' | '));
    assert.ok(msgs.some(m => m.includes('X of a position is a float')), msgs.join(' | '));
  });
});

describe('UI widgets', () => {
  test('every canvas position round-trips', () => {
    for (const pos of Object.keys(CANVAS_POSITIONS)) {
      const r = convert(pressed(['if (Player := player[Agent]):', '    if (UI := GetPlayerUI[Player]):',
        `        UI.AddWidget(${canvasCode(pos, 'text_block{DefaultText := MakeMessage("Hi")}')})`]));
      assert.deepEqual(r.raw, [], pos);
      assert.ok(r.blocks.includes(`"POS":"${pos}"`), pos);
      stable(r.code);
    }
  });

  test('a player UI, buttons, clicks, text changes and hiding become blocks', () => {
    const r = convert(pressed([
      'if (Player := player[Agent]):',
      '    if (UI := GetPlayerUI[Player]):',
      '        Label := text_block{DefaultText := MakeMessage("Score: 0")}',
      '        ClickButton := button_regular{DefaultText := MakeMessage("Go")}',
      '        ClickButton.OnClick().Subscribe(OnClicked)',
      `        UI.AddWidget(${canvasCode('bottom', 'ClickButton')}, player_ui_slot{InputMode := ui_input_mode.All})`,
      `        UI.AddWidget(${canvasCode('top_right', 'Label')})`,
      '        Label.SetText(MakeMessage("Score: 1"))',
      '        UI.RemoveWidget(Label)',
    ], ['@editable', 'MyGranter:item_granter_device = item_granter_device{}'], `
    OnClicked(Message:widget_message):void =
        Player := Message.Player
        MyGranter.GrantItem(Player)
`));
    assert.deepEqual(r.raw, []);
    hasBlocks(r, 'verse_player_ui', 'verse_text_widget', 'verse_button_widget', 'verse_canvas', 'verse_ui_widget', 'verse_widget_text', 'verse_message_player');
    assert.ok(r.blocks.includes('"ACTION":"AddWidgetClick"'));
    assert.ok(r.blocks.includes('"PARAM":"widget"'));
    assert.match(r.code, /using \{ \/UnrealEngine\.com\/Temporary\/UI \}/);
    assert.match(r.code, /using \{ \/Fortnite\.com\/UI \}/);
    assert.deepEqual(r.errors, [], 'Player := Message.Player counts as a Player');
    stable(r.code);
  });

  test('GetPlayerUI with an agent, and Message outside a click handler, are reported', () => {
    const r = convert(pressed(['if (UI := GetPlayerUI[Agent]):', '    Print("x")', 'Print("{Message.Player}")']));
    const msgs = r.warnings.map(w => w.msg);
    assert.ok(msgs.some(m => m.includes('GetPlayerUI needs a player, not an agent')), msgs.join(' | '));
    assert.ok(msgs.some(m => m.includes('No Message here')), msgs.join(' | '));
  });
});

describe('lessons and templates', () => {
  const lesson = (title: string) => engine.LESSONS.find(l => l.title === title)!;
  const passes = (title: string, src: string) => {
    const r = convert(src);
    assert.deepEqual(r.errors, [], title);
    assert.ok(lesson(title).check(r.code, r), `${title}:\n${r.code}`);
  };
  const clickLesson = (extra: string[] = [], members: string[] = []) => pressed([
    'if (Player := player[Agent]):', '    if (UI := GetPlayerUI[Player]):',
    '        ClickButton := button_loud{DefaultText := MakeMessage("Click me")}',
    '        ClickButton.OnClick().Subscribe(OnClicked)',
    `        UI.AddWidget(${canvasCode('center', 'ClickButton')}, player_ui_slot{InputMode := ui_input_mode.All})`,
  ], members, `
    OnClicked(Message:widget_message):void =
${['Print("Clicked!")', ...extra].map(l => `        ${l}\n`).join('')}`);

  test('lesson "Back to the start"', () => passes('Back to the start', pressed([
    'if (FortChar := Agent.GetFortCharacter[]):',
    '    if (FortChar.TeleportTo[StartPad.GetTransform().Translation, IdentityRotation()]):',
    '        Print("Whoosh!")',
  ], ['@editable', 'StartPad:player_spawner_device = player_spawner_device{}'])));

  test('lesson "Moving platform"', () => passes('Moving platform', `my_device := class(creative_device):
    @editable
    Platform:creative_prop = creative_prop{}

    OnBegin<override>()<suspends>:void =
        spawn{MovePlatform()}

    MovePlatform()<suspends>:void =
        Start := Platform.GetTransform().Translation
        loop:
            Platform.MoveTo(vector3{X := 0.0, Y := 0.0, Z := 500.0}, IdentityRotation(), 2.0)
            Platform.MoveTo(Start, IdentityRotation(), 2.0)
`));

  test('lesson "Close enough"', () => passes('Close enough', pressed([
    'if (FortChar := Agent.GetFortCharacter[]):',
    '    if (Distance(FortChar.GetTransform().Translation, Goal.GetTransform().Translation) < 500.0):',
    '        MyGranter.GrantItem(Agent)',
  ], ['@editable', 'MyGranter:item_granter_device = item_granter_device{}', '@editable', 'Goal:trigger_device = trigger_device{}'])));

  test('lesson "Your own HUD"', () => passes('Your own HUD', pressed([
    'if (Player := player[Agent]):', '    if (UI := GetPlayerUI[Player]):',
    `        UI.AddWidget(${canvasCode('top', 'text_block{DefaultText := MakeMessage("Hello, you!")}')})`,
  ])));

  test('lesson "Click me"', () => passes('Click me', clickLesson()));

  test('lesson "Reward the clicker"', () => passes('Reward the clicker',
    clickLesson(['Player := Message.Player', 'MyGranter.GrantItem(Player)'], ['@editable', 'MyGranter:item_granter_device = item_granter_device{}'])));

  for (const id of ['platform_parkour', 'shop_menu']) {
    test(`the ${id} template converts with no warnings`, () => {
      const r = convert(engine.TEMPLATES.find(x => x.id === id)!.verse);
      assert.deepEqual(r.raw, []);
      assert.deepEqual(r.warnings.filter(w => w.level !== 'tip').map(w => w.msg), []);
    });
  }
});
