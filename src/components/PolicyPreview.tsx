import { HelpCircle, Mail, MapPin } from 'lucide-react';
import type { LegalDocumentContent } from '../lib/api';
import { GRADIENTS, type Accent } from '../lib/ui-styles';

/** Same accent order as the site's LegalPage section badges. */
const ACCENT_CYCLE: Accent[] = ['blue', 'green', 'orange', 'purple', 'teal', 'pink'];

/**
 * Renders a policy the way the public LegalPage does: intro, numbered section
 * cards with gradient badges, blue callouts and the navy help card. Used for
 * the editor's Preview tab and for previewing old versions.
 */
export default function PolicyPreview({ doc }: { doc: LegalDocumentContent }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-ink-soft to-ink p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">Policy preview</p>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{doc.title || 'Untitled policy'}</h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-white/80">{doc.description}</p>
        {!doc.isPublished && (
          <p className="mt-4 inline-flex rounded-full bg-amber-400/20 px-3 py-1 text-xs font-bold text-amber-200 ring-1 ring-amber-300/30">
            Draft - not visible on the website
          </p>
        )}
      </div>

      {doc.sections.map((section, i) => (
        <article key={i} className="rounded-2xl bg-peace p-6 shadow-sm ring-1 ring-tertiary-button sm:p-8">
          <header className="flex items-start gap-4">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${
                GRADIENTS[ACCENT_CYCLE[i % ACCENT_CYCLE.length]]
              } text-sm font-extrabold text-white shadow-md`}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="pt-1.5 text-xl font-bold text-foreground">{section.title || <span className="text-inactive italic">Untitled section</span>}</h3>
          </header>
          <div className="mt-4 space-y-3 sm:pl-14">
            {section.paragraphs.map((p, idx) => (
              <p key={idx} className="leading-relaxed whitespace-pre-line text-inactive">
                {p}
              </p>
            ))}
            {section.subsections.map((sub, idx) => (
              <div key={idx} className="rounded-xl border-l-4 border-links bg-links/5 p-4">
                <h4 className="font-semibold text-foreground">{sub.title}</h4>
                <p className="mt-1 leading-relaxed whitespace-pre-line text-inactive">{sub.content}</p>
              </div>
            ))}
          </div>
        </article>
      ))}

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-soft to-ink p-6 text-white shadow-lg sm:p-8">
        <span className="pointer-events-none absolute -top-12 -right-12 h-44 w-44 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <HelpCircle className="h-6 w-6" />
          </span>
          <h3 className="text-xl font-bold">{doc.helpTitle}</h3>
        </div>
        <p className="relative mt-3 max-w-2xl leading-relaxed text-white/80">{doc.helpText}</p>
        <div className="relative mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:gap-8">
          <span className="flex items-center gap-2 font-semibold">
            <Mail className="h-5 w-5 text-sky-300" /> soulparadise21@gmail.com
          </span>
          <span className="flex items-start gap-2 text-white/85">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" /> Shop No. 21, 1st Floor, PPR Plaza, Jalandhar
          </span>
        </div>
        <p className="relative mt-3 text-xs text-white/50">Contact details in this card are fixed on the website.</p>
      </section>
    </div>
  );
}
