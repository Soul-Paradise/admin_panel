import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BTN_GHOST, BTN_SM, CARD, CARD_LINK, GRADIENTS, LABEL, TONES, type Accent, type Tone } from '../lib/ui-styles';

/**
 * The admin panel's building blocks, styled exactly like the customer site
 * (soul_paradise_frontend): SectionHeader, the results-page cards and sort
 * tabs, ModifySearch/ResultsEmpty pill buttons, IconTile and FormInput. Every
 * page uses these so the two apps read as one brand. When the site's look
 * changes, change it here.
 */

/** Rounded status / role pill (the site's "Refundable" / "Ticketed" chips). */
export function Badge({ tone = 'slate', dot = false, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${TONES[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Success / error / warning banner. */
export function Alert({
  tone,
  children,
  onClose,
}: {
  tone: 'success' | 'error' | 'warn' | 'info';
  children: ReactNode;
  onClose?: () => void;
}) {
  const style = {
    success: 'border-success/30 bg-success/10 text-success',
    error: 'border-danger/30 bg-danger/10 text-danger',
    warn: 'border-warn/40 bg-warn/10 text-amber-800',
    info: 'border-links/20 bg-primary-tint text-links',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${style}`}>
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="shrink-0 text-lg leading-none opacity-70 hover:opacity-100">
          &times;
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header (the site's SectionHeader)
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow = 'Admin panel',
  title,
  subtitle,
  actions,
  note,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons on the right (wrap below the title on phones). */
  actions?: ReactNode;
  /** Small extra line, e.g. "You have read-only access". */
  note?: ReactNode;
}) {
  return (
    <header className="animate-fade-up mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-links">{eyebrow}</p>
        <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-inactive sm:text-base">{subtitle}</p>}
        {note && <p className="mt-2 text-xs font-semibold text-inactive">{note}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Heading for a block inside a page. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-extrabold text-foreground">{children}</h2>
      {aside}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs (the site's results SortTabs)
// ---------------------------------------------------------------------------

export function Tabs<T extends string>({
  options,
  active,
  onChange,
  label = 'Filter',
}: {
  options: readonly { key: T; label: ReactNode; count?: number }[];
  active: T;
  onChange: (key: T) => void;
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex max-w-full flex-wrap gap-1 rounded-full bg-slate-100 p-1">
      {options.map((o) => {
        const isActive = o.key === active;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-all ${
              isActive ? 'bg-peace text-links shadow-sm' : 'text-inactive hover:text-foreground'
            }`}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[11px] font-bold ${isActive ? 'bg-primary-tint text-links' : 'bg-peace/70 text-inactive'}`}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile with the site's gradient IconTile
// ---------------------------------------------------------------------------


export function IconTile({ icon: Icon, accent = 'blue', size = 'md' }: { icon: LucideIcon; accent?: Accent; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-9 w-9 rounded-lg [&>svg]:h-4 [&>svg]:w-4' : 'h-11 w-11 rounded-xl [&>svg]:h-5 [&>svg]:w-5';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center bg-gradient-to-br ${GRADIENTS[accent]} text-white shadow-md transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${s}`}>
      <Icon />
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon,
  accent = 'blue',
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  /** Selected state when the tile doubles as a filter. */
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <div className="flex items-start gap-3">
      {icon && <IconTile icon={icon} accent={accent} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className={`truncate ${LABEL}`}>{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-inactive">{sub}</p>}
      </div>
    </div>
  );
  const ring = active ? 'border-links ring-2 ring-links/20' : '';
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={active} className={`group w-full p-4 text-left ${CARD_LINK} ${ring}`}>
      {body}
    </button>
  ) : (
    <div className={`group p-4 ${CARD} ${ring}`}>{body}</div>
  );
}

// ---------------------------------------------------------------------------
// Loading + empty states (the site's ResultsLoader / ResultsEmpty)
// ---------------------------------------------------------------------------

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center" role="status" aria-live="polite">
      <span className="relative flex h-10 w-10">
        <span className="absolute inset-0 rounded-full border-4 border-primary-tint" />
        <span className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-links" />
      </span>
      <p className="mt-3 text-sm font-semibold text-inactive">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && (
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-links">
          <Icon className="h-7 w-7" />
        </span>
      )}
      <h3 className="mt-4 text-lg font-extrabold text-foreground">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-inactive">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** "Page 1 of 3" + Previous / Next pills. */
export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-tertiary-button px-5 py-3">
      <p className="text-sm text-inactive">
        Page <span className="font-bold text-foreground">{page}</span> of{' '}
        <span className="font-bold text-foreground">{Math.max(totalPages, 1)}</span>
        {total !== undefined && <> · {total} total</>}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={`${BTN_GHOST} ${BTN_SM}`}>
          Previous
        </button>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={`${BTN_GHOST} ${BTN_SM}`}>
          Next
        </button>
      </div>
    </div>
  );
}

/** Centred modal dialog on a blurred backdrop. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`animate-fade-up flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-peace shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-tertiary-button px-5 py-4">
          <h2 className="text-lg font-extrabold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-inactive transition-colors hover:bg-background hover:text-foreground">
            <span className="block text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-tertiary-button bg-background px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
