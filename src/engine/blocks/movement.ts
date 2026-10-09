/**
 * Phase 5.2: positions and movement (SpatialMath). Positions (vector3), rotations, where things
 * are (GetTransform), distances, teleporting (failable) and moving props over time (<suspends>).
 *
 *   Top := vector3{X := 0.0, Y := 0.0, Z := 800.0}
 *   Platform.MoveTo(Top, Platform.GetTransform().Rotation, 3.0)
 *   if (FortChar.TeleportTo[StartPad.GetTransform().Translation, IdentityRotation()]):
 *   if (Distance(FortChar.GetTransform().Translation, Goal.GetTransform().Translation) < 500.0):
 */
import Blockly from '../blockly.ts';
import type { Block } from '../blockly.ts';
import { COLORS, DOCS } from '../data/modules.ts';
import { formatFloat, Order, type VerseGenerator } from '../generator/verse-generator.ts';
import { defineBlock } from '../registry.ts';
import { inSuspends } from '../workspace.ts';
import { checkFailable, FAILABLE } from './data.ts';
import { COND } from './logic.ts';
import { asStatement, f } from './shared.ts';

export const SPATIAL = '/UnrealEngine.com/Temporary/SpatialMath';
/** Keyframe animation for props (animation_controller, keyframe_delta, animation_mode). */
export const ANIMATION = '/Fortnite.com/Devices/CreativeAnimation';

/** A float input: its code (or 0.0), with a warning when an int number is plugged in. */
export function floatInput(g: VerseGenerator, b: Block, input: string, what: string): string {
  const target = b.getInputTargetBlock(input);
  if (target?.type === 'verse_number' && f(target, 'TYPE') === 'int') {
    g.warn(b, `${what} is a float in Verse: write ${formatFloat(target.getFieldValue('NUM'))}, not ${Math.trunc(Number(target.getFieldValue('NUM')))} (set the number block to float).`);
  }
  return g.valueToCode(b, input, Order.NONE) || '0.0';
}

/** A value input that must be plugged in (with a friendly default so the code keeps its shape). */
function required(g: VerseGenerator, b: Block, input: string, what: string, fallback: string): string {
  const code = g.valueToCode(b, input, Order.ATOMIC);
  if (!code) g.warn(b, `Plug in ${what}.`);
  return code || fallback;
}

export function registerMovementBlocks(): void {
  defineBlock({
    type: 'verse_vector',
    colour: COLORS.movement,
    explain: {
      title: 'Position (vector3)', doc: DOCS.api,
      tip: 'A point in the world: vector3{X := …, Y := …, Z := …}. Z is up. Units are centimetres.',
      text: 'A vector3 is three floats: X and Y across the ground, Z up. 100.0 is one metre (a Fortnite tile is 512.0 across). All three are floats, so write 100.0, not 100.',
    },
    init() {
      this.appendValueInput('X').appendField('position X');
      this.appendValueInput('Y').appendField('Y');
      this.appendValueInput('Z').appendField('Z (up)');
      this.setInputsInline(true);
      this.setOutput(true, null);
    },
    generate(b, g) {
      g.need(SPATIAL, 'vector3');
      const [x, y, z] = ['X', 'Y', 'Z'].map(a => floatInput(g, b, a, `${a} of a position`));
      return [`vector3{X := ${x}, Y := ${y}, Z := ${z}}`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_rotation',
    colour: COLORS.movement,
    explain: {
      title: 'Rotation from degrees', doc: DOCS.api,
      tip: 'MakeRotationFromYawPitchRollDegrees(Yaw, Pitch, Roll): turn right, tilt up, roll clockwise.',
      text: 'Yaw turns left and right (90.0 is a quarter turn right), pitch tilts up and down, roll tips sideways. All in degrees, as floats.',
    },
    init() {
      this.appendValueInput('YAW').appendField('rotation: turn');
      this.appendValueInput('PITCH').appendField('tilt up');
      this.appendValueInput('ROLL').appendField('roll');
      this.appendDummyInput().appendField('degrees');
      this.setInputsInline(true);
      this.setOutput(true, null);
    },
    generate(b, g) {
      g.need(SPATIAL, 'MakeRotationFromYawPitchRollDegrees');
      const [y, p, r] = [['YAW', 'Yaw'], ['PITCH', 'Pitch'], ['ROLL', 'Roll']].map(([i, w]) => floatInput(g, b, i, w));
      return [`MakeRotationFromYawPitchRollDegrees(${y}, ${p}, ${r})`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_identity_rotation',
    colour: COLORS.movement,
    explain: {
      title: 'No rotation', doc: DOCS.api,
      tip: 'IdentityRotation(): facing the default way, not turned at all.',
      text: 'IdentityRotation() is a rotation that doesn\'t turn anything. Use it when a teleport or move needs a rotation but you don\'t care which way it faces.',
    },
    init() {
      this.appendDummyInput().appendField('no rotation (IdentityRotation())');
      this.setOutput(true, null);
    },
    generate(_b, g) {
      g.need(SPATIAL, 'IdentityRotation');
      return ['IdentityRotation()', Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_transform_of',
    colour: COLORS.movement,
    explain: {
      title: 'Where is it?', doc: DOCS.api,
      tip: 'Thing.GetTransform(): where something is (Translation), which way it faces (Rotation), its size (Scale).',
      text: 'Characters, props and devices have a transform: Translation is the position (a vector3), Rotation which way it faces, Scale how big it is. FortChar.GetTransform().Translation is where a player is standing.',
    },
    init() {
      this.appendValueInput('THING').appendField('where is');
      this.appendDummyInput().appendField('.')
        .appendField(new Blockly.FieldDropdown([['position (Translation)', 'Translation'], ['facing (Rotation)', 'Rotation'], ['size (Scale)', 'Scale'], ['whole transform', '']]), 'PART');
      this.setInputsInline(true);
      this.setOutput(true, null);
    },
    generate(b, g) {
      g.need(SPATIAL, 'transform');
      const thing = required(g, b, 'THING', 'what to locate, like FortChar or a linked prop', 'FortChar');
      const part = f(b, 'PART');
      return [`${thing}.GetTransform()${part ? `.${part}` : ''}`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_vector_part',
    colour: COLORS.movement,
    explain: {
      title: 'X, Y or Z of a position', doc: DOCS.api,
      tip: 'Position.Z: one part of a vector3, as a float. Z is the height.',
      text: 'A position has three parts. .Z is the height, handy for "fell off the map" checks: if (Pos.Z < 0.0).',
    },
    init() {
      this.appendValueInput('VEC');
      this.appendDummyInput().appendField('.')
        .appendField(new Blockly.FieldDropdown([['Z (height)', 'Z'], ['X', 'X'], ['Y', 'Y']]), 'AXIS');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
    },
    generate: (b, g) => [`${required(g, b, 'VEC', 'a position', 'vector3{}')}.${f(b, 'AXIS')}`, Order.ATOMIC],
  });

  defineBlock({
    type: 'verse_distance',
    colour: COLORS.movement,
    explain: {
      title: 'Distance', doc: DOCS.api,
      tip: 'Distance(A, B): how far apart two positions are, in centimetres (a float).',
      text: 'Distance(A, B) measures straight-line distance between two positions; DistanceXY ignores height. 100.0 is one metre. Compare it with a float: if (Distance(A, B) < 500.0).',
    },
    init() {
      this.appendValueInput('A').appendField(new Blockly.FieldDropdown([['distance', 'Distance'], ['distance ignoring height', 'DistanceXY']]), 'KIND').appendField('from');
      this.appendValueInput('B').appendField('to');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
    },
    generate(b, g) {
      g.need(SPATIAL, 'Distance');
      const a = g.valueToCode(b, 'A', Order.NONE), c = g.valueToCode(b, 'B', Order.NONE);
      if (!a || !c) g.warn(b, 'Plug in both positions to measure between.');
      return [`${f(b, 'KIND')}(${a || 'vector3{}'}, ${c || 'vector3{}'})`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_teleport',
    colour: COLORS.movement,
    explain: {
      title: 'Teleport', doc: DOCS.failure,
      tip: 'Thing.TeleportTo[Position, Rotation]: moves a character or prop instantly. Can fail, so use it in an if.',
      text: 'TeleportTo moves a character or prop to a position, facing a rotation, straight away. It can fail (something is in the way), so it uses square brackets and goes inside an if: if (FortChar.TeleportTo[Spot, IdentityRotation()]):.',
    },
    init() {
      this.appendValueInput('THING').appendField('teleport');
      this.appendValueInput('POS').appendField('to');
      this.appendValueInput('ROT').appendField('facing');
      this.setInputsInline(true);
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      checkFailable(g, b, 'TeleportTo[…]');
      const thing = required(g, b, 'THING', 'what to teleport, like FortChar', 'FortChar');
      const pos = g.valueToCode(b, 'POS', Order.NONE), rot = g.valueToCode(b, 'ROT', Order.NONE);
      if (!pos) g.warn(b, 'Plug in the position to teleport to.');
      if (!rot) g.need(SPATIAL, 'IdentityRotation');
      return [`${thing}.TeleportTo[${pos || 'vector3{}'}, ${rot || 'IdentityRotation()'}]`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_move_to',
    colour: COLORS.movement,
    explain: {
      title: 'Move over time', doc: DOCS.time,
      tip: 'Prop.MoveTo(Position, Rotation, Seconds): glides a prop there, and waits until it arrives.',
      text: 'MoveTo slides a prop to a position and rotation over some seconds, and waits until it gets there, so it needs a <suspends> context: OnBegin, or a <suspends> function you spawn. Put two MoveTo in a loop for a platform that goes back and forth.',
    },
    init() {
      this.appendValueInput('THING').appendField('move');
      this.appendValueInput('POS').appendField('to');
      this.appendValueInput('ROT').appendField('facing');
      this.appendValueInput('TIME').appendField('over');
      this.appendDummyInput().appendField('seconds');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      if (!inSuspends(b)) g.warn(b, 'MoveTo waits until the prop arrives, so it only works in <suspends> code (OnBegin or a <suspends> function you spawn).');
      const thing = required(g, b, 'THING', 'the prop to move', 'Prop');
      const pos = g.valueToCode(b, 'POS', Order.NONE), rot = g.valueToCode(b, 'ROT', Order.NONE);
      if (!pos) g.warn(b, 'Plug in the position to move to.');
      if (!rot) g.need(SPATIAL, 'IdentityRotation');
      const time = floatInput(g, b, 'TIME', 'The time');
      return `${thing}.MoveTo(${pos || 'vector3{}'}, ${rot || 'IdentityRotation()'}, ${time === '0.0' && !b.getInputTargetBlock('TIME') ? '1.0' : time})\n`;
    },
  });

  // Prop animation (CreativeAnimation): get a prop's animation controller, give it a move, play it.
  defineBlock({
    type: 'verse_anim_controller',
    colour: COLORS.movement,
    explain: {
      title: 'Animation of a prop', doc: DOCS.failure,
      tip: 'Prop.GetAnimationController[]: what plays keyframe animations on a prop. Can fail, so use "if it exists".',
      text: 'Every creative_prop has an animation_controller that plays smooth, keyframed moves without waiting for them (unlike MoveTo). Getting it can fail (the prop may be gone, or have "Register with Structural Grid" on), so it goes in "if it exists": if (Animation := Platform.GetAnimationController[]):. Needs using { /Fortnite.com/Devices/CreativeAnimation }.',
    },
    init() {
      this.appendValueInput('PROP').appendField('animation of');
      this.setInputsInline(true);
      this.setOutput(true, [FAILABLE, COND]);
    },
    generate(b, g) {
      g.need(ANIMATION, 'GetAnimationController');
      checkFailable(g, b, 'GetAnimationController[]');
      return [`${required(g, b, 'PROP', 'the prop to animate', 'Prop')}.GetAnimationController[]`, Order.ATOMIC];
    },
  });

  defineBlock({
    type: 'verse_anim_set',
    colour: COLORS.movement,
    explain: {
      title: 'Set a prop animation', doc: DOCS.api,
      tip: 'Animation.SetAnimation(…): move and turn the prop by an amount over some seconds, once or back and forth.',
      text: 'An animation is a list of keyframe moves. This block makes one: move the prop by an offset (a vector3, from where it starts), turn it by a rotation, over a number of seconds. "Back and forth" (PingPong) plays it forwards, then backwards, forever; "once" (OneShot) stops at the end. Then play it with the play block. Nothing waits, so it works in any code.',
    },
    init() {
      this.appendValueInput('CTRL').appendField('animate');
      this.appendValueInput('POS').appendField('move by');
      this.appendValueInput('ROT').appendField('turn by');
      this.appendValueInput('TIME').appendField('over');
      this.appendDummyInput().appendField('seconds,')
        .appendField(new Blockly.FieldDropdown([['back and forth', 'PingPong'], ['once', 'OneShot']]), 'MODE');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      g.need(ANIMATION, 'keyframe_delta');
      const ctrl = required(g, b, 'CTRL', 'the animation, like Animation', 'Animation');
      const pos = g.valueToCode(b, 'POS', Order.NONE), rot = g.valueToCode(b, 'ROT', Order.NONE);
      if (!pos) { g.need(SPATIAL, 'vector3'); g.warn(b, 'Plug in how far to move, like a position with Z 500.0 to rise 5 metres.'); }
      if (!rot) g.need(SPATIAL, 'IdentityRotation');
      const time = floatInput(g, b, 'TIME', 'The time');
      const key = `keyframe_delta{DeltaLocation := ${pos || 'vector3{}'}, DeltaRotation := ${rot || 'IdentityRotation()'}, Time := ${time === '0.0' && !b.getInputTargetBlock('TIME') ? '1.0' : time}}`;
      return `${ctrl}.SetAnimation(array{${key}}, ?Mode := animation_mode.${f(b, 'MODE')})\n`;
    },
  });

  defineBlock({
    type: 'verse_anim_control',
    colour: COLORS.movement,
    explain: {
      title: 'Play, pause or stop an animation', doc: DOCS.api,
      tip: 'Animation.Play(), Pause() or Stop(). Stop also puts the prop back where it started.',
      text: 'Play starts (or carries on) the animation set with "animate". Pause holds the prop where it is; Play carries on from there. Stop ends it and puts the prop back at its first keyframe.',
    },
    init() {
      this.appendValueInput('CTRL')
        .appendField(new Blockly.FieldDropdown([['play', 'Play'], ['pause', 'Pause'], ['stop', 'Stop']]), 'ACTION');
      this.setInputsInline(true);
      asStatement(this);
    },
    generate(b, g) {
      return `${required(g, b, 'CTRL', 'the animation, like Animation', 'Animation')}.${f(b, 'ACTION')}()\n`;
    },
  });
}
