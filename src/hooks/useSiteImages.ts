import { useContext } from 'react';
import { SiteImagesContext } from '../contexts/site-images-context';

export const useSiteImages = () => useContext(SiteImagesContext);

/** Admin-photo slot for a PageHeader section / eyebrow name. */
export type AdminImageSlot =
  | 'dashboard'
  | 'people'
  | 'partners'
  | 'pricing'
  | 'promotions'
  | 'content'
  | 'payments'
  | 'operations'
  | 'security';

const SLOTS: AdminImageSlot[] = ['dashboard', 'people', 'partners', 'pricing', 'promotions', 'content', 'payments', 'operations', 'security'];

export const adminSlotFor = (section: string): AdminImageSlot => {
  const s = section.trim().toLowerCase() as AdminImageSlot;
  return SLOTS.includes(s) ? s : 'dashboard';
};
