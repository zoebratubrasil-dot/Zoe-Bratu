import { useCallback, useEffect, useMemo, useState } from 'react';

const FAVORITES_STORAGE_KEY = 'mp_favorite_media_ids';

export function loadFavoriteIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  } catch {
    return [];
  }
}

export function saveFavoriteIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota or private-mode restriction errors
  }
}

export function useLocalFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => loadFavoriteIds());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_STORAGE_KEY) {
        setFavoriteIds(loadFavoriteIds());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const toggleFavorite = useCallback((mediaId: string) => {
    setFavoriteIds((prev) => {
      const exists = prev.includes(mediaId);
      const next = exists ? prev.filter((id) => id !== mediaId) : [...prev, mediaId];
      saveFavoriteIds(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback((mediaId: string) => favoriteSet.has(mediaId), [favoriteSet]);

  return {
    favoriteIds,
    favoriteSet,
    favoritesCount: favoriteIds.length,
    toggleFavorite,
    isFavorite,
  };
}
