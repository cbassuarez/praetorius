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

  test('normalizes youtube media and preserves media_json on csv export', () => {
    let state = createDefaultProjectState();
    const add = runFolioCommand(state, [
      'add',
      '--payload',
      JSON.stringify({
        title: 'YouTube Work',
        slug: 'youtube-work',
        oneliner: 'Media normalization check',
        media: { kind: 'youtube', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ?t=1m11s' },
      }),
    ]);
    expect(add.ok).toBe(true);
    state = add.state;

    const added = state.worksDb.works.find((work) => work.slug === 'youtube-work');
    expect(added).toBeTruthy();
    expect(added.media).toEqual({
      kind: 'youtube',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ?t=1m11s',
      startAtSec: 71,
    });

    const exported = runFolioCommand(state, ['export', '--format', 'csv']);
    expect(exported.ok).toBe(true);
    expect(exported.exportText).toContain('media_json');
    expect(exported.exportText).toContain('""kind"":""youtube""');
    expect(exported.exportText).toContain('""startAtSec"":71');
  });

  test('imports youtube media from tolerant legacy csv columns', () => {
    let state = createDefaultProjectState();
    const csv = [
      'id,slug,title,oneliner,media_kind,youtube_url,start_at_sec,cues_json,score_json',
      '99,legacy-yt,Legacy YT,Legacy youtube row,youtube,https://www.youtube.com/watch?v=dQw4w9WgXcQ,17,[],',
    ].join('\n');

    const imported = runFolioCommand(state, [
      'import',
      '--format',
      'csv',
      '--payload',
      csv,
      '--assume-new-id',
      '--assume-new-slug',
    ]);
    expect(imported.ok).toBe(true);
    state = imported.state;

    const work = state.worksDb.works.find((entry) => entry.slug === 'legacy-yt');
    expect(work).toBeTruthy();
    expect(work.media).toEqual({
      kind: 'youtube',
      youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      startAtSec: 17,
    });
  });

  test('supports score pdf mode defaults + per-work overrides in config and csv import/export', () => {
    let state = createDefaultProjectState();

    const configSet = runFolioCommand(state, [
      'config',
      '--payload',
      JSON.stringify({ presentation: { scorePdfModeDefault: 'clean' } }),
    ]);
    expect(configSet.ok).toBe(true);
    state = configSet.state;
    expect(state.config.presentation.scorePdfModeDefault).toBe('clean');

    const add = runFolioCommand(state, [
      'add',
      '--payload',
      JSON.stringify({
        title: 'Clean Score Inherit',
        slug: 'clean-score-inherit',
        oneliner: 'Score mode check',
        pdf: 'https://example.com/score.pdf',
        score: {
          pdfStartPage: 1,
          mediaOffsetSec: 0,
          pdfMode: 'inherit',
          pageMap: [{ at: '0:00', page: 1 }],
        },
      }),
    ]);
    expect(add.ok).toBe(true);
    state = add.state;
    const work = state.worksDb.works.find((entry) => entry.slug === 'clean-score-inherit');
    expect(work?.score?.pdfMode).toBe('inherit');

    const exported = runFolioCommand(state, ['export', '--format', 'csv']);
    expect(exported.ok).toBe(true);
    expect(exported.exportText).toContain('score_pdf_mode');
    expect(exported.exportText).toContain('"inherit"');

    const csv = [
      'id,slug,title,oneliner,pdf,score_json,score_pdf_mode,media_json,cues_json',
      '77,csv-clean,CSV Clean,CSV score mode,https://example.com/clean.pdf,"{""pdfStartPage"":1,""mediaOffsetSec"":0,""pageMap"":[{""at"":0,""page"":1}]}","clean","null","[]"',
    ].join('\n');
    const imported = runFolioCommand(state, [
      'import',
      '--format',
      'csv',
      '--payload',
      csv,
      '--assume-new-id',
      '--assume-new-slug',
    ]);
    expect(imported.ok).toBe(true);
    const importedWork = imported.state.worksDb.works.find((entry) => entry.slug === 'csv-clean');
    expect(importedWork?.score?.pdfMode).toBe('clean');
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
