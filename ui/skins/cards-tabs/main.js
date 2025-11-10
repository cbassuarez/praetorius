const METRIC_ORDER_KEY = 'cards-tabs.metrics.order';
const TAB_HASH_KEY = 'cards-tabs.tab.hash';
const FILTER_STATE_KEY = 'cards-tabs.filters.state';

const METRICS = [
  {
    id: 'new-subscribers',
    label: 'New subscribers',
    value: 248,
    delta: '+18%',
    trend: 'up',
    completion: 0.72,
    points: [5, 7, 6, 8, 9, 11, 12]
  },
  {
    id: 'queue-depth',
    label: 'Queue depth',
    value: 38,
    delta: '-6%',
    trend: 'down',
    completion: 0.42,
    points: [12, 10, 9, 8, 7, 6, 5]
  },
  {
    id: 'avg-turnaround',
    label: 'Avg. turnaround',
    value: '2.8 h',
    delta: '-11%',
    trend: 'up',
    completion: 0.58,
    points: [7, 6, 6, 5, 4, 4, 3]
  },
  {
    id: 'open-issues',
    label: 'Open issues',
    value: 14,
    delta: '+2',
    trend: 'warn',
    completion: 0.23,
    points: [3, 4, 4, 6, 9, 11, 14]
  }
];

const QUICK_ACTIONS = [
  { id: 'refresh', label: 'Run sync', description: 'Pull the latest activity from integrations.', shortcut: 'r' },
  { id: 'invite', label: 'Invite collaborator', description: 'Send an access link with staging permissions.', shortcut: 'i' },
  { id: 'publish', label: 'Publish changes', description: 'Push the most recent edits live.', shortcut: 'p' },
  { id: 'archive', label: 'Archive queue', description: 'Snooze low-priority tasks until next week.', shortcut: 'a' }
];

const FEED_SEED = [
  { id: 'act-1', type: 'update', title: 'Prae Ensemble rehearsed Movement IV', by: 'Morgan', minutesAgo: 14 },
  { id: 'act-2', type: 'alert', title: 'Score PDF missing page markers', by: 'System', minutesAgo: 47 },
  { id: 'act-3', type: 'note', title: 'Commissioner uploaded revisions', by: 'Aria', minutesAgo: 93 },
  { id: 'act-4', type: 'success', title: 'Queue cleared for tonight', by: 'Morgan', minutesAgo: 120 },
  { id: 'act-5', type: 'update', title: 'New cue timings synced', by: 'System', minutesAgo: 240 },
  { id: 'act-6', type: 'alert', title: 'Audio HUD latency spike detected', by: 'Monitoring', minutesAgo: 360 }
];

const QUEUE_ROWS = [
  { name: 'Orchestra — Dress', owner: 'Morgan', tasks: 12, eta: '2h', state: 'ok' },
  { name: 'Wind band edits', owner: 'Dana', tasks: 7, eta: '6h', state: 'pending' },
  { name: 'Chamber notes', owner: 'Alex', tasks: 4, eta: '1d', state: 'warn' },
  { name: 'Youth ensemble', owner: 'Taylor', tasks: 9, eta: '3d', state: 'ok' }
];

const RESULT_ROWS = [
  { name: 'HUD playback', lastRun: '2 minutes ago', status: 'ok' },
  { name: 'PDF stitching', lastRun: '14 minutes ago', status: 'ok' },
  { name: 'Cue validation', lastRun: '22 minutes ago', status: 'warn' },
  { name: 'Score export', lastRun: '58 minutes ago', status: 'pending' },
  { name: 'Webhooks', lastRun: '1 hour ago', status: 'err' }
];

function ready(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function ensureThemeHelpers() {
  if (typeof window.praeApplyTheme === 'function' && typeof window.praeCurrentTheme === 'function') {
    return {
      apply: window.praeApplyTheme,
      current: window.praeCurrentTheme,
      cycle: typeof window.praeCycleTheme === 'function'
        ? window.praeCycleTheme
        : () => window.praeApplyTheme(window.praeCurrentTheme() === 'dark' ? 'light' : 'dark')
    };
  }

  const STORAGE_KEY = 'wc.theme';
  const THEME_CLASSES = ['prae-theme-light', 'prae-theme-dark'];

  const normalize = (value) => (value === 'light' ? 'light' : 'dark');

  const readStoredTheme = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 'dark';
      if (raw.trim().startsWith('{')) {
        const parsed = JSON.parse(raw);
        return normalize(parsed?.mode);
      }
      return normalize(raw);
    } catch (_) {
      return 'dark';
    }
  };

  const sync = (mode) => {
    const eff = normalize(mode);
    const body = document.body;
    const html = document.documentElement;
    const host = document.getElementById('works-console');
    if (html) {
      html.setAttribute('data-theme', eff);
      html.style.colorScheme = eff;
    }
    if (body) {
      body.setAttribute('data-theme', eff);
      body.classList.remove(...THEME_CLASSES);
      body.classList.add(eff === 'dark' ? THEME_CLASSES[1] : THEME_CLASSES[0]);
    }
    if (host) {
      host.classList.remove(...THEME_CLASSES);
      host.classList.add(eff === 'dark' ? THEME_CLASSES[1] : THEME_CLASSES[0]);
      host.setAttribute('data-theme', eff);
    }
    return eff;
  };

  const apply = (mode, opts) => {
    const eff = sync(mode);
    if (!opts || opts.persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, eff); } catch (_) {}
    }
    updateThemeToggle(eff);
    return eff;
  };

  const current = () => {
    const bodyTheme = document.body?.getAttribute('data-theme');
    if (bodyTheme === 'light' || bodyTheme === 'dark') return bodyTheme;
    return readStoredTheme();
  };

  const cycle = () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
  };

  window.praeApplyTheme = apply;
  window.praeCurrentTheme = current;
  window.praeCycleTheme = cycle;

  return { apply, current, cycle };
}

function updateThemeToggle(mode) {
  const btn = document.getElementById('wc-theme-toggle');
  if (!btn) return;
  const nextTitle = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  btn.setAttribute('aria-checked', String(mode === 'dark'));
  btn.dataset.mode = mode;
  btn.title = nextTitle;
  btn.textContent = mode === 'dark' ? '🌙' : '☀️';
}

function initTheme() {
  const helpers = ensureThemeHelpers();
  const current = helpers.current();
  helpers.apply(current, { persist: false });
  updateThemeToggle(current);
  const btn = document.getElementById('wc-theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      helpers.cycle();
      updateThemeToggle(helpers.current());
    });
  }
}

function readMetricOrder() {
  try {
    const raw = localStorage.getItem(METRIC_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeMetricOrder(order) {
  try {
    localStorage.setItem(METRIC_ORDER_KEY, JSON.stringify(order));
  } catch (_) {}
}

function createMetricCard(metric) {
  const article = document.createElement('article');
  article.className = 'dash-metric-card';
  article.setAttribute('role', 'listitem');
  article.tabIndex = 0;
  article.dataset.metricId = metric.id;

  const header = document.createElement('div');
  header.className = 'dash-metric-meta';

  const title = document.createElement('p');
  title.className = 'dash-metric-name';
  title.textContent = metric.label;

  const delta = document.createElement('span');
  delta.className = 'dash-metric-delta';
  const trend = ['up', 'down', 'warn', 'flat'].includes(metric.trend) ? metric.trend : (metric.trend === 'down' ? 'down' : 'up');
  delta.dataset.trend = trend;
  delta.textContent = metric.delta;

  header.append(title, delta);

  const value = document.createElement('div');
  value.className = 'dash-metric-value';
  value.textContent = metric.value;

  const spark = document.createElement('canvas');
  spark.className = 'dash-sparkline';
  spark.height = 60;
  spark.width = 240;

  const progress = document.createElement('div');
  progress.className = 'dash-progress';
  const fill = document.createElement('span');
  fill.style.width = `${Math.round(metric.completion * 100)}%`;
  progress.appendChild(fill);

  article.append(header, value, spark, progress);

  article.addEventListener('click', () => {
    showToast({
      title: metric.label,
      message: 'Opening detailed report…',
      tone: 'pending'
    });
  });
  article.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      article.click();
    }
  });

  drawSparkline(spark, metric.points);
  return article;
}

function drawSparkline(canvas, points) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const spread = Math.max(1, max - min);
  const step = width / Math.max(1, points.length - 1);

  ctx.lineWidth = 1;
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--chart-grid') || 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  ctx.beginPath();
  points.forEach((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / spread) * (height - 6) - 3;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--chart-line') || '#6f8bff';
  ctx.lineWidth = 2;
  ctx.stroke();

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  const fillColor = getComputedStyle(document.body).getPropertyValue('--chart-fill') || 'rgba(111,139,255,0.3)';
  gradient.addColorStop(0, fillColor.trim());
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
}

function initMetrics() {
  const container = document.getElementById('dash-metric-list');
  if (!container) return;
  container.innerHTML = '';

  const savedOrder = readMetricOrder();
  const ordered = savedOrder
    ? savedOrder
        .map(id => METRICS.find(metric => metric.id === id))
        .filter(Boolean)
    : METRICS.slice();

  METRICS.forEach(metric => {
    if (!ordered.includes(metric)) ordered.push(metric);
  });

  ordered.forEach(metric => container.appendChild(createMetricCard(metric)));

  if (window.Sortable && typeof window.Sortable.create === 'function') {
    window.Sortable.create(container, {
      animation: 180,
      ghostClass: 'is-dragging',
      draggable: '.dash-metric-card',
      onEnd: () => {
        const order = Array.from(container.querySelectorAll('.dash-metric-card'))
          .map(node => node.dataset.metricId)
          .filter(Boolean);
        writeMetricOrder(order);
        showToast({ title: 'Order saved', message: 'Metric layout updated.', tone: 'ok' });
      }
    });
  }
}

function renderQuickActions() {
  const region = document.getElementById('dash-actions');
  const status = document.getElementById('dash-action-status');
  if (!region || !status) return;
  region.innerHTML = '';
  status.textContent = 'Select an action to begin.';

  const state = new Map();

  const perform = (action) => {
    if (state.get(action.id) === 'loading') return;
    state.set(action.id, 'loading');
    updateButtonState(action.id, true);
    status.textContent = `${action.label} started…`;

    const duration = 1000 + Math.random() * 1200;
    setTimeout(() => {
      const success = Math.random() > 0.12;
      state.set(action.id, success ? 'ok' : 'err');
      updateButtonState(action.id, false);
      const tone = success ? 'ok' : 'err';
      const text = success ? `${action.label} completed.` : `${action.label} failed. Try again.`;
      status.textContent = text;
      showToast({ title: action.label, message: text, tone });
    }, duration);
  };

  const updateButtonState = (id, loading) => {
    const btn = region.querySelector(`[data-action-id="${id}"]`);
    if (!btn) return;
    btn.dataset.loading = String(!!loading);
    btn.setAttribute('aria-busy', String(!!loading));
  };

  QUICK_ACTIONS.forEach(action => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dash-action-btn';
    btn.dataset.actionId = action.id;
    btn.innerHTML = `
      <strong>${action.label}</strong>
      <span>${action.description}</span>
      <span class="dash-action-shortcut">${action.shortcut.toUpperCase()}</span>
    `;
    btn.addEventListener('click', () => perform(action));
    btn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        perform(action);
      }
    });
    region.appendChild(btn);
  });

  document.addEventListener('keydown', (event) => {
    const tag = event.target?.tagName;
    if (tag && (/input|textarea|select/.test(tag.toLowerCase()))) return;
    const action = QUICK_ACTIONS.find(item => item.shortcut.toLowerCase() === event.key.toLowerCase());
    if (action) {
      event.preventDefault();
      perform(action);
    }
  });
}

function timeAgo(minutesAgo) {
  const now = Date.now();
  const then = now - minutesAgo * 60 * 1000;
  const diffMs = then - now;
  const minutes = Math.round(diffMs / (60 * 1000));
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
    if (Math.abs(minutes) < 60) return rtf.format(minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
    const days = Math.round(hours / 24);
    return rtf.format(days, 'day');
  } catch (_) {
    if (Math.abs(minutes) < 60) return `${Math.abs(minutes)} min ago`;
    const hours = Math.round(Math.abs(minutes) / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    return `${days} d ago`;
  }
}

const FEED_TYPES = {
  update: { icon: '📝', label: 'Update' },
  alert: { icon: '⚠️', label: 'Alert' },
  note: { icon: '💬', label: 'Note' },
  success: { icon: '✅', label: 'Success' }
};

function renderActivityFeed(feedItems) {
  const list = document.getElementById('dash-activity-feed');
  if (!list) return;
  list.innerHTML = '';
  feedItems.forEach(item => {
    const meta = FEED_TYPES[item.type] || FEED_TYPES.update;
    const li = document.createElement('li');
    li.className = 'dash-activity-item';
    li.dataset.type = item.type;

    const icon = document.createElement('div');
    icon.className = 'dash-activity-icon';
    icon.textContent = meta.icon;

    const body = document.createElement('div');
    body.className = 'dash-activity-body';

    const title = document.createElement('p');
    title.className = 'dash-activity-title';
    title.textContent = item.title;

    const metaRow = document.createElement('div');
    metaRow.className = 'dash-activity-meta';
    const author = document.createElement('span');
    author.textContent = `${meta.label} · ${item.by}`;
    const time = document.createElement('time');
    time.dateTime = new Date(Date.now() - item.minutesAgo * 60000).toISOString();
    time.textContent = timeAgo(item.minutesAgo);
    metaRow.append(author, time);

    body.append(title, metaRow);
    li.append(icon, body);
    list.appendChild(li);
  });
}

function renderActivityFilters(activeType) {
  const container = document.getElementById('dash-activity-filters');
  if (!container) return;
  container.innerHTML = '';
  const types = ['all', ...Object.keys(FEED_TYPES)];
  types.forEach(type => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dash-chip';
    btn.textContent = type === 'all' ? 'All' : FEED_TYPES[type].label;
    btn.setAttribute('aria-pressed', String(type === activeType));
    btn.addEventListener('click', () => {
      saveFilterState({ activity: type });
      renderActivityFilters(type);
      const feed = type === 'all' ? FEED_SEED : FEED_SEED.filter(item => item.type === type);
      renderActivityFeed(feed);
    });
    container.appendChild(btn);
  });
}

function loadMoreActivity(currentCount) {
  const extra = FEED_SEED.map((item, idx) => ({
    ...item,
    id: `${item.id}-more-${currentCount + idx}`,
    minutesAgo: item.minutesAgo + (idx + 1) * 45
  }));
  return extra;
}

function initActivity() {
  const initialFilter = readFilterState().activity || 'all';
  renderActivityFilters(initialFilter);
  const feed = initialFilter === 'all' ? FEED_SEED : FEED_SEED.filter(item => item.type === initialFilter);
  renderActivityFeed(feed);

  const moreBtn = document.getElementById('dash-activity-more');
  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      const list = document.getElementById('dash-activity-feed');
      if (!list) return;
      const more = loadMoreActivity(list.children.length);
      more.forEach(item => FEED_SEED.push(item));
      const active = readFilterState().activity || 'all';
      const feedItems = active === 'all' ? FEED_SEED : FEED_SEED.filter(entry => entry.type === active);
      renderActivityFeed(feedItems);
      showToast({ title: 'Activity', message: 'Loaded more entries.', tone: 'ok' });
    });
  }
}

function readFilterState() {
  try {
    const raw = localStorage.getItem(FILTER_STATE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveFilterState(partial) {
  const current = readFilterState();
  const next = { ...current, ...partial };
  try {
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(next));
  } catch (_) {}
  return next;
}

function initFilters() {
  const statusSelect = document.getElementById('dash-filter-status');
  const dateInput = document.getElementById('dash-filter-date');
  const form = statusSelect?.form;
  const state = readFilterState();

  if (statusSelect && state.status) statusSelect.value = state.status;
  if (dateInput && state.date) dateInput.value = state.date;

  if (typeof window.Choices === 'function' && statusSelect) {
    new window.Choices(statusSelect, {
      searchEnabled: false,
      allowHTML: false,
      position: 'bottom',
      shouldSort: false
    });
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const status = statusSelect ? statusSelect.value : 'all';
      const date = dateInput ? dateInput.value : '';
      saveFilterState({ status, date });
      showToast({
        title: 'Filters updated',
        message: `Status: ${statusSelect?.selectedOptions?.[0]?.textContent || status}, Date: ${date || 'Any time'}`,
        tone: 'ok'
      });
      form.classList.add('is-applied');
      window.requestAnimationFrame(() => form.classList.remove('is-applied'));
    });
  }
}

function showToast({ title, message, tone = 'ok', duration = 2800 }) {
  const host = document.getElementById('dash-toasts');
  if (!host) return;
  const toast = document.createElement('div');
  toast.className = 'dash-toast';
  toast.dataset.tone = tone;
  toast.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
  host.appendChild(toast);
  requestAnimationFrame(() => {
    toast.dataset.visible = 'true';
  });
  setTimeout(() => {
    toast.dataset.visible = 'false';
    setTimeout(() => {
      if (toast.parentNode === host) host.removeChild(toast);
    }, 220);
  }, duration);
}

function parseHashTab() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  const query = hash.includes('=') ? hash : `tab=${hash}`;
  const params = new URLSearchParams(query);
  const tab = params.get('tab');
  if (!tab) return null;
  return tab.toLowerCase();
}

function updateHash(tabId) {
  const params = new URLSearchParams(window.location.hash.slice(1));
  params.set('tab', tabId);
  const newHash = `#${params.toString()}`;
  if (window.location.hash !== newHash) {
    window.history.replaceState({}, '', newHash);
  }
  try { localStorage.setItem(TAB_HASH_KEY, tabId); } catch (_) {}
}

function readStoredTab() {
  const hashTab = parseHashTab();
  if (hashTab) return hashTab;
  try {
    const stored = localStorage.getItem(TAB_HASH_KEY);
    return stored || null;
  } catch (_) {
    return null;
  }
}

function initTabs() {
  const tabButtons = Array.from(document.querySelectorAll('.dash-tab'));
  const panels = new Map();
  tabButtons.forEach(btn => {
    const panel = document.getElementById(btn.getAttribute('aria-controls') || '');
    if (panel) panels.set(btn.id, panel);
  });
  if (!tabButtons.length || panels.size === 0) return;

  let activeId = readStoredTab() || 'activity';
  if (!tabButtons.some(btn => btn.id === `dash-tab-${activeId}`)) activeId = 'activity';

  const activate = (id, { focus } = { focus: false }) => {
    tabButtons.forEach((btn, idx) => {
      const isActive = btn.id === `dash-tab-${id}`;
      btn.setAttribute('aria-selected', String(isActive));
      btn.tabIndex = isActive ? 0 : -1;
      if (isActive && focus) btn.focus();
      const panel = panels.get(btn.id);
      if (panel) {
        if (isActive) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', '');
        }
      }
    });
    activeId = id;
    updateHash(id);
    renderPanel(id);
  };

  const renderPanel = (id) => {
    const panel = document.getElementById(`dash-panel-${id}`);
    if (!panel) return;
    panel.innerHTML = '';
    if (id === 'activity') {
      panel.innerHTML = `
        <h3>Recent highlights</h3>
        <p>Monitor critical wins and alerts without losing sight of the full feed.</p>
        <ul>
          ${FEED_SEED.slice(0, 3).map(item => {
            const state = mapTypeToState(item.type);
            return `<li>${item.title} — <span class="dash-state" data-state="${state}">${formatStateLabel(state)}</span></li>`;
          }).join('')}
        </ul>
      `;
    } else if (id === 'queues') {
      const table = document.createElement('table');
      table.innerHTML = `
        <thead>
          <tr><th>Queue</th><th>Owner</th><th>Tasks</th><th>ETA</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${QUEUE_ROWS.map(row => `
            <tr>
              <td>${row.name}</td>
              <td>${row.owner}</td>
              <td>${row.tasks}</td>
              <td>${row.eta}</td>
              <td><span class="dash-state" data-state="${row.state}">${row.state}</span></td>
            </tr>
          `).join('')}
        </tbody>
      `;
      panel.appendChild(table);
    } else if (id === 'results') {
      const list = document.createElement('div');
      list.className = 'dash-results';
      RESULT_ROWS.forEach(row => {
        const item = document.createElement('div');
        item.className = 'dash-result-item';
        item.innerHTML = `
          <strong>${row.name}</strong>
          <span>${row.lastRun}</span>
          <span class="dash-state" data-state="${row.status}">${formatStateLabel(row.status)}</span>
        `;
        list.appendChild(item);
      });
      panel.appendChild(list);
    } else if (id === 'settings') {
      panel.innerHTML = `
        <h3>Workspace settings</h3>
        <p>These controls are optimistic—adjust values and wire them to the Works Console later.</p>
        <label class="dash-filter" for="dash-setting-name">
          <span>Workspace name</span>
          <input id="dash-setting-name" type="text" value="Praetorius Dashboard"/>
        </label>
        <label class="dash-filter" for="dash-setting-email">
          <span>Notification email</span>
          <input id="dash-setting-email" type="email" value="hud@praetorius.dev"/>
        </label>
        <button type="button" class="dash-filter-apply" id="dash-settings-save">Save</button>
      `;
      const save = panel.querySelector('#dash-settings-save');
      if (save) {
        save.addEventListener('click', () => {
          showToast({ title: 'Settings', message: 'Settings saved (mock).', tone: 'ok' });
        });
      }
    }
  };

  const mapTypeToState = (type) => {
    if (type === 'alert') return 'warn';
    if (type === 'success') return 'ok';
    if (type === 'note') return 'pending';
    return 'ok';
  };

  const formatStateLabel = (state) => {
    const normalized = String(state || '');
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => activate(btn.id.replace('dash-tab-', ''), { focus: true }));
    btn.addEventListener('keydown', (event) => {
      const idx = tabButtons.indexOf(btn);
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const next = tabButtons[(idx + 1) % tabButtons.length];
        activate(next.id.replace('dash-tab-', ''), { focus: true });
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const prev = tabButtons[(idx - 1 + tabButtons.length) % tabButtons.length];
        activate(prev.id.replace('dash-tab-', ''), { focus: true });
      } else if (event.key === 'Home') {
        event.preventDefault();
        activate(tabButtons[0].id.replace('dash-tab-', ''), { focus: true });
      } else if (event.key === 'End') {
        event.preventDefault();
        activate(tabButtons[tabButtons.length - 1].id.replace('dash-tab-', ''), { focus: true });
      }
    });
  });

  window.addEventListener('hashchange', () => {
    const next = parseHashTab();
    if (next && next !== activeId && tabButtons.some(btn => btn.id === `dash-tab-${next}`)) {
      activate(next, { focus: false });
    }
  });

  activate(activeId);
}

ready(() => {
  initTheme();
  initMetrics();
  renderQuickActions();
  initActivity();
  initFilters();
  initTabs();
});
