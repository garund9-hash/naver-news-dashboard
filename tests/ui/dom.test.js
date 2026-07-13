import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, escapeAttr, withButtonLoading } from '../../src/ui/dom.js';

describe('escapeHtml / escapeAttr', () => {
  it('escapes HTML special characters (happy path)', () => {
    assert.equal(escapeHtml(`<script>"x"'&`), '&lt;script&gt;&quot;x&quot;&#39;&amp;');
    assert.equal(escapeAttr(`a"b`), 'a&quot;b');
  });

  it('stringifies non-strings', () => {
    assert.equal(escapeHtml(null), 'null');
    assert.equal(escapeHtml(42), '42');
  });
});

describe('withButtonLoading', () => {
  it('restores label and enabled state after success', async () => {
    const button = { disabled: false, innerHTML: 'Go' };
    await withButtonLoading(button, 'Wait', async () => {
      assert.equal(button.disabled, true);
      assert.equal(button.innerHTML, 'Wait');
    });
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, 'Go');
  });

  it('restores label even when action throws', async () => {
    const button = { disabled: false, innerHTML: 'Go' };
    await assert.rejects(
      () =>
        withButtonLoading(button, 'Wait', async () => {
          throw new Error('boom');
        }),
      /boom/
    );
    assert.equal(button.disabled, false);
    assert.equal(button.innerHTML, 'Go');
  });
});
