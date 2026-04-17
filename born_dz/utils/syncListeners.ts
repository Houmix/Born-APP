// utils/syncListeners.ts
// Registre centralisé pour notifier les contextes des changements serveur

export const themeUpdateListeners = new Set<() => void>();
export function addThemeUpdateListener(cb: () => void) { themeUpdateListeners.add(cb); }
export function removeThemeUpdateListener(cb: () => void) { themeUpdateListeners.delete(cb); }

export const menuRefreshListeners = new Set<(forceClean?: boolean) => void>();
export function addMenuRefreshListener(cb: (forceClean?: boolean) => void) { menuRefreshListeners.add(cb); }
export function removeMenuRefreshListener(cb: (forceClean?: boolean) => void) { menuRefreshListeners.delete(cb); }

export const STEPS_INVALIDATION_FLAG = 'steps_cache_invalidated';
