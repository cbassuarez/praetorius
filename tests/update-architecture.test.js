import { describe, it, expect, beforeAll } from 'vitest';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';
import pkg from '../package.json' assert { type: 'json' };

const CLI = fileURLToPath(new URL('../src/cli/index.js', import.meta.url));

function baseEnv(extra = {}) {
  return {
    FORCE_COLOR: '0',
    PRAE_DISABLE_UPDATE_CHECK: '1',
    PRAE_TEST_EXPORTS: '0',
    ...extra
  };
}

async function exists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function setupWorkspace({ webUpdatesEnabled = true } = {}) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-update-arch-'));
  await fs.mkdir(path.join(cwd, '.prae'), { recursive: true });

  const db = {
    version: 1,
    works: [
      {
        id: 1,
        slug: 'update-architecture',
        title: 'Update Architecture',
        oneliner: 'Runtime loader integration test.',
        cues: []
      }
    ]
  };

  const config = {
    updates: {
      web: {
        enabled: webUpdatesEnabled,
        channel: 'stable',
        autoPatch: true,
        autoMinor: false,
        autoMajor: false,
        manifestUrl: 'https://cdn.praetorius.dev/runtime/channels/stable.json',
        telemetryUrl: 'https://cdn.praetorius.dev/runtime/events'
      }
    }
  };

  await fs.writeFile(path.join(cwd, '.prae', 'works.json'), JSON.stringify(db, null, 2), 'utf8');
  await fs.writeFile(path.join(cwd, '.prae', 'config.json'), JSON.stringify(config, null, 2), 'utf8');
  return cwd;
}

describe('auto-update helper logic', () => {
  let helpers;

  beforeAll(async () => {
    process.env.PRAE_TEST_EXPORTS = '1';
    process.env.PRAE_DISABLE_UPDATE_CHECK = '1';
    await import(`${pathToFileURL(CLI).href}?prae-update-tests=${Date.now()}`);
    helpers = globalThis.__PRAE_TEST__;
    process.env.PRAE_TEST_EXPORTS = '0';
  });

  it('evaluates semver gates for patch/minor/major correctly', () => {
    const policy = helpers.praeNormalizeCliUpdatePolicy({ autoPatch: true, autoMinor: false, autoMajor: true });

    expect(helpers.praeVersionDeltaType('1.2.3', '1.2.4')).toBe('patch');
    expect(helpers.praeVersionDeltaType('1.2.3', '1.3.0')).toBe('minor');
    expect(helpers.praeVersionDeltaType('1.2.3', '2.0.0')).toBe('major');

    expect(helpers.praeIsUpdateEligible('patch', policy)).toBe(true);
    expect(helpers.praeIsUpdateEligible('minor', policy)).toBe(false);
    expect(helpers.praeIsUpdateEligible('major', policy)).toBe(false);
  });

  it('applies manifest kill-switch, force-pin, and policy blocking rules', () => {
    const manifest = {
      schemaVersion: 1,
      generatedAt: '2026-04-29T00:00:00.000Z',
      global: {
        killSwitch: false,
        forcePinVersion: null
      },
      channels: {
        stable: {
          latest: '1.2.4',
          versions: {
            '1.2.3': { version: '1.2.3', url: 'https://cdn.example.com/1.2.3.js', integrity: 'sha384-a' },
            '1.2.4': { version: '1.2.4', url: 'https://cdn.example.com/1.2.4.js', integrity: 'sha384-b' }
          }
        }
      }
    };

    const policy = helpers.praeNormalizeWebUpdateConfig({
      enabled: true,
      channel: 'stable',
      autoPatch: true,
      autoMinor: false,
      manifestUrl: 'https://cdn.example.com/manifest.json',
      telemetryUrl: 'https://cdn.example.com/events'
    });

    const eligible = helpers.praeSelectRuntimeRelease(manifest, policy, '1.2.3');
    expect(eligible.kind).toBe('eligible');
    expect(eligible.delta).toBe('patch');

    const blocked = helpers.praeSelectRuntimeRelease(
      {
        ...manifest,
        channels: {
          stable: {
            latest: '1.3.0',
            versions: {
              ...manifest.channels.stable.versions,
              '1.3.0': { version: '1.3.0', url: 'https://cdn.example.com/1.3.0.js', integrity: 'sha384-c' }
            }
          }
        }
      },
      policy,
      '1.2.3'
    );
    expect(blocked.kind).toBe('blocked-by-policy');
    expect(blocked.delta).toBe('minor');

    const killSwitch = helpers.praeSelectRuntimeRelease(
      {
        ...manifest,
        global: { ...manifest.global, killSwitch: true }
      },
      policy,
      '1.2.3'
    );
    expect(killSwitch.kind).toBe('kill-switch');

    const forcePin = helpers.praeSelectRuntimeRelease(
      {
        ...manifest,
        global: { ...manifest.global, forcePinVersion: '1.2.3' }
      },
      policy,
      '1.2.3'
    );
    expect(forcePin.kind).toBe('force-pin');
    expect(forcePin.release.version).toBe('1.2.3');
  });
});

describe('generate runtime loader mode', () => {
  it('emits loader + manifest preview and wires index.html when web updates are enabled', async () => {
    const cwd = await setupWorkspace({ webUpdatesEnabled: true });

    await execa('node', [CLI, 'generate', '--skin', 'cards-tabs', '--out', 'dist-loader'], {
      cwd,
      env: baseEnv({ PRAE_TEST: '1' })
    });

    const indexPath = path.join(cwd, 'dist-loader', 'index.html');
    const loaderPath = path.join(cwd, 'dist-loader', 'runtime-loader.js');
    const manifestPath = path.join(cwd, 'dist-loader', 'runtime-manifest.preview.json');
    const runtimePath = path.join(cwd, 'dist-loader', 'script.js');

    expect(await exists(indexPath)).toBe(true);
    expect(await exists(loaderPath)).toBe(true);
    expect(await exists(manifestPath)).toBe(true);
    expect(await exists(runtimePath)).toBe(true);

    const index = await fs.readFile(indexPath, 'utf8');
    const loader = await fs.readFile(loaderPath, 'utf8');
    const preview = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    expect(index).toContain('data-prae-runtime-loader="1"');
    expect(index).toContain('./runtime-loader.js');
    expect(index).not.toContain('<script src="./script.js" defer></script>');

    expect(loader).toContain('https://cdn.praetorius.dev/runtime/channels/stable.json');
    expect(loader).toContain('https://cdn.praetorius.dev/runtime/events');
    expect(loader).toContain('autoPatch: true');
    expect(loader).toContain('autoMinor: false');
    expect(loader).toContain('last-known-good');

    expect(preview.channels?.stable?.latest).toBe(pkg.version);
    expect(preview.channels?.stable?.versions?.[pkg.version]?.url).toBe('./script.js');
    expect(String(preview.channels?.stable?.versions?.[pkg.version]?.integrity || '')).toMatch(/^sha384-/);
  });

  it('keeps pinned script wiring when web updates are disabled', async () => {
    const cwd = await setupWorkspace({ webUpdatesEnabled: false });

    await execa('node', [CLI, 'generate', '--skin', 'cards-tabs', '--out', 'dist-pinned'], {
      cwd,
      env: baseEnv({ PRAE_TEST: '1' })
    });

    const indexPath = path.join(cwd, 'dist-pinned', 'index.html');
    const loaderPath = path.join(cwd, 'dist-pinned', 'runtime-loader.js');
    const manifestPath = path.join(cwd, 'dist-pinned', 'runtime-manifest.preview.json');

    const index = await fs.readFile(indexPath, 'utf8');
    expect(index).toContain('<script src="./script.js" defer></script>');
    expect(index).not.toContain('data-prae-runtime-loader="1"');
    expect(await exists(loaderPath)).toBe(false);
    expect(await exists(manifestPath)).toBe(false);
  });
});

describe('init update defaults', () => {
  it('enables web runtime auto-update by default with --yes', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-update-init-'));

    await execa('node', [CLI, 'init', '--yes', '--out', 'starter'], {
      cwd,
      env: baseEnv({ PRAE_TEST: '1' })
    });

    const configPath = path.join(cwd, '.prae', 'config.json');
    const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
    expect(config.updates?.web?.enabled).toBe(true);
    expect(config.updates?.web?.autoPatch).toBe(true);
    expect(config.updates?.web?.autoMinor).toBe(false);
    expect(config.updates?.web?.autoMajor).toBe(false);
  });
});

describe('update command integration', () => {
  it('persists user policy and reports eligibility from update metadata', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prae-update-cli-'));
    const home = path.join(cwd, 'home');
    await fs.mkdir(home, { recursive: true });

    const updateConfig = await execa(
      'node',
      [CLI, 'update', 'config', '--auto-patch', 'off', '--auto-minor', 'on', '--json'],
      {
        cwd,
        env: baseEnv({
          HOME: home,
          XDG_CONFIG_HOME: path.join(home, '.config'),
          PRAE_TEST: '1'
        })
      }
    );
    const configured = JSON.parse(updateConfig.stdout);
    expect(configured.policy.autoPatch).toBe(false);
    expect(configured.policy.autoMinor).toBe(true);
    expect(configured.policy.autoMajor).toBe(false);

    const patchStatus = await execa('node', [CLI, 'update', 'status', '--json'], {
      cwd,
      env: baseEnv({
        HOME: home,
        XDG_CONFIG_HOME: path.join(home, '.config'),
        PRAE_TEST: '1',
        PRAE_UPDATE_INFO_JSON: JSON.stringify({
          current: pkg.version,
          latest: '0.2.99',
          type: 'patch'
        })
      })
    });
    const patchPayload = JSON.parse(patchStatus.stdout);
    expect(patchPayload.updateAvailable).toBe(true);
    expect(patchPayload.eligible).toBe(false);
    expect(patchPayload.type).toBe('patch');

    const minorStatus = await execa('node', [CLI, 'update', 'status', '--json'], {
      cwd,
      env: baseEnv({
        HOME: home,
        XDG_CONFIG_HOME: path.join(home, '.config'),
        PRAE_TEST: '1',
        PRAE_UPDATE_INFO_JSON: JSON.stringify({
          current: pkg.version,
          latest: '0.3.0',
          type: 'minor'
        })
      })
    });
    const minorPayload = JSON.parse(minorStatus.stdout);
    expect(minorPayload.updateAvailable).toBe(true);
    expect(minorPayload.eligible).toBe(true);
    expect(minorPayload.type).toBe('minor');
  });
});
