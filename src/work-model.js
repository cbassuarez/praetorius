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
  // Remove fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, ' ');
  // Remove inline code
  text = text.replace(/`[^`]*`/g, ' ');
  // Images ![alt](url) → alt
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  // Links [label](url) → label
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Headings
  text = text.replace(/^#{1,6}\s*/gm, '');
  // Blockquotes
  text = text.replace(/^>\s?/gm, '');
  // Emphasis/bold
  text = text.replace(/([*_~]{1,3})([^*_~]+)\1/g, '$2');
  // HTML tags
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

function ensureOneField(candidate, fallbackTitle) {
  const normalized = toSingleLine(candidate);
  if (normalized) return clampOneliner(normalized);
  if (fallbackTitle) return clampOneliner(fallbackTitle);
  return 'Untitled work';
}

/**
 * @param {import('./types').Work} work
 * @returns {import('./types').WorkViewModel}
 */
export function normalizeWork(work = {}) {
  const clone = { ...work };
  const legacyOne = toSingleLine(clone.one);
  const explicitOnelinerSource = clone.oneliner !== undefined ? clone.oneliner : clone.one;
  const explicitOneliner = clampOneliner(toSingleLine(explicitOnelinerSource));
  const description = normalizeDescription(clone.description);

  if (typeof clone.one === 'string') clone.one = legacyOne;
  if (clone.oneliner !== undefined) {
    clone.oneliner = explicitOneliner;
  } else if (explicitOneliner) {
    clone.oneliner = explicitOneliner;
  }
  if (description !== null) clone.description = description;

  let onelinerEffective = explicitOneliner;
  if (!onelinerEffective) {
    onelinerEffective = clampOneliner(deriveOnelinerFromDescription(description));
  }
  if (!onelinerEffective) {
    onelinerEffective = clampOneliner(legacyOne);
  }
  const descriptionEffective = description || onelinerEffective || null;

  const ensuredOne = ensureOneField(onelinerEffective || legacyOne, clone.title);
  clone.one = ensuredOne;

  return {
    ...clone,
    onelinerEffective: onelinerEffective || null,
    descriptionEffective,
  };
}

/**
 * Collect soft warnings for authoring guidance.
 * @param {import('./types').Work | import('./types').WorkViewModel} work
 * @returns {string[]}
 */
export function collectWorkWarnings(work = {}) {
  const warnings = [];
  const rawSource = coerceString(work.oneliner ?? work.one ?? '');
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
