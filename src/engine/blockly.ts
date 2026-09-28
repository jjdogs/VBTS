/**
 * One import for Blockly that works everywhere.
 *
 * In the browser, Vite loads Blockly's ES module, which exports each piece by name.
 * In Node (our tests), Blockly loads as CommonJS, which puts everything on `default`.
 * Every other engine file imports Blockly from here instead of from 'blockly/core'.
 */
import * as BlocklyModule from 'blockly/core';

type BlocklyNamespace = typeof BlocklyModule;
// Reflect.get: the browser build has no `default`, and this tells the bundler that's expected.
const Blockly: BlocklyNamespace =
  (Reflect.get(BlocklyModule, 'default') as BlocklyNamespace | undefined) ?? BlocklyModule;

export default Blockly;
export type {
  Block, BlockSvg, Workspace, WorkspaceSvg, Field, CodeGenerator,
  FieldDropdownValidator, MenuOption, MenuGeneratorFunction,
} from 'blockly/core';
