import { describe, it, expect } from 'vitest';
import { buildOpenDetailLines } from '../ui/lib/work-detail-lines.js';

describe('buildOpenDetailLines', () => {
  it('returns oneliner and additional description paragraphs', () => {
    const lines = buildOpenDetailLines({
      onelinerEffective: 'Short summary',
      descriptionEffective: 'Short summary\n\nMore detail.\n\nFinal paragraph.'
    });
    expect(lines).toMatchInlineSnapshot(`
      [
        {
          "className": "one",
          "text": "Short summary",
        },
        {
          "className": "",
          "text": "More detail.",
        },
        {
          "className": "",
          "text": "Final paragraph.",
        },
      ]
    `);
  });

  it('deduplicates single paragraph descriptions that match the oneliner', () => {
    const lines = buildOpenDetailLines({
      onelinerEffective: 'Identical summary',
      descriptionEffective: 'Identical summary'
    });
    expect(lines).toMatchInlineSnapshot(`
      [
        {
          "className": "one",
          "text": "Identical summary",
        },
      ]
    `);
  });

  it('normalizes openNote values into trailing detail lines', () => {
    const lines = buildOpenDetailLines({
      onelinerEffective: 'Lead',
      openNote: [' First note ', 'Second note', '']
    });
    expect(lines).toMatchInlineSnapshot(`
      [
        {
          "className": "one",
          "text": "Lead",
        },
        {
          "className": "",
          "text": "First note",
        },
        {
          "className": "",
          "text": "Second note",
        },
      ]
    `);
  });
});
