const MAX_ONELINER_LENGTH = 240;
const RECOMMENDED_ONELINER_LENGTH = 160;

function coerceString(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function toSingleLine(value) {
  const raw = coerceString(value);
  if (!raw) return '';
  const withoutBreaks = raw.replace(/[\r\n]+/g, ' ');
  return collapseWhitespace(withoutBreaks);
}

function normalizeDescription(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    const joined = value.map(coerceString).join('\n\n');
    const normalized = joined.replace(/[\r\n]{3,}/g, '\n\n');
    const trimmed = normalized.trim();
    return trimmed ? trimmed : null;
  }
  const str = coerceString(value);
  const trimmed = str.replace(/\r\n?/g, '\n').trim();
  return trimmed ? trimmed : null;
}

function stripMarkdown(input) {
  let text = coerceString(input);
  if (!text) return '';
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/`[^`]*`/g, ' ');
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/^#{1,6}\s*/gm, '');
  text = text.replace(/^>\s?/gm, '');
  text = text.replace(/([*_~]{1,3})([^*_~]+)\1/g, '$2');
  text = text.replace(/<[^>]+>/g, ' ');
  return collapseWhitespace(text);
}

function truncateWithEllipsis(text, limit) {
  if (!text) return '';
  if (text.length <= limit) return text;
  const slice = text.slice(0, Math.max(0, limit - 1));
  const trimmed = slice.replace(/\s+\S*$/, '').trim();
  if (trimmed.length >= limit - 1) return `${trimmed}…`;
  return `${text.slice(0, limit - 1).trim()}…`;
}

function deriveOnelinerFromDescription(description) {
  if (!description) return '';
  const plain = stripMarkdown(description);
  if (!plain) return '';
  const sentenceMatch = plain.match(/(.+?[.!?])(?=\s|$)/);
  let candidate = sentenceMatch ? sentenceMatch[1] : plain;
  if (!sentenceMatch) {
    const firstBreak = candidate.indexOf('\n');
    if (firstBreak >= 0) candidate = candidate.slice(0, firstBreak);
  }
  candidate = collapseWhitespace(candidate);
  if (!candidate) return '';
  return truncateWithEllipsis(candidate, RECOMMENDED_ONELINER_LENGTH);
}

function clampOneliner(value) {
  if (!value) return '';
  return truncateWithEllipsis(value, MAX_ONELINER_LENGTH);
}

export function normalizeWork(work = {}) {
  const source = work || {};
  const base = { ...source };

  const rawSingleLine = coerceString(base.oneliner ?? base.one ?? '');
  const src = collapseWhitespace(rawSingleLine.replace(/\r?\n+/g, ' '));
  const normalizedOneliner = clampOneliner(src);

  const descriptionSource = base.description !== undefined ? base.description : base.desc;
  const description = normalizeDescription(descriptionSource);

  let onelinerEffective = normalizedOneliner;
  if (!onelinerEffective) {
    const derived = clampOneliner(deriveOnelinerFromDescription(description));
    if (derived) onelinerEffective = derived;
  }
  const titleCandidate = clampOneliner(collapseWhitespace(coerceString(base.title)));
  if (!onelinerEffective && titleCandidate) {
    onelinerEffective = titleCandidate;
  }

  const descriptionEffective = description ?? (normalizedOneliner || null);

  const normalized = {
    ...base,
  };

  if (normalized.desc !== undefined) delete normalized.desc;

  if (normalizedOneliner) normalized.oneliner = normalizedOneliner;
  else if ('oneliner' in normalized) delete normalized.oneliner;

  if (description !== null) normalized.description = description;
  else if ('description' in normalized) normalized.description = null;

  let ensuredOne = onelinerEffective || normalizedOneliner || titleCandidate || '';
  if (!ensuredOne) ensuredOne = 'Untitled work';
  normalized.one = ensuredOne;

  return {
    ...normalized,
    onelinerEffective: onelinerEffective || null,
    descriptionEffective,
  };
}

export function collectWorkWarnings(work = {}) {
  const warnings = [];
  const rawSource = coerceString(work.oneliner ?? work.one ?? '');
  const hasOneliner = work.oneliner !== undefined && work.oneliner !== null;
  const hasLegacy = work.one !== undefined && work.one !== null;

  if (hasOneliner && hasLegacy) {
    const newVal = collapseWhitespace(coerceString(work.oneliner)).trim();
    const legacyVal = collapseWhitespace(coerceString(work.one)).trim();
    if (newVal && legacyVal && newVal !== legacyVal) {
      warnings.push('Both "oneliner" and legacy "one" provided; "oneliner" will be used (remove "one" after migrating).');
    }
  }

  if (/\r|\n/.test(rawSource)) {
    warnings.push('Oneliner contains line breaks; they will be collapsed to a single space.');
  }
  const normalized = toSingleLine(rawSource);
  if (normalized.length > RECOMMENDED_ONELINER_LENGTH) {
    warnings.push(`Oneliner is ${normalized.length} characters (recommended ≤ ${RECOMMENDED_ONELINER_LENGTH}).`);
  }
  if (normalized.length > MAX_ONELINER_LENGTH) {
    warnings.push(`Oneliner exceeds ${MAX_ONELINER_LENGTH} characters and will be truncated.`);
  }
  return warnings;
}

export const __workModelInternals = {
  toSingleLine,
  normalizeDescription,
  stripMarkdown,
  deriveOnelinerFromDescription,
  clampOneliner,
};
