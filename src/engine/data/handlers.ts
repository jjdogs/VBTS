/**
 * What an event handler can receive (Phase 5.0). Each event sends one type; the handler's input
 * must match it. Blocks use fixed input names (Agent, Player, Result…), so the converter renames
 * a handler's input to these.
 */

export interface HandlerInput {
  /** The Verse type the event sends, or '' for nothing. Two or more values: "tuple(agent, int)". */
  type: string;
  /** The input's name in the handler (and in blocks inside it). */
  name: string;
  /** Shown in the handler block's "receives" dropdown. */
  label: string;
  /** For an event that sends several values: one input each (a handler with two inputs receives a tuple). */
  inputs?: Array<{ name: string; type: string }>;
}

/** A handler input for an event that sends several values: tuple(…) in, one handler input per value. */
const several = (label: string, ...inputs: Array<[name: string, type: string]>): HandlerInput => ({
  type: `tuple(${inputs.map(([, t]) => t).join(', ')})`,
  name: inputs.map(([n]) => n).join(', '),
  label,
  inputs: inputs.map(([name, type]) => ({ name, type })),
});

/** Handler PARAM value → what it receives. The first three are the original ones (saved projects use them). */
export const HANDLER_INPUTS: Record<string, HandlerInput> = {
  agent: { type: 'agent', name: 'Agent', label: 'agent (Agent)' },
  maybe: { type: '?agent', name: 'MaybeAgent', label: 'maybe agent (?agent)' },
  none: { type: '', name: '', label: 'nothing' },
  player: { type: 'player', name: 'Player', label: 'player (Player)' },
  elimination: { type: 'elimination_result', name: 'Result', label: 'elimination (Result)' },
  damage: { type: 'damage_result', name: 'Result', label: 'damage (Result)' },
  widget: { type: 'widget_message', name: 'Message', label: 'button click (Message)' },
  ai: { type: 'device_ai_interaction_result', name: 'Result', label: 'AI result (Result)' },
  vehicle: { type: 'fort_vehicle', name: 'Vehicle', label: 'vehicle (Vehicle)' },
  character: { type: 'fort_character', name: 'Character', label: 'character (Character)' },
  healing: { type: 'healing_result', name: 'Result', label: 'healing (Result)' },
  // Events that send two or three values (from Epic's API digest)
  agent_int: several('agent and a number (Agent, Value)', ['Agent', 'agent'], ['Value', 'int']),
  maybe_int: several('maybe agent and a number (MaybeAgent, Value)', ['MaybeAgent', '?agent'], ['Value', 'int']),
  agent_float: several('agent and a decimal (Agent, Value)', ['Agent', 'agent'], ['Value', 'float']),
  character_logic: several('character and on/off (Character, IsOn)', ['Character', 'fort_character'], ['IsOn', 'logic']),
  player_maybe: several('player and maybe agent (Player, MaybeAgent)', ['Player', 'player'], ['MaybeAgent', '?agent']),
  vehicle_mod: several('maybe agent, vehicle and number (MaybeAgent, Vehicle, Value)', ['MaybeAgent', '?agent'], ['Vehicle', 'fort_vehicle'], ['Value', 'int']),
};

/** The inputs a handler PARAM gives the handler: none, one, or one per value the event sends. */
export const handlerInputs = (param: string): Array<{ name: string; type: string }> => {
  const input = HANDLER_INPUTS[param];
  if (!input || !input.type) return [];
  return input.inputs ?? [{ name: input.name, type: input.type }];
};

/** How many values an event payload is: 'none' 0, 'agent' 1, 'tuple(agent, int)' 2. */
export const payloadCount = (sends: string): number =>
  sends === 'none' || sends === '' ? 0 : /^tuple\(/.test(sends) ? sends.slice(6, -1).split(',').length : 1;

/** The handler PARAM for what an event sends ('none' for nothing), or undefined if blocks can't receive it. */
export const handlerParamFor = (sends: string): string | undefined =>
  sends === 'none' || sends === '' ? 'none' : Object.keys(HANDLER_INPUTS).find(k => HANDLER_INPUTS[k].type === sends);

/** "Agent:agent" for a handler's signature, or '' when it receives nothing. */
export const handlerSignature = (param: string): string =>
  handlerInputs(param).map(i => `${i.name}:${i.type}`).join(', ');

/**
 * Events that are functions on a value rather than device fields, and what they send:
 * GetPlayspace().PlayerAddedEvent(), FortChar.EliminatedEvent(), Button.OnClick().
 * From Epic's API digest (tests/digest.test.ts checks them).
 */
export const VALUE_EVENTS: Record<string, string> = {
  PlayerAddedEvent: 'player', PlayerRemovedEvent: 'player',
  EliminatedEvent: 'elimination_result', DamagedEvent: 'damage_result',
  OnClick: 'widget_message',
  // fort_playspace: participants include AI agents as well as players
  ParticipantAddedEvent: 'agent', ParticipantRemovedEvent: 'agent',
  // fort_character (and anything healable or shieldable)
  HealedEvent: 'healing_result', DamagedShieldEvent: 'damage_result', HealedShieldEvent: 'healing_result',
  JumpedEvent: 'fort_character',
  CrouchedEvent: 'tuple(fort_character, logic)', SprintedEvent: 'tuple(fort_character, logic)',
};
