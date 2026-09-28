/**
 * Registers every block with Blockly. Each file is one toolbox category.
 */
import { registerDataBlocks } from './data.ts';
import { registerDeviceBlocks } from './devices.ts';
import { registerEventBlocks } from './events.ts';
import { registerFunctionBlocks } from './functions.ts';
import { registerLogicBlocks } from './logic.ts';
import { registerLoopBlocks } from './loops.ts';
import { registerMathBlocks } from './math.ts';
import { registerPlayerBlocks } from './player.ts';
import { registerRawBlocks } from './raw.ts';
import { registerStructureBlocks } from './structure.ts';
import { registerTeamBlocks } from './teams.ts';
import { registerMovementBlocks } from './movement.ts';
import { registerUiBlocks } from './ui.ts';
import { registerChainBlocks } from './chain.ts';
import { registerTextBlocks } from './text.ts';
import { registerTimeBlocks } from './time.ts';
import { registerTypeBlocks } from './types.ts';
import { registerVariableBlocks } from './variables.ts';

let registered = false;

export function registerAllBlocks(): void {
  if (registered) return;
  registered = true;
  registerStructureBlocks();
  registerDeviceBlocks();
  registerEventBlocks();
  registerPlayerBlocks();
  registerLogicBlocks();
  registerLoopBlocks();
  registerMathBlocks();
  registerTextBlocks();
  registerVariableBlocks();
  registerDataBlocks();
  registerFunctionBlocks();
  registerTimeBlocks();
  registerTypeBlocks();
  registerTeamBlocks();
  registerMovementBlocks();
  registerUiBlocks();
  registerChainBlocks();
  registerRawBlocks();
}
