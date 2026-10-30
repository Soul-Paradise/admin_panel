import { useState } from 'react';
import { useSiteImages } from '../hooks/useSiteImages';

/**
 * The logo from Site Content > Site-wide images. With no logo set (or while
 * it loads / if the file was deleted) a text wordmark stands in - no image is
 * bundled with the app.
 */
export default function BrandLogo({
  className = 'h-11 w-auto',
  tone = 'light',
  wordmark = true,
}: {
  className?: string;
  /** light = white text on navy, dark = navy text on light backgrounds. */
  tone?: 'light' | 'dark';
  /** Show the text wordmark when there is no image (off where the name is already printed beside it). */
  wordmark?: boolean;
}) {
  const { images } = useSiteImages();
  const [failed, setFailed] = useState<string | null>(null);
  const src = images?.logo && images.logo !== failed ? images.logo : null;

  if (src) {
    return <img src={src} alt="Soul Paradise" className={`drop-shadow ${className}`} onError={() => setFailed(src)} />;
  }
  if (!wordmark) return null;
  return (
    <span className={`inline-flex flex-col leading-none ${tone === 'light' ? 'text-white' : 'text-foreground'}`} aria-label="Soul Paradise">
      <span className="text-lg font-extrabold tracking-tight">Soul Paradise</span>
      <span className={`mt-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ${tone === 'light' ? 'text-sky-300' : 'text-links'}`}>Travels</span>
    </span>
  );
}
