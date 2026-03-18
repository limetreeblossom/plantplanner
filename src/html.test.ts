import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const html = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

// Buttons with class "tool-btn" but intentionally no data-tool attribute.
// These have their own dedicated click handlers and must NOT trigger setTool().
const KNOWN_NON_TOOL_BTNS = new Set(['fill-mode-btn', 'import-bg-btn', 'save-btn', 'load-btn']);

describe('index.html tool-btn contract', () => {
  it('every .tool-btn element has data-tool OR is in the known non-tool allowlist', () => {
    // Match all <button ...> tags that include "tool-btn" in their class attribute.
    const btnRe = /<button\b([^>]*)>/g;
    const violations: string[] = [];

    for (const match of html.matchAll(btnRe)) {
      const attrs = match[1];
      if (!/\btool-btn\b/.test(attrs)) continue; // not a .tool-btn
      if (/\bdata-tool\s*=/.test(attrs)) continue; // has data-tool ✓

      // No data-tool — must be in the allowlist
      const idMatch = attrs.match(/\bid\s*=\s*["']([^"']+)["']/);
      const id = idMatch?.[1] ?? '(no id)';
      if (!KNOWN_NON_TOOL_BTNS.has(id)) {
        violations.push(`<button id="${id}"> has class "tool-btn" but no data-tool`);
      }
    }

    expect(violations).toEqual([]);
  });
});
