import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import {
  WEEKDAYS,
  blankLike,
  humanize,
  isObject,
  samePath,
  setIn,
  stringWidget,
  type Json,
  type JsonObject,
  type Path,
} from '../lib/content-form';
import { ACCENTS, ICONS, ICON_NAMES } from '../lib/site-content';
import { BTN_GHOST, BTN_SM, FIELD_LABEL, GRADIENTS, INPUT, LABEL, SELECT, type Accent } from '../lib/ui-styles';
import ImagePicker from './ImagePicker';
import Switch from './Switch';

/**
 * Edits any section's content by walking its shape: strings, numbers,
 * booleans, string lists, repeatable item cards and nested groups, with
 * special widgets chosen by field name (images, icons, accents, times...).
 * The server validates against the real schema; this form just mirrors it.
 */
export default function ContentForm({
  value,
  onChange,
  disabled,
  emptyPaths,
  imageSlots = false,
  brokenUrls,
}: {
  value: Json;
  onChange: (next: Json) => void;
  disabled?: boolean;
  /** Required fields that are empty, highlighted in red. */
  emptyPaths: Path[];
  /** Every text field is an optional image slot (Site-wide images). */
  imageSlots?: boolean;
  /** Image URLs whose files were deleted from the bucket. */
  brokenUrls?: Set<string>;
}) {
  const ctx: Ctx = {
    disabled: !!disabled,
    imageSlots,
    brokenUrls: brokenUrls ?? new Set(),
    isEmpty: (p) => emptyPaths.some((e) => samePath(e, p)),
    set: (path, v) => onChange(setIn(value, path, v)),
  };
  if (!isObject(value)) return <p className="text-sm text-inactive">This section has no editable fields.</p>;
  return <ObjectFields obj={value} path={[]} ctx={ctx} />;
}

interface Ctx {
  disabled: boolean;
  imageSlots: boolean;
  brokenUrls: Set<string>;
  isEmpty: (path: Path) => boolean;
  set: (path: Path, value: Json) => void;
}

const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-lg text-inactive transition-colors hover:bg-primary-tint hover:text-links disabled:pointer-events-none disabled:opacity-30';

const fieldId = (path: Path) => `f-${path.join('-')}`;

function ObjectFields({ obj, path, ctx }: { obj: JsonObject; path: Path; ctx: Ctx }) {
  // Weekday hours: times only matter when the day isn't closed.
  const closed = obj.closed === true;
  const entries = Object.entries(obj).filter(([k]) => !(closed && (k === 'open' || k === 'close')));
  const simple = entries.filter(([, v]) => !Array.isArray(v) && !isObject(v));
  const complex = entries.filter(([, v]) => Array.isArray(v) || isObject(v));
  return (
    <div className="space-y-4">
      {simple.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {simple.map(([k, v]) => (
            <div key={k} className={wide(k, v) ? 'sm:col-span-2' : ''}>
              <Field keyName={k} value={v} path={[...path, k]} ctx={ctx} parent={obj} />
            </div>
          ))}
        </div>
      )}
      {complex.map(([k, v]) => (
        <Field key={k} keyName={k} value={v} path={[...path, k]} ctx={ctx} parent={obj} />
      ))}
    </div>
  );
}

const wide = (k: string, v: Json) =>
  typeof v === 'string' && ['textarea', 'image', 'url'].includes(stringWidget(k, v));

function Field({ keyName, value, path, ctx, parent }: { keyName: string; value: Json; path: Path; ctx: Ctx; parent: JsonObject }) {
  const label = humanize(keyName);
  const id = fieldId(path);

  if (typeof value === 'boolean') {
    const isClosed = keyName === 'closed';
    return (
      <div>
        <p className={FIELD_LABEL}>{isClosed ? 'Open or closed' : label}</p>
        <Switch
          checked={isClosed ? !value : value}
          onChange={(on) => {
            if (!isClosed) return ctx.set(path, on);
            // Opening a closed day needs times; prefill sensible ones.
            const parentPath = path.slice(0, -1);
            ctx.set(parentPath, { ...parent, closed: !on, open: (parent.open as string) || '10:00', close: (parent.close as string) || '19:00' });
          }}
          label={label}
          disabled={ctx.disabled}
          onLabel={isClosed ? 'Open' : 'Yes'}
          offLabel={isClosed ? 'Closed' : 'No'}
        />
      </div>
    );
  }

  if (typeof value === 'number') {
    return (
      <div>
        <label htmlFor={id} className={FIELD_LABEL}>
          {label}
        </label>
        <input id={id} type="number" value={value} disabled={ctx.disabled} onChange={(e) => ctx.set(path, Number(e.target.value))} className={INPUT} />
      </div>
    );
  }

  if (typeof value === 'string' || value === null) {
    return <StringField keyName={keyName} value={value ?? ''} path={path} ctx={ctx} />;
  }

  if (Array.isArray(value)) {
    if (keyName === 'days' && value.every((x) => typeof x === 'number')) {
      return <Weekdays label={label} value={value as number[]} path={path} ctx={ctx} />;
    }
    const isObjects = value.length > 0 && value.every(isObject);
    if (isObjects) return <ObjectList label={label} items={value as JsonObject[]} path={path} ctx={ctx} />;
    return <StringList label={label} items={value as string[]} path={path} ctx={ctx} keyName={keyName} />;
  }

  return (
    <fieldset className="rounded-xl border border-tertiary-button p-4">
      <legend className={`px-1.5 ${LABEL}`}>{label}</legend>
      <ObjectFields obj={value} path={path} ctx={ctx} />
    </fieldset>
  );
}

function StringField({ keyName, value, path, ctx }: { keyName: string; value: string; path: Path; ctx: Ctx }) {
  const label = humanize(keyName);
  const id = fieldId(path);
  const invalid = !ctx.imageSlots && ctx.isEmpty(path);
  const widget = ctx.imageSlots ? 'image' : stringWidget(keyName, value);
  const cls = `${INPUT} ${invalid ? '!border-danger/60 ring-2 ring-danger/15' : ''}`;
  const hint = /\{year\}|\{name\}/.test(value) ? 'Placeholders like {year} or {name} are filled in automatically.' : keyName === 'imagePosition' ? 'Which part of the photo stays in view, e.g. "center 60%".' : null;

  let control;
  switch (widget) {
    case 'image':
      control = (
        <ImagePicker
          value={value}
          onChange={(url) => ctx.set(path, ctx.imageSlots && !url ? null : url)}
          disabled={ctx.disabled}
          label={label}
          invalid={invalid}
          deleted={ctx.brokenUrls.has(value)}
          clearable={ctx.imageSlots}
        />
      );
      break;
    case 'icon': {
      const Icon = ICONS[value];
      control = (
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-links">
            {Icon ? <Icon className="h-5 w-5" /> : <span className="text-xs">-</span>}
          </span>
          <select id={id} value={value} disabled={ctx.disabled} onChange={(e) => ctx.set(path, e.target.value)} className={SELECT}>
            <option value="">No icon</option>
            {ICON_NAMES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      );
      break;
    }
    case 'accent':
      control = (
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={value === a}
              aria-label={a}
              title={a}
              disabled={ctx.disabled}
              onClick={() => ctx.set(path, a)}
              className={`h-8 w-8 rounded-full bg-gradient-to-br ${GRADIENTS[a as Accent]} ring-offset-2 transition ${value === a ? 'ring-2 ring-links' : 'opacity-70 hover:opacity-100'}`}
            />
          ))}
        </div>
      );
      break;
    case 'time':
      control = <input id={id} type="time" value={value} disabled={ctx.disabled} onChange={(e) => ctx.set(path, e.target.value)} className={cls} />;
      break;
    case 'tab':
      control = (
        <select id={id} value={value} disabled={ctx.disabled} onChange={(e) => ctx.set(path, e.target.value)} className={SELECT}>
          <option value="">None (WhatsApp enquiry)</option>
          <option value="flights">Flights</option>
          <option value="hotel">Hotels</option>
          <option value="insurance">Insurance</option>
        </select>
      );
      break;
    case 'kind':
      control = (
        <select id={id} value={value} disabled={ctx.disabled} onChange={(e) => ctx.set(path, e.target.value)} className={SELECT}>
          <option value="phone">Phone</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="office">Office</option>
        </select>
      );
      break;
    case 'textarea':
      control = (
        <textarea
          id={id}
          rows={Math.min(8, Math.max(3, Math.ceil(value.length / 90)))}
          value={value}
          disabled={ctx.disabled}
          onChange={(e) => ctx.set(path, e.target.value)}
          className={`${cls} resize-y leading-relaxed`}
        />
      );
      break;
    default:
      control = (
        <input
          id={id}
          type={widget === 'url' ? 'url' : 'text'}
          value={value}
          disabled={ctx.disabled}
          onChange={(e) => ctx.set(path, e.target.value)}
          className={cls}
        />
      );
  }

  return (
    <div>
      <label htmlFor={id} className={FIELD_LABEL}>
        {label}
      </label>
      {control}
      {invalid && <p className="mt-1 text-xs font-semibold text-danger">Required</p>}
      {hint && !invalid && <p className="mt-1 text-xs text-inactive">{hint}</p>}
    </div>
  );
}

function Weekdays({ label, value, path, ctx }: { label: string; value: number[]; path: Path; ctx: Ctx }) {
  return (
    <div>
      <p className={FIELD_LABEL}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((d, i) => {
          const on = value.includes(i);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              disabled={ctx.disabled}
              onClick={() => ctx.set(path, on ? value.filter((x) => x !== i) : [...value, i].sort())}
              className={`rounded-full px-3 py-1 text-xs font-bold transition ${on ? 'bg-links text-white' : 'bg-slate-100 text-inactive hover:text-foreground'}`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListToolbar({
  index,
  total,
  onMove,
  onDuplicate,
  onRemove,
  disabled,
  name,
}: {
  index: number;
  total: number;
  onMove: (delta: -1 | 1) => void;
  onDuplicate?: () => void;
  onRemove: () => void;
  disabled: boolean;
  name: string;
}) {
  if (disabled) return null;
  return (
    <div className="flex shrink-0 items-center" role="group" aria-label={`${name} actions`}>
      <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className={ICON_BTN} title="Move up" aria-label={`Move ${name} up`}>
        <ArrowUp className="h-4 w-4" />
      </button>
      <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className={ICON_BTN} title="Move down" aria-label={`Move ${name} down`}>
        <ArrowDown className="h-4 w-4" />
      </button>
      {onDuplicate && (
        <button type="button" onClick={onDuplicate} className={ICON_BTN} title="Duplicate" aria-label={`Duplicate ${name}`}>
          <Copy className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className={`${ICON_BTN} hover:!bg-danger/10 hover:!text-danger`}
        title="Remove"
        aria-label={`Remove ${name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function move<T>(arr: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function StringList({ label, items, path, ctx, keyName }: { label: string; items: string[]; path: Path; ctx: Ctx; keyName: string }) {
  const long = items.some((s) => s.length > 90) || /paragraph|text|lines/i.test(keyName);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <p className={FIELD_LABEL}>{label}</p>
        <span className="text-xs text-inactive">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-2">
        {items.map((s, i) => {
          const p = [...path, i];
          const invalid = ctx.isEmpty(p);
          const cls = `${INPUT} ${invalid ? '!border-danger/60 ring-2 ring-danger/15' : ''}`;
          const name = `${label.toLowerCase()} ${i + 1}`;
          return (
            <div key={i} className="flex items-start gap-1.5">
              {long ? (
                <textarea rows={3} value={s} disabled={ctx.disabled} aria-label={name} onChange={(e) => ctx.set(p, e.target.value)} className={`${cls} resize-y leading-relaxed`} />
              ) : (
                <input value={s} disabled={ctx.disabled} aria-label={name} onChange={(e) => ctx.set(p, e.target.value)} className={cls} />
              )}
              <ListToolbar
                index={i}
                total={items.length}
                name={name}
                disabled={ctx.disabled}
                onMove={(d) => ctx.set(path, move(items, i, d))}
                onRemove={() => ctx.set(path, items.filter((_, j) => j !== i))}
              />
            </div>
          );
        })}
      </div>
      {!ctx.disabled && (
        <button type="button" onClick={() => ctx.set(path, [...items, ''])} className={`${BTN_GHOST} ${BTN_SM} mt-2`}>
          <Plus className="h-3.5 w-3.5" /> Add {label.toLowerCase().replace(/s$/, '')}
        </button>
      )}
    </div>
  );
}

const itemTitle = (o: JsonObject, i: number) => {
  for (const k of ['title', 'name', 'label', 'kind', 'value']) {
    if (typeof o[k] === 'string' && (o[k] as string).trim()) return o[k] as string;
  }
  return `Item ${i + 1}`;
};

function ObjectList({ label, items, path, ctx }: { label: string; items: JsonObject[]; path: Path; ctx: Ctx }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className={FIELD_LABEL}>{label}</p>
        <span className="text-xs text-inactive">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => {
          const name = `${label.toLowerCase()} ${i + 1}`;
          return (
            <div key={i} className="rounded-xl border border-tertiary-button bg-background/60 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-xs font-extrabold text-links">{i + 1}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{itemTitle(item, i)}</p>
                <ListToolbar
                  index={i}
                  total={items.length}
                  name={name}
                  disabled={ctx.disabled}
                  onMove={(d) => ctx.set(path, move(items, i, d))}
                  onDuplicate={() => {
                    const copy = [...items];
                    copy.splice(i + 1, 0, structuredClone(item));
                    ctx.set(path, copy);
                  }}
                  onRemove={() => {
                    if (window.confirm(`Remove "${itemTitle(item, i)}"?`)) ctx.set(path, items.filter((_, j) => j !== i));
                  }}
                />
              </div>
              <ObjectFields obj={item} path={[...path, i]} ctx={ctx} />
            </div>
          );
        })}
      </div>
      {!ctx.disabled && (
        <button type="button" onClick={() => ctx.set(path, [...items, blankLike(items[0]) as JsonObject])} className={`${BTN_GHOST} ${BTN_SM} mt-3`}>
          <Plus className="h-3.5 w-3.5" /> Add {label.toLowerCase().replace(/s$/, '')}
        </button>
      )}
    </div>
  );
}
