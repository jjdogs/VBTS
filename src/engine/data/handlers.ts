/**
 * What an event handler can receive (Phase 5.0). Each event sends one type; the handler's input
 * must match it. Blocks use fixed input names (Agent, Player, Result…), so the converter renames
 * a handler's input to these.
 */

export interface HandlerInput {
  /** The Verse type the event sends, or '' for nothing. */
  type: string;
  /** The input's name in the handler (and in blocks inside it). */
  name: string;
  /** Shown in the handler block's "receives" dropdown. */
  label: string;
}

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
};

/** The handler PARAM for what an event sends ('none' for nothing), or undefined if blocks can't receive it. */
export const handlerParamFor = (sends: string): string | undefined =>
  sends === 'none' || sends === '' ? 'none' : Object.keys(HANDLER_INPUTS).find(k => HANDLER_INPUTS[k].type === sends);

/** "Agent:agent" for a handler's signature, or '' when it receives nothing. */
export const handlerSignature = (param: string): string => {
  const input = HANDLER_INPUTS[param];
  return input && input.type ? `${input.name}:${input.type}` : '';
};

/**
 * Events that are functions on a value rather than device fields, and what they send:
 * GetPlayspace().PlayerAddedEvent(), FortChar.EliminatedEvent(), Button.OnClick().
 * From Epic's API digest (tests/digest.test.ts checks them); events that send two values are left out.
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
};
