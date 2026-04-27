import { describe, expect, test } from 'vitest';
import {
  createDefaultProjectState,
  runFolioCommand,
  APPEARANCE_PALETTES,
  CURSOR_PRESETS,
  EFFECT_PRESETS,
} from '../src/web/folio-runtime.js';

describe('folio runtime command engine', () => {
  test('supports add/edit/remove/order/undo flow', () => {
    let state = createDefaultProjectState();
    const originalCount = state.worksDb.works.length;

    let result = runFolioCommand(state, ['add', '--payload', JSON.stringify({ title: 'Test Work', slug: 'test-work', oneliner: 'One line' })]);
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.worksDb.works.length).toBe(originalCount + 1);

    const added = state.worksDb.works.find((work) => work.slug === 'test-work');
    expect(added).toBeTruthy();

    result = runFolioCommand(state, ['edit', String(added.id), '--payload', JSON.stringify({ title: 'Edited Work' })]);
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.worksDb.works.find((work) => work.id === added.id).title).toBe('Edited Work');

    result = runFolioCommand(state, ['order', '--move', String(added.id), '--to', '1']);
    expect(result.ok).toBe(true);
    state = result.state;
    expect(Number(state.worksDb.works[0].id)).toBe(Number(added.id));

    result = runFolioCommand(state, ['rm', String(added.id)]);
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.worksDb.works.find((work) => work.id === added.id)).toBeFalsy();

    result = runFolioCommand(state, ['undo']);
    expect(result.ok).toBe(true);
    state = result.state;
    expect(state.worksDb.works.find((work) => work.id === added.id)).toBeTruthy();
  });

  test('generate emits metadata markers and runtime fallback rules', () => {
    let state = createDefaultProjectState();

    const unsupportedReact = runFolioCommand(state, ['generate', '--skin', 'typefolio', '--ui-runtime', 'react']);
    expect(unsupportedReact.ok).toBe(true);
    expect(unsupportedReact.artifacts.options.uiRuntime).toBe('vanilla');
    expect(unsupportedReact.artifacts.notes.join('\n')).toContain('Falling back to vanilla');

    const standard = runFolioCommand(state, ['generate', '--skin', 'cards-tabs', '--ui-runtime', 'react']);
    expect(standard.ok).toBe(true);
    expect(standard.artifacts.options.uiRuntime).toBe('react');
    const standardIndex = standard.artifacts.files.index;
    expect(standardIndex).toContain('data-skin="cards-tabs"');
    expect(standardIndex).toContain('data-brand-system="praetorius-v1"');
    expect(standardIndex).toContain('data-brand-attribution="on"');
    expect(standard.artifacts.files[standard.artifacts.options.js]).toContain('window.PRAE.pauseAllAudio');

    const embedFallback = runFolioCommand(state, ['generate', '--skin', 'cards-tabs', '--ui-runtime', 'react', '--embed']);
    expect(embedFallback.ok).toBe(true);
    expect(embedFallback.artifacts.options.uiRuntime).toBe('vanilla');
    expect(embedFallback.artifacts.files.embed).toContain('Praetorius embed');
    expect(embedFallback.artifacts.files.index).toBeUndefined();
    expect(embedFallback.artifacts.files[embedFallback.artifacts.options.js]).toBeUndefined();
  });

  test('appearance controls accept all presets and persist when requested', () => {
    let state = createDefaultProjectState();

    for (const palette of APPEARANCE_PALETTES) {
      for (const cursor of CURSOR_PRESETS) {
        for (const hover of EFFECT_PRESETS) {
          for (const button of EFFECT_PRESETS) {
            const monoArg = palette === 'mono-one' ? ['--mono-color', '#3355cc'] : [];
            const result = runFolioCommand(state, [
              'generate',
              '--skin',
              'kiosk',
              '--palette',
              palette,
              '--cursor',
              cursor,
              '--hover-effect',
              hover,
              '--button-effect',
              button,
              '--save-appearance',
              ...monoArg,
            ]);
            expect(result.ok).toBe(true);
            state = result.state;
            expect(state.config.ui.appearance.theme.palette).toBe(palette);
            expect(state.config.ui.appearance.cursor.preset).toBe(cursor);
            expect(state.config.ui.appearance.effects.hover).toBe(hover);
            expect(state.config.ui.appearance.effects.button).toBe(button);
          }
        }
      }
    }
  });
});
