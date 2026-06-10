import { useEffect, useState } from 'react';

// Capa de sincronización URL <-> estado de navegación del dashboard.
// La URL es la fuente de verdad: /dashboard/<page>[/<detailId>]
// El estado de React (currentPage, modales) la espeja.

// Ids de página válidos. Coinciden con los usados en el render condicional de
// DashboardApp.tsx. Si la URL trae un page id desconocido, se cae a 'dashboard'.
export const PAGE_IDS = [
  'dashboard',
  'recordings',
  'phones',
  'agendas',
  'callbacks',
  'batch-call',
  'campaign',
  'ventas',
  'lanzamiento',
  'no-llamar',
  'tickets',
  'recoveries',
  'interesados',
  'soporte-ia',
  'presupuesto',
  'seguimientos',
] as const;

export type PageId = (typeof PAGE_IDS)[number];

// Evento que se dispara tras una navegación programática (history.pushState no
// emite 'popstate' por sí mismo, así que notificamos a los suscriptores aquí).
const NAVIGATE_EVENT = 'dashboard:navigate';

export interface DashboardRoute {
  page: string;
  detailId: string | null;
}

// Parsea /dashboard/<page>/<detailId?> a partir del pathname.
export function parseRoute(pathname: string): DashboardRoute {
  const segments = pathname.split('/').filter(Boolean); // ['dashboard', '<page>', '<id>']

  // Si no empieza por /dashboard, no es una ruta gestionada aquí.
  if (segments[0] !== 'dashboard') {
    return { page: 'dashboard', detailId: null };
  }

  const rawPage = segments[1];
  const page = rawPage && (PAGE_IDS as readonly string[]).includes(rawPage) ? rawPage : 'dashboard';

  // El detailId solo aplica si la página es válida (evita interpretar basura).
  const detailId = page === rawPage && segments[2] ? decodeURIComponent(segments[2]) : null;

  return { page, detailId };
}

// Construye /dashboard/<page>[/<detailId>] conservando el query string actual.
export function buildPath(page: string, detailId?: string | null): string {
  let path = `/dashboard/${page}`;
  if (detailId != null && detailId !== '') {
    path += `/${encodeURIComponent(detailId)}`;
  }
  const search = typeof window !== 'undefined' ? window.location.search : '';
  return path + search;
}

// Navega de forma programática conservando los query params y notificando a los
// suscriptores de useDashboardRoute.
export function navigateDashboard(
  page: string,
  detailId?: string | null,
  options?: { replace?: boolean }
): void {
  const path = buildPath(page, detailId);

  // No-op si ya estamos en esa URL (evita entradas duplicadas en el historial).
  if (path === window.location.pathname + window.location.search) {
    return;
  }

  if (options?.replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT));
}

// Hook reactivo: devuelve { page, detailId } y se actualiza ante carga inicial,
// deep-link, atrás/adelante (popstate) y navegación programática (NAVIGATE_EVENT).
export function useDashboardRoute(): DashboardRoute {
  const [route, setRoute] = useState<DashboardRoute>(() =>
    parseRoute(typeof window !== 'undefined' ? window.location.pathname : '/dashboard')
  );

  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', sync);
    window.addEventListener(NAVIGATE_EVENT, sync);
    // Re-sincronizar al montar por si la URL cambió antes de suscribirnos.
    sync();
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAVIGATE_EVENT, sync);
    };
  }, []);

  return route;
}
