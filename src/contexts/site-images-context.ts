import { createContext } from 'react';
import type { SiteImages } from '../lib/api';

/**
 * Image slots edited in Site Content > Site-wide details (GLOBAL.images): the
 * logo and every admin-panel photo. Nothing is hard-coded: a missing slot
 * means the plain navy design / text wordmark.
 */
export interface SiteImagesContextValue {
  images: SiteImages | null;
  refresh: () => Promise<void>;
}

export const SiteImagesContext = createContext<SiteImagesContextValue>({ images: null, refresh: async () => {} });
