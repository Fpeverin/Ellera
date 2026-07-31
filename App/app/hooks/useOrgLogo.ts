// app/hooks/useOrgLogo.ts
//
// Il logo squadra compare nell'header di ogni schermata (se caricato
// dall'Admin) — invece di rifare la query a ogni schermata visitata, un
// piccolo cache in memoria per sessione: si carica una volta sola, condiviso
// da tutti i componenti che usano useOrgLogo()/TeamLogo. invalidateOrgLogoCache()
// va chiamata da chi carica un nuovo logo (Admin → Configurazioni).
import { useEffect, useState } from 'react';
import { loadOrgLogoUrl } from '../data/organization';
import { getCurrentOrgId } from '../lib/currentOrg';

let cache: { orgId: string; url: string | null } | null = null;
let inflight: Promise<string | null> | null = null;

export function invalidateOrgLogoCache() {
  cache = null;
}

export function useOrgLogo(): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    try {
      const orgId = getCurrentOrgId();
      return cache && cache.orgId === orgId ? cache.url : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let cancelled = false;
    let orgId: string;
    try {
      orgId = getCurrentOrgId();
    } catch {
      return;
    }

    if (cache && cache.orgId === orgId) {
      setUrl(cache.url);
      return;
    }

    if (!inflight) {
      inflight = loadOrgLogoUrl().finally(() => {
        inflight = null;
      });
    }
    inflight
      .then((loadedUrl) => {
        cache = { orgId, url: loadedUrl };
        if (!cancelled) setUrl(loadedUrl);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return url;
}
