/**
 * The toolbox: the block categories on the left and which blocks each one offers.
 * Blocks listed here can come pre-filled (fields, attached blocks, shadow blocks).
 */
import { COLORS, MODULES } from './data/modules.ts';

type ToolboxItem =
  | { kind: 'block'; type: string; fields?: Record<string, string | number | boolean>; inputs?: Record<string, unknown> }
  | { kind: 'label'; text: string };

interface ToolboxCategory { kind: 'category'; name: string; colour: string; contents: ToolboxItem[] }
export interface Toolbox { kind: 'categoryToolbox'; contents: ToolboxCategory[] }

const block = (type: string, extra: Omit<Extract<ToolboxItem, { kind: 'block' }>, 'kind' | 'type'> = {}): ToolboxItem =>
  ({ kind: 'block', type, ...extra });
const label = (text: string): ToolboxItem => ({ kind: 'label', text });
const category = (name: string, colour: string, contents: ToolboxItem[]): ToolboxCategory =>
  ({ kind: 'category', name, colour, contents });
/** A replaceable number already plugged into an input. */
const number = (n: number, type = 'int') => ({ shadow: { type: 'verse_number', fields: { NUM: n, TYPE: type } } });

export const TOOLBOX: Toolbox = {
  kind: 'categoryToolbox',
  contents: [
    category('Device', COLORS.structure, [block('verse_device'), block('verse_comment')]),
    category('Using', COLORS.structure, [
      label('Untick "add what I need automatically" on your device to practice these.'),
      ...MODULES.slice(0, 6).map(m => block('verse_using', { fields: { MODULE: m.path } })),
      block('verse_using', { fields: { MODULE: '/UnrealEngine.com/Temporary/SpatialMath' } }),
      block('verse_using_custom'),
    ]),
    category('Devices', COLORS.devices, [
      block('verse_editable'),
      block('verse_editable', { fields: { NAME: 'MyGranter', DTYPE: 'item_granter_device' } }),
      block('verse_editable', { fields: { NAME: 'MyTrigger', DTYPE: 'trigger_device' } }),
      block('verse_editable', { fields: { NAME: 'MyZone', DTYPE: 'mutator_zone_device' } }),
      block('verse_call_device'),
      block('verse_hud_text', { inputs: { TEXT: { shadow: { type: 'verse_text', fields: { TEXT: 'Nice shot!' } } } } }),
    ]),
    category('Events', COLORS.events, [
      block('verse_subscribe'),
      block('verse_handler'),
      block('verse_handler', { fields: { NAME: 'OnTriggered', PARAM: 'maybe' } }),
    ]),
    category('Player', COLORS.player, [
      block('verse_unwrap_agent'), block('verse_fort_character'), block('verse_char_action'), block('verse_for_players'),
    ]),
    category('Logic', COLORS.logic, [
      block('verse_if'), block('verse_if_else'),
      block('verse_compare', { inputs: { A: { block: { type: 'verse_get' } }, B: number(3) }, fields: { OP: '>=' } }),
      block('verse_logic_op'), block('verse_not'), block('verse_is_true'), block('verse_bool'),
    ]),
    category('Loops', COLORS.loops, [block('verse_loop'), block('verse_for_range'), block('verse_break')]),
    category('Math', COLORS.math, [
      block('verse_number'), block('verse_number', { fields: { NUM: 1.5, TYPE: 'float' } }),
      block('verse_arith', { inputs: { A: number(1), B: number(1) } }), block('verse_random'),
      block('verse_random_range', { inputs: { LO: number(0), HI: { block: { type: 'verse_arith', fields: { OP: '-' }, inputs: { A: { block: { type: 'verse_length', fields: { NAME: 'Targets' } } }, B: number(1) } } } } }),
    ]),
    category('Text', COLORS.text, [
      block('verse_print', { inputs: { TEXT: { shadow: { type: 'verse_text' } } } }),
      block('verse_text'), block('verse_text_join', { inputs: { V: { block: { type: 'verse_get' } } } }),
    ]),
    category('Variables', COLORS.vars, [
      block('verse_field'), block('verse_get'), block('verse_set', { inputs: { V: number(1) }, fields: { OP: '+=' } }),
    ]),
    category('Lists & Maps', COLORS.data, [
      label('Arrays: lists of values'),
      block('verse_array_field', { fields: { KIND: 'var', NAME: 'Scores', ELEM: 'int', VALUES: '3, 5, 8' } }),
      block('verse_editable_array', { fields: { NAME: 'Targets', DTYPE: 'shooting_range_target_device' } }),
      block('verse_array_add', { inputs: { VALUE: number(1) } }),
      block('verse_for_each', { inputs: { COLLECTION: { block: { type: 'verse_get', fields: { NAME: 'Scores' } } } } }),
      block('verse_length'),
      label('Maps: look-up tables, like each player → score'),
      block('verse_map_field', { fields: { KIND: 'var', NAME: 'PlayerScores', KEY: 'agent', VAL: 'int' } }),
      block('verse_set_index', { inputs: { KEY: { block: { type: 'verse_agent_value' } }, VALUE: number(1) } }),
      label('Options: maybe a value'),
      block('verse_option_field', { fields: { NAME: 'Winner', TYPE: 'agent' } }),
      block('verse_make_option', { inputs: { VALUE: { block: { type: 'verse_agent_value' } } } }),
      label('Reading can fail, so use "if it exists"'),
      block('verse_if_bind', { inputs: { VALUE: { block: { type: 'verse_index', inputs: { KEY: number(0) } } } } }),
      block('verse_index', { inputs: { KEY: number(0) } }),
      block('verse_option_value'),
      block('verse_agent_value'),
    ]),
    category('Types', COLORS.types, [
      label('Your own types: make a class (or struct), then make objects from it'),
      block('verse_class', { fields: { NAME: 'pet', KIND: 'class', SPEC: 'none', PARENT: '' }, inputs: { MEMBERS: { block: {
        type: 'verse_member_field', fields: { KIND: 'const', NAME: 'Name', VIS: 'none', TYPE: 'string', DEFAULT: '' },
        next: { block: { type: 'verse_member_field', fields: { KIND: 'var', NAME: 'Age', VIS: 'none', TYPE: 'int', DEFAULT: '0' } } } } } } }),
      block('verse_class', { fields: { NAME: 'point', KIND: 'struct', SPEC: 'none', PARENT: '' } }),
      block('verse_enum'),
      block('verse_member_field'),
      block('verse_member_field', { fields: { KIND: 'var', NAME: 'MyPet', VIS: 'none', TYPE: 'pet', DEFAULT: 'pet{Name := "Scout"}' } }),
      label('Use them'),
      block('verse_construct', { inputs: { V1: { shadow: { type: 'verse_text', fields: { TEXT: 'Scout' } } } }, fields: { TYPE: 'pet', F1: 'Name' } }),
      block('verse_member_get', { fields: { OBJ: 'MyPet', MEMBER: 'Age' } }),
      block('verse_member_set', { fields: { OBJ: 'MyPet', MEMBER: 'Age', OP: '+=' }, inputs: { V: number(1) } }),
      block('verse_method_call', { fields: { OBJ: 'MyPet', METHOD: 'Birthday' } }),
      block('verse_method_value', { fields: { OBJ: 'MyPet', METHOD: 'GetName' } }),
      block('verse_enum_value'),
      block('verse_self'),
    ]),
    category('Functions', COLORS.funcs, [
      block('verse_function'),
      block('verse_function', { fields: { NAME: 'Double', PARAMS: 'X:int', RET: 'int' } }),
      block('verse_function', { fields: { NAME: 'IsHighScore', PARAMS: 'Score:int', RET: 'void', DECIDES: 'TRUE' } }),
      block('verse_function', { fields: { NAME: 'CountDown', SUSPENDS: 'TRUE' } }),
      block('verse_check'),
      block('verse_return'),
      block('verse_call_fn'),
      block('verse_call_value'),
      block('verse_call_decides'),
    ]),
    category('Time', COLORS.time, [block('verse_sleep'), block('verse_spawn'), block('verse_race')]),
    category('Raw Verse', COLORS.raw, [
      label('Type any Verse. It is written out exactly as typed.'),
      block('verse_raw', { fields: { CODE: 'Print("typed by hand")' } }),
      block('verse_raw_wrap', { fields: { CODE: 'if (Player := player[Agent]):' } }),
      block('verse_raw_member', { fields: { CODE: 'var Lives:int = 3' } }),
      block('verse_raw_expr', { fields: { CODE: 'Hits * 10' } }),
    ]),
  ],
};
