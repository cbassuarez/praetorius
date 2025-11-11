import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import { normalizeWork, collectWorkWarnings } from '../src/work-model.js';
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
});
