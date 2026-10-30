import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type SiteImages } from '../lib/api';
import { SiteImagesContext } from './site-images-context';

/** Loads the image slots once from the public site-content endpoint (works before login). */
export function SiteImagesProvider({ children }: { children: ReactNode }) {
  const [images, setImages] = useState<SiteImages | null>(null);

  const refresh = useCallback(async () => {
    try {
      setImages(await api.getSiteImages());
    } catch {
      // Offline / API down: keep the image-free design.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getSiteImages()
      .then((img) => {
        if (!cancelled) setImages(img);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ images, refresh }), [images, refresh]);
  return <SiteImagesContext.Provider value={value}>{children}</SiteImagesContext.Provider>;
}
