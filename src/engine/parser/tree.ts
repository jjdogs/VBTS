/**
 * Reads Verse text into a tree of lines using indentation, the way Verse itself does.
 */

export interface LineNode {
  /** The line without its indentation. */
  text: string;
  indent: number;
  /** 1-based line number in the source. */
  line: number;
  children: LineNode[];
}

/** The last source line (1-based) covered by a node and everything indented under it. */
export const lastLineOf = (node: LineNode): number =>
  node.children.length ? lastLineOf(node.children[node.children.length - 1]) : node.line;

/** Removes a trailing # comment that is not inside a string. */
export function stripComment(text: string): string {
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && inString) { i++; continue; }
    if (c === '"') inString = !inString;
    else if (c === '#' && !inString) return text.slice(0, i).trimEnd();
  }
  return text;
}

/** The comment at the end of a line of code (`set X = 1 # note` → "note"), or null. */
export function trailingComment(text: string): string | null {
  if (text.startsWith('#')) return null; // a comment line, not a comment after code
  const code = stripComment(text);
  if (code.length === text.length) return null;
  return text.slice(code.length).trim().replace(/^#\s?/, '');
}

/** Normalizes line endings and tabs, then splits into lines. */
export const splitLines = (src: string): string[] =>
  src.replace(/\r/g, '').replace(/\t/g, '    ').split('\n');

/** Builds the indentation tree. Blank lines are skipped. */
export function buildTree(lines: string[]): LineNode[] {
  const root: LineNode = { text: '', indent: -1, line: 0, children: [] };
  const stack: LineNode[] = [root];
  lines.forEach((l, i) => {
    if (!l.trim()) return;
    const indent = l.length - l.trimStart().length;
    const node: LineNode = { text: l.trim(), indent, line: i + 1, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].children.push(node);
    stack.push(node);
  });
  return root.children;
}

/** Counts code lines that end in a comment (those comments are not kept). Auto-using notes don't count. */
export const countTrailingComments = (lines: string[]): number =>
  lines.filter(l => {
    const t = l.trim();
    return t && !t.startsWith('#') && stripComment(t) !== t && !/^using\s*\{[^}]*\}\s*#\s*for\s/.test(t);
  }).length;

/** Undoes backslash escapes in a Verse string. */
export const unescapeString = (s: string): string => s.replace(/\\(.)/g, '$1');
