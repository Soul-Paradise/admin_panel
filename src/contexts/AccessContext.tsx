import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { api, type AdminPage, type PageAccessMap, type UserRole } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export interface AccessContextValue {
  access: PageAccessMap;
  role: UserRole | null;
  isSuperAdmin: boolean;
  isLoading: boolean;
  /** True if the admin may open the page at all. */
  canRead: (page: AdminPage) => boolean;
  /** True if the admin may mutate on the page. Gates buttons, not just routes. */
  canWrite: (page: AdminPage) => boolean;
}

export const AccessContext = createContext<AccessContextValue | undefined>(
  undefined,
);

/**
 * Mirrors the backend's per-page grants so the UI can hide what the API would
 * refuse anyway. This is presentation only - PageAccessGuard is the real
 * enforcement, and it does not trust anything decided here.
 */
export function AccessProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [access, setAccess] = useState<PageAccessMap>({});
  const [role, setRole] = useState<UserRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setAccess({});
      setRole(null);
      setIsSuperAdmin(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    api
      .getMyAccess()
      .then((res) => {
        if (cancelled) return;
        setAccess(res.access);
        setRole(res.role);
        setIsSuperAdmin(res.isSuperAdmin);
      })
      .catch(() => {
        // Fail closed: an admin whose grants we cannot read sees no sections,
        // rather than a sidebar full of links that will 403 on click.
        if (cancelled) return;
        setAccess({});
        setRole(null);
        setIsSuperAdmin(false);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const canRead = useCallback(
    (page: AdminPage) => isSuperAdmin || access[page] !== undefined,
    [access, isSuperAdmin],
  );

  const canWrite = useCallback(
    (page: AdminPage) => isSuperAdmin || access[page] === 'WRITE',
    [access, isSuperAdmin],
  );

  const value = useMemo(
    () => ({ access, role, isSuperAdmin, isLoading, canRead, canWrite }),
    [access, role, isSuperAdmin, isLoading, canRead, canWrite],
  );

  return (
    <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
  );
}
