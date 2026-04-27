import { createDefaultProjectState, hydrateProjectState, runFolioCommand } from '../../../../src/web/folio-runtime.js';

type WorkerRequest = {
  id: string;
  kind: 'hydrate' | 'run' | 'get';
  state?: unknown;
  argv?: string[];
};

type WorkerResponse = {
  id: string;
  ok: boolean;
  output: string[];
  state: unknown;
  exportText?: string | null;
  artifacts?: unknown;
  error?: string;
};

let state = createDefaultProjectState();

function post(payload: WorkerResponse) {
  (self as unknown as Worker).postMessage(payload);
}

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;
  if (!message || !message.id) return;

  try {
    if (message.kind === 'hydrate') {
      state = hydrateProjectState(message.state);
      post({
        id: message.id,
        ok: true,
        output: ['state hydrated'],
        state,
      });
      return;
    }

    if (message.kind === 'get') {
      post({ id: message.id, ok: true, output: ['state read'], state });
      return;
    }

    if (message.kind === 'run') {
      const argv = Array.isArray(message.argv) ? message.argv : [];
      const result = runFolioCommand(state, argv);
      state = result.state;
      post({
        id: message.id,
        ok: result.ok,
        output: result.output,
        state,
        exportText: result.exportText,
        artifacts: result.artifacts,
      });
      return;
    }

    post({
      id: message.id,
      ok: false,
      output: ['error: unknown worker request kind'],
      state,
      error: 'unknown worker request kind',
    });
  } catch (err: any) {
    post({
      id: message.id,
      ok: false,
      output: [`error: ${err?.message || String(err)}`],
      state,
      error: err?.message || String(err),
    });
  }
});
