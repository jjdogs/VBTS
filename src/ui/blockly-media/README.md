Copies of Blockly's icons (menu ticks, toolbox category icons, dropdown arrows, block icons) from
`blockly/media`. Update them when Blockly is upgraded: `cp node_modules/blockly/media/<file> .`

Blockly normally downloads these from Google's demo server, which published artifact pages block,
so they are embedded into the app instead. `main.ts` inlines them as data URLs and the UI swaps
Blockly's image paths for them (see `swapMedia` in `ui/app.js`).
