import { describe, it, expect } from 'vitest';
import { normalizeWork } from '../src/work-model.js';

describe('normalizeWork', () => {
  it('derives oneliner from description first sentence', () => {
    const view = normalizeWork({ description: 'One. Two.' });
    expect(view.onelinerEffective).toBe('One.');
    expect(view.descriptionEffective).toBe('One. Two.');
  });

  it('prefers explicit oneliner when provided', () => {
    const view = normalizeWork({ oneliner: 'Short blurb', description: 'Long body' });
    expect(view.onelinerEffective).toBe('Short blurb');
    expect(view.descriptionEffective).toBe('Long body');
  });

  it('collapses line breaks inside oneliner', () => {
    const view = normalizeWork({ oneliner: 'Has\nbreak' });
    expect(view.onelinerEffective).toBe('Has break');
    expect(view.descriptionEffective).toBe('Has break');
  });

  it('returns nulls when fields missing', () => {
    const view = normalizeWork({});
    expect(view.onelinerEffective).toBeNull();
    expect(view.descriptionEffective).toBeNull();
  });
});
