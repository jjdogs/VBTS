Copies of Blockly's control icons (zoom, re-center, trash, dropdown arrows) from `blockly/media`.

Blockly normally downloads these from Google's demo server, which published artifact pages block,
so they are embedded into the app instead. `main.ts` inlines them as data URLs and the UI swaps
Blockly's image paths for them (see `swapMedia` in `ui/app.js`).
