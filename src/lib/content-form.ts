/**
 * Helpers for the schema-driven section editor (components/ContentForm.tsx).
 * The editor renders whatever shape a section's content has; these functions
 * keep that shape valid for the server's schemas (backend registry.ts).
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export type Path = (string | number)[];

/** Fields the server treats as optional: an empty value is removed before saving. */
export const OPTIONAL_KEYS = new Set([
  'subtitle',
  'link',
  'enquiry',
  'successTitle',
  'facebook',
  'instagram',
  'youtube',
  'x',
  'tab',
  'lines',
  'icon',
]);

/** Extra optional fields offered even when the current content doesn't have them. */
const EXTRA_FIELDS: Record<string, Record<string, Json>> = {
  social: { facebook: '', instagram: '', youtube: '', x: '' },
};

export const isObject = (v: unknown): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v);

/** Same shape with every leaf emptied - the template for "Add item". */
export function blankLike(v: Json): Json {
  if (typeof v === 'string') return '';
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return false;
  if (Array.isArray(v)) return [];
  if (isObject(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankLike(x)]));
  return null;
}

/**
 * Prepares loaded content for editing: list items get every key any sibling
 * has (so e.g. a service card can switch between a booking tab and a WhatsApp
 * enquiry), and known optional extras appear as empty fields.
 */
export function normalize(v: Json, key = ''): Json {
  if (Array.isArray(v)) {
    const objects = v.filter(isObject);
    if (objects.length === v.length && objects.length > 1) {
      const union: JsonObject = {};
      for (const o of objects) for (const [k, x] of Object.entries(o)) if (!(k in union)) union[k] = blankLike(x);
      return objects.map((o) => normalize({ ...union, ...o }));
    }
    return v.map((x) => normalize(x));
  }
  if (isObject(v)) {
    const extra = EXTRA_FIELDS[key] ?? {};
    const out: JsonObject = { ...extra };
    for (const [k, x] of Object.entries(v)) out[k] = normalize(x, k);
    return out;
  }
  return v;
}

/** Strips empty optional values and contradictory bits before sending. */
export function clean(v: Json, key = ''): Json | undefined {
  if (Array.isArray(v)) {
    const items = v.map((x) => clean(x)).filter((x) => x !== undefined) as Json[];
    return OPTIONAL_KEYS.has(key) && items.length === 0 ? undefined : items;
  }
  if (isObject(v)) {
    const out: JsonObject = {};
    for (const [k, x] of Object.entries(v)) {
      const c = clean(x, k);
      if (c !== undefined) out[k] = c;
    }
    // A closed weekday carries no times.
    if (out.closed === true) {
      delete out.open;
      delete out.close;
    }
    // An optional object left completely empty (e.g. a heading link).
    if (OPTIONAL_KEYS.has(key) && Object.values(out).every((x) => x === '' || x === undefined)) return undefined;
    return out;
  }
  if (typeof v === 'string' && v.trim() === '' && OPTIONAL_KEYS.has(key)) return undefined;
  return v;
}

/** "companyName" -> "Company name", "hoursRows" -> "Hours rows". */
export function humanize(key: string | number): string {
  if (typeof key === 'number') return `Item ${key + 1}`;
  const words = key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  const fixed = words.replace(/\burl\b/g, 'URL').replace(/\bcta\b/g, 'CTA').replace(/\biata\b/g, 'IATA').replace(/\btel\b/g, 'phone (dial)');
  return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

/** Paths of required text fields that are empty. */
export function emptyRequired(v: Json, path: Path = [], key = ''): Path[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => emptyRequired(x, [...path, i], key));
  if (isObject(v)) {
    if (OPTIONAL_KEYS.has(key) && Object.values(v).every((x) => x === '')) return [];
    const closed = v.closed === true;
    return Object.entries(v).flatMap(([k, x]) => (closed && (k === 'open' || k === 'close') ? [] : emptyRequired(x, [...path, k], k)));
  }
  if (typeof v === 'string' && v.trim() === '' && !OPTIONAL_KEYS.has(key)) return [path];
  return [];
}

export const pathLabel = (path: Path) => path.map((p) => humanize(p)).join(' › ');

export const samePath = (a: Path, b: Path) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Immutable set at path. */
export function setIn(root: Json, path: Path, value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setIn(copy[head as number], rest, value);
    return copy;
  }
  const obj = isObject(root) ? root : {};
  return { ...obj, [head]: setIn(obj[head as string] ?? null, rest, value) };
}

export const fingerprint = (v: unknown) => JSON.stringify(v ?? null);

/** Kind of widget a string field gets, from its key. */
export function stringWidget(key: string, value: string): 'image' | 'icon' | 'accent' | 'url' | 'time' | 'tab' | 'kind' | 'textarea' | 'text' {
  if (/image|logo|photo/i.test(key) && !/position/i.test(key)) return 'image';
  if (key === 'icon') return 'icon';
  if (key === 'accent') return 'accent';
  if (key === 'open' || key === 'close') return 'time';
  if (key === 'tab') return 'tab';
  if (key === 'kind') return 'kind';
  if (/url|link|href/i.test(key)) return 'url';
  if (value.length > 90 || /text|body|description|subtitle|paragraph|caption|message|blurb|enquiry/i.test(key)) return 'textarea';
  return 'text';
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
