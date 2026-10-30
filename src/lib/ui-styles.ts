/**
 * Shared class names for the admin panel, styled exactly like the customer
 * site (soul_paradise_frontend): its results-page cards, pill buttons,
 * FormInput fields, tables and status chips. The matching components live in
 * components/ui.tsx. When the site's look changes, change it here.
 */

// ---------------------------------------------------------------------------
// Layout + surfaces
// ---------------------------------------------------------------------------

/** Page width + gutters (the site's RESULTS_CONTAINER). */
export const PAGE = 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8';

/** White card with the site's border, radius and soft shadow. */
export const CARD = 'rounded-2xl border border-tertiary-button bg-peace shadow-sm';

/** Card that lifts on hover, for clickable tiles (the site's result card). */
export const CARD_LINK = `${CARD} transition-all duration-200 hover:-translate-y-0.5 hover:border-links/30 hover:shadow-lg`;

/** Small uppercase label, like the site's summary-bar labels. */
export const LABEL = 'text-[10px] font-bold uppercase tracking-[0.14em] text-inactive';

// ---------------------------------------------------------------------------
// Buttons (all pills, like the site)
// ---------------------------------------------------------------------------

const BTN_BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 disabled:pointer-events-none disabled:opacity-60';

/** Main action: solid brand blue (the site's "Log in" / "Back to results"). */
export const BTN_PRIMARY = `${BTN_BASE} bg-primary-button text-peace shadow-sm shadow-primary-button/25 hover:bg-secondary-button hover:shadow-md`;

/** Secondary action: blue outline that fills on hover (the site's "Modify Search"). */
export const BTN_OUTLINE = `${BTN_BASE} border border-links bg-peace text-links hover:bg-links hover:text-peace`;

/** Neutral action (cancel, close). */
export const BTN_GHOST = `${BTN_BASE} border border-tertiary-button bg-peace text-foreground hover:border-links hover:text-links`;

/** Destructive action. */
export const BTN_DANGER = `${BTN_BASE} border border-danger bg-peace text-danger hover:bg-danger hover:text-peace`;

/** Approve / confirm action. */
export const BTN_SUCCESS = `${BTN_BASE} bg-success text-peace shadow-sm hover:brightness-95`;

/** Compact pill for table rows; append to a BTN_* class. */
export const BTN_SM = '!px-3.5 !py-1.5 !text-xs';

/** Text link button (Edit / Details in table rows). */
export const LINK_BTN = 'text-sm font-bold text-links hover:underline disabled:opacity-50';

/** Text link button for destructive row actions (Delete / Revoke). */
export const LINK_BTN_DANGER = 'text-sm font-bold text-danger hover:underline disabled:opacity-50';

// ---------------------------------------------------------------------------
// Form fields (the site's FormInput)
// ---------------------------------------------------------------------------

export const INPUT =
  'block w-full rounded-xl border border-tertiary-button bg-peace px-4 py-2.5 text-sm text-foreground placeholder:text-inactive/70 transition-colors focus:border-links focus:outline-none focus:ring-2 focus:ring-links/20 disabled:cursor-not-allowed disabled:bg-background';

export const SELECT = `${INPUT} pr-9`;

export const FIELD_LABEL = 'mb-1.5 block text-sm font-semibold text-foreground';

/** Checkbox / radio accent. */
export const CHECKBOX = 'h-4 w-4 shrink-0 rounded border-tertiary-button accent-primary-button';

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const TABLE_HEAD = 'bg-background';
export const TH = `px-5 py-3 text-left ${LABEL}`;
export const TD = 'px-5 py-3.5 text-sm text-foreground';
export const TBODY = 'divide-y divide-tertiary-button';
export const TROW = 'transition-colors hover:bg-primary-tint/40';

// ---------------------------------------------------------------------------
// Status tones + accents
// ---------------------------------------------------------------------------

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';

export const TONES: Record<Tone, string> = {
  blue: 'bg-primary-tint text-links',
  green: 'bg-success/10 text-success',
  amber: 'bg-warn/15 text-amber-700',
  red: 'bg-danger/10 text-danger',
  purple: 'bg-purple-500/10 text-purple-700',
  slate: 'bg-background text-inactive ring-1 ring-tertiary-button',
};

/** The site's icon-tile gradients (components/Page/palette.ts). */
export const GRADIENTS = {
  blue: 'from-blue-500 to-indigo-600',
  green: 'from-emerald-500 to-teal-600',
  orange: 'from-orange-500 to-red-500',
  purple: 'from-purple-500 to-violet-600',
  teal: 'from-teal-500 to-cyan-600',
  pink: 'from-pink-500 to-rose-600',
  slate: 'from-slate-600 to-slate-800',
} as const;

export type Accent = keyof typeof GRADIENTS;

