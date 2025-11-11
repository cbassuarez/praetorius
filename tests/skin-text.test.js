import { describe, it, expect } from 'vitest';
import { normalizeWork } from '../src/work-model.js';

describe('work text selection for skins', () => {
  it('keeps legacy description fallback behaviour', () => {
    const view = normalizeWork({ description: 'One. Two.' });
    const payload = {
      list: view.onelinerEffective ?? '',
      detail: view.descriptionEffective ?? ''
    };
    expect(payload).toMatchInlineSnapshot(`
      {
        "detail": "One. Two.",
        "list": "One.",
      }
    `);
  });

  it('prefers explicit oneliner in compact views', () => {
    const view = normalizeWork({ oneliner: 'Minimal blurb', description: 'Expanded program note body.' });
    const payload = {
      list: view.onelinerEffective ?? '',
      detail: view.descriptionEffective ?? ''
    };
    expect(payload).toMatchInlineSnapshot(`
      {
        "detail": "Expanded program note body.",
        "list": "Minimal blurb",
      }
    `);
  });
});
