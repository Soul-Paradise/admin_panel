import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, EyeOff, ExternalLink, Globe, Home, Images, Info, Layers, LayoutTemplate, Phone, Sparkles, Trophy, type LucideIcon } from 'lucide-react';
import { api, type SitePage, type SitePageOverview } from '../lib/api';
import { useAccess } from '../hooks/useAccess';
import { SITE_PAGES } from '../lib/site-content';
import { siteUrl, timeAgo } from '../lib/site';
import { Alert, Badge, HeroStat, IconTile, PageHeader, Panel, Spinner } from '../components/ui';
import { BTN_GHOST, BTN_PRIMARY, BTN_SM, CARD_LINK, PAGE, type Accent } from '../lib/ui-styles';

const PAGE_LOOK: Record<SitePage, { icon: LucideIcon; accent: Accent }> = {
  HOME: { icon: Home, accent: 'blue' },
  ABOUT: { icon: Info, accent: 'green' },
  SERVICES: { icon: Sparkles, accent: 'orange' },
  CONTACT: { icon: Phone, accent: 'teal' },
  HALL_OF_FAME: { icon: Trophy, accent: 'purple' },
  GLOBAL: { icon: Globe, accent: 'slate' },
};

/** Overview of the public pages the CMS manages. */
export default function SiteContent() {
  const { canWrite } = useAccess();
  const editable = canWrite('SITE_CONTENT');
  const [pages, setPages] = useState<SitePageOverview[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getSiteOverview()
      .then(setPages)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load the site content.'));
  }, []);

  const all = pages?.flatMap((p) => p.sections) ?? [];
  const hidden = all.filter((s) => !s.isVisible).length;
  const lastEdited = all.reduce<string | null>((m, s) => (!m || s.updatedAt > m ? s.updatedAt : m), null);

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow="Content"
        title="Site Content"
        subtitle="Edit the text, sections and images of the public pages. Every save is versioned and the website updates within a minute."
        note={!editable ? 'You have read-only access to Site Content.' : undefined}
        actions={
          <Link to="/media" className={BTN_PRIMARY}>
            <Images className="h-4 w-4" /> Media Library
          </Link>
        }
        stats={
          <>
            <HeroStat icon={LayoutTemplate} label="Pages" value={pages ? pages.length : null} />
            <HeroStat icon={Layers} label="Sections" value={pages ? all.length : null} />
            <HeroStat icon={EyeOff} label="Hidden sections" value={pages ? hidden : null} />
          </>
        }
      />

      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {!pages && !error ? (
        <Panel>
          <Spinner label="Loading pages…" />
        </Panel>
      ) : (
        <Panel
          title="Pages"
          aside={<span className="text-xs font-semibold text-inactive">Last edit {timeAgo(lastEdited)}</span>}
        >
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {SITE_PAGES.map((meta) => {
              const data = pages?.find((p) => p.page === meta.page);
              const sections = data?.sections ?? [];
              const hiddenCount = sections.filter((s) => !s.isVisible).length;
              const last = sections.reduce<string | null>((m, s) => (!m || s.updatedAt > m ? s.updatedAt : m), null);
              const look = PAGE_LOOK[meta.page];
              return (
                <li key={meta.page} className={`group flex flex-col p-5 ${CARD_LINK}`}>
                  <div className="flex items-start gap-3">
                    <IconTile icon={look.icon} accent={look.accent} />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-extrabold text-foreground">{meta.label}</h3>
                      <p className="mt-0.5 text-xs leading-relaxed text-inactive">{meta.hint}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Badge tone="blue">
                      {sections.length} section{sections.length === 1 ? '' : 's'}
                    </Badge>
                    {hiddenCount > 0 ? <Badge tone="amber">{hiddenCount} hidden</Badge> : <Badge tone="green">All visible</Badge>}
                    <Badge tone="slate">Edited {timeAgo(last)}</Badge>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-tertiary-button pt-4">
                    <Link to={`/site-content/${meta.page.toLowerCase()}`} className={`${BTN_PRIMARY} ${BTN_SM}`}>
                      {editable ? 'Edit page' : 'View page'} <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    {meta.path && (
                      <a href={siteUrl(meta.path)} target="_blank" rel="noopener noreferrer" className={`${BTN_GHOST} ${BTN_SM}`}>
                        View live <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
