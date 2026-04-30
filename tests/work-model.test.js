import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { normalizeWork, collectWorkWarnings, normalizeCoverUrl } from '../src/work-model.js';
import schema from '../data/works.schema.json' assert { type: 'json' };

const ajv = new Ajv({ allErrors: true });
const validate = ajv.compile(schema);

function buildDb(work) {
  return {
    meta: { title: 'Test', updated: '2025-01-01' },
    works: [{ id: 1, slug: 'test', title: 'Test Work', ...work }]
  };
}

describe('normalizeWork', () => {
  it('uses legacy one field when oneliner missing', () => {
    const view = normalizeWork({ one: 'Legacy field only' });
    expect(view.onelinerEffective).toBe('Legacy field only');
    expect(view.oneliner).toBe('Legacy field only');
  });

  it('uses oneliner field when provided', () => {
    const view = normalizeWork({ oneliner: 'New field only' });
    expect(view.onelinerEffective).toBe('New field only');
    expect(view.one).toBe('New field only');
  });

  it('prefers oneliner over legacy one when both present', () => {
    const view = normalizeWork({ oneliner: 'New', one: 'Old' });
    expect(view.onelinerEffective).toBe('New');
    expect(view.one).toBe('New');
  });

  it('derives oneliner from description when none provided', () => {
    const view = normalizeWork({ description: 'One. Two.' });
    expect(view.onelinerEffective).toBe('One.');
    expect(view.descriptionEffective).toBe('One. Two.');
  });

  it('returns null effective fields when nothing provided', () => {
    const view = normalizeWork({});
    expect(view.onelinerEffective).toBeNull();
    expect(view.descriptionEffective).toBeNull();
  });

  it('normalizes cover and tags metadata', () => {
    const view = normalizeWork({
      cover: ' https://cdn.example.com/cover.jpg ',
      tags: [' electroacoustic ', ' premiere ', '']
    });
    expect(view.cover).toBe('https://cdn.example.com/cover.jpg');
    expect(view.tags).toEqual(['electroacoustic', 'premiere']);
  });

  it('normalizes Google Drive share cover URLs', () => {
    expect(
      normalizeCoverUrl('https://drive.google.com/file/d/1AbCdEfGhIJkLmNo/view?usp=sharing')
    ).toBe('https://drive.google.com/uc?export=view&id=1AbCdEfGhIJkLmNo');
    expect(
      normalizeCoverUrl('https://drive.google.com/open?id=1AbCdEfGhIJkLmNo')
    ).toBe('https://drive.google.com/uc?export=view&id=1AbCdEfGhIJkLmNo');
  });

  it('parses comma-separated tags strings', () => {
    const view = normalizeWork({ tags: 'orchestral, chamber, 2026' });
    expect(view.tags).toEqual(['orchestral', 'chamber', '2026']);
  });

  it('normalizes youtube media fields', () => {
    const view = normalizeWork({
      media: {
        kind: 'youtube',
        youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
        startAtSec: 12
      }
    });
    expect(view.media).toEqual({
      kind: 'youtube',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
      startAtSec: 12
    });
  });
});

describe('works schema validation', () => {
  it('accepts record with oneliner only', () => {
    const db = buildDb({ oneliner: 'Hello world' });
    expect(validate(db)).toBe(true);
  });

  it('accepts record with legacy one only', () => {
    const db = buildDb({ one: 'Legacy summary' });
    expect(validate(db)).toBe(true);
  });

  it('accepts both fields and surfaces warning', () => {
    const db = buildDb({ oneliner: 'Primary', one: 'Secondary' });
    expect(validate(db)).toBe(true);
    const warnings = collectWorkWarnings(db.works[0]);
    expect(warnings.some(msg => msg.includes('legacy "one"'))).toBe(true);
  });

  it('accepts optional cover and tags fields', () => {
    const db = buildDb({
      oneliner: 'Primary',
      cover: 'https://cdn.example.com/cover.jpg',
      tags: ['portfolio', 'string quartet']
    });
    expect(validate(db)).toBe(true);
  });

  it('accepts youtube media when url is present', () => {
    const db = buildDb({
      oneliner: 'Media object test',
      media: {
        kind: 'youtube',
        youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        startAtSec: 30
      }
    });
    expect(validate(db)).toBe(true);
  });

  it('rejects youtube media when url is missing', () => {
    const db = buildDb({
      oneliner: 'Invalid youtube media',
      media: {
        kind: 'youtube'
      }
    });
    expect(validate(db)).toBe(false);
    const hasYoutubeUrlError = (validate.errors || []).some((error) => String(error.instancePath || '').includes('/media') || String(error.message || '').includes('youtubeUrl'));
    expect(hasYoutubeUrlError).toBe(true);
  });
});
