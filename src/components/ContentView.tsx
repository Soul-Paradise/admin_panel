import { humanize, isObject, stringWidget, type Json } from '../lib/content-form';
import { ICONS } from '../lib/site-content';
import { LABEL } from '../lib/ui-styles';

/** Read-only, human-readable rendering of a section's content (for history previews). */
export default function ContentView({ value, depth = 0 }: { value: Json; depth?: number }) {
  if (!isObject(value)) return <Leaf k="" v={value} />;
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return <p className="text-sm text-inactive">No text of its own - this only switches the shared banner on or off.</p>;
  }
  return (
    <dl className={`space-y-3 ${depth ? 'border-l-2 border-tertiary-button pl-3' : ''}`}>
      {entries.map(([k, v]) => (
        <div key={k}>
          <dt className={LABEL}>{humanize(k)}</dt>
          <dd className="mt-1">
            <Node k={k} v={v} depth={depth} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Node({ k, v, depth }: { k: string; v: Json; depth: number }) {
  if (Array.isArray(v)) {
    if (v.length === 0) return <span className="text-sm text-inactive">None</span>;
    return (
      <ol className="space-y-2">
        {v.map((x, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary-tint text-[10px] font-extrabold text-links">{i + 1}</span>
            <div className="min-w-0 flex-1">{isObject(x) ? <ContentView value={x} depth={depth + 1} /> : <Leaf k={k} v={x} />}</div>
          </li>
        ))}
      </ol>
    );
  }
  if (isObject(v)) return <ContentView value={v} depth={depth + 1} />;
  return <Leaf k={k} v={v} />;
}

function Leaf({ k, v }: { k: string; v: Json }) {
  if (typeof v === 'boolean') return <span className="text-sm font-semibold text-foreground">{v ? 'Yes' : 'No'}</span>;
  if (v === null || v === '') return <span className="text-sm text-inactive">-</span>;
  const s = String(v);
  const widget = stringWidget(k, s);
  if (widget === 'image') {
    return (
      <span className="flex items-center gap-2">
        <img src={s} alt="" loading="lazy" className="h-12 w-20 rounded-md object-cover ring-1 ring-tertiary-button" />
        <span className="truncate font-mono text-xs text-inactive">{s}</span>
      </span>
    );
  }
  if (widget === 'icon') {
    const Icon = ICONS[s];
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
        {Icon && <Icon className="h-4 w-4 text-links" />} {s}
      </span>
    );
  }
  return <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">{s}</p>;
}
