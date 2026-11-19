import { useEffect, useState } from 'react';

export const FUNNEL_STORAGE_KEY = 'ln_conversion_funnel_v1';
const FUNNEL_UPDATED_EVENT = 'ln:funnel-updated';
const MAX_STORED_EVENTS = 200;

export type FunnelEventName =
  | 'buy_click'
  | 'video_call_click'
  | 'checkout_submit'
  | 'purchase_completed';

export type FunnelCategory = 'buy' | 'video_call';

export interface TrackOptions {
  category?: FunnelCategory;
  label?: string;
  placement?: string;
  amountBrl?: number;
  targetId?: string;
}

export interface FunnelEventRecord {
  id: string;
  event: FunnelEventName;
  category: FunnelCategory;
  label: string;
  placement: string;
  amount_brl?: number;
  target_id?: string;
  created_at: string;
}

export interface FunnelCounters {
  buy_clicks: number;
  video_call_clicks: number;
  buy_checkouts: number;
  video_call_checkouts: number;
  buy_conversions: number;
  video_call_conversions: number;
}

export interface FunnelStore {
  version: 1;
  started_at: string;
  updated_at: string;
  counters: FunnelCounters;
  events: FunnelEventRecord[];
}

export interface FunnelSummary {
  startedAt: string;
  updatedAt: string;
  buyClicks: number;
  videoCallClicks: number;
  totalClicks: number;
  buyCheckouts: number;
  videoCallCheckouts: number;
  buyConversions: number;
  videoCallConversions: number;
  totalConversions: number;
  buyConversionRate: number;
  videoCallConversionRate: number;
  overallConversionRate: number;
  recentEvents: FunnelEventRecord[];
}

function createEmptyStore(nowIso = new Date().toISOString()): FunnelStore {
  return {
    version: 1,
    started_at: nowIso,
    updated_at: nowIso,
    counters: {
      buy_clicks: 0,
      video_call_clicks: 0,
      buy_checkouts: 0,
      video_call_checkouts: 0,
      buy_conversions: 0,
      video_call_conversions: 0,
    },
    events: [],
  };
}

function readFunnelStore(): FunnelStore {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createEmptyStore();
  }
  try {
    const raw = window.localStorage.getItem(FUNNEL_STORAGE_KEY);
    if (!raw) return createEmptyStore();
    const parsed = JSON.parse(raw) as Partial<FunnelStore> | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.counters) {
      return createEmptyStore();
    }
    const base = createEmptyStore();
    return {
      version: 1,
      started_at: typeof parsed.started_at === 'string' ? parsed.started_at : base.started_at,
      updated_at: typeof parsed.updated_at === 'string' ? parsed.updated_at : base.updated_at,
      counters: {
        buy_clicks: Number(parsed.counters.buy_clicks || 0),
        video_call_clicks: Number(parsed.counters.video_call_clicks || 0),
        buy_checkouts: Number(parsed.counters.buy_checkouts || 0),
        video_call_checkouts: Number(parsed.counters.video_call_checkouts || 0),
        buy_conversions: Number(parsed.counters.buy_conversions || 0),
        video_call_conversions: Number(parsed.counters.video_call_conversions || 0),
      },
      events: Array.isArray(parsed.events) ? parsed.events.slice(0, MAX_STORED_EVENTS) : [],
    };
  } catch {
    return createEmptyStore();
  }
}

function writeFunnelStore(store: FunnelStore): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(FUNNEL_STORAGE_KEY, JSON.stringify(store));
    window.dispatchEvent(new CustomEvent(FUNNEL_UPDATED_EVENT));
  } catch {
    // Ignore storage quota / private mode restriction errors gracefully
  }
}

function inferCategory(event: FunnelEventName, explicit?: FunnelCategory): FunnelCategory {
  if (explicit === 'buy' || explicit === 'video_call') return explicit;
  return event === 'video_call_click' ? 'video_call' : 'buy';
}

/**
 * Registra um evento do funil de conversão diretamente no localStorage
 * sem depender de cookies de terceiros ou rastreadores externos.
 */
export function track(event: FunnelEventName, options: TrackOptions = {}): FunnelEventRecord {
  const nowIso = new Date().toISOString();
  const category = inferCategory(event, options.category);
  const record: FunnelEventRecord = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    event,
    category,
    label: (options.label || (category === 'video_call' ? 'Vídeo Chamada' : 'Comprar')).trim(),
    placement: (options.placement || 'storefront').trim(),
    amount_brl:
      typeof options.amountBrl === 'number' && Number.isFinite(options.amountBrl)
        ? Number(options.amountBrl)
        : undefined,
    target_id: options.targetId ? String(options.targetId) : undefined,
    created_at: nowIso,
  };

  const store = readFunnelStore();
  store.updated_at = nowIso;

  if (event === 'buy_click') {
    store.counters.buy_clicks += 1;
  } else if (event === 'video_call_click') {
    store.counters.video_call_clicks += 1;
  } else if (event === 'checkout_submit') {
    if (category === 'video_call') {
      store.counters.video_call_checkouts += 1;
    } else {
      store.counters.buy_checkouts += 1;
    }
  } else if (event === 'purchase_completed') {
    if (category === 'video_call') {
      store.counters.video_call_conversions += 1;
    } else {
      store.counters.buy_conversions += 1;
    }
  }

  store.events = [record, ...store.events].slice(0, MAX_STORED_EVENTS);
  writeFunnelStore(store);
  return record;
}

function computeRate(conversions: number, clicks: number): number {
  if (clicks <= 0) return 0;
  return Math.min(100, Math.round((conversions / clicks) * 1000) / 10);
}

export function getFunnelSummary(): FunnelSummary {
  const store = readFunnelStore();
  const c = store.counters;
  const totalClicks = c.buy_clicks + c.video_call_clicks;
  const totalConversions = c.buy_conversions + c.video_call_conversions;

  return {
    startedAt: store.started_at,
    updatedAt: store.updated_at,
    buyClicks: c.buy_clicks,
    videoCallClicks: c.video_call_clicks,
    totalClicks,
    buyCheckouts: c.buy_checkouts,
    videoCallCheckouts: c.video_call_checkouts,
    buyConversions: c.buy_conversions,
    videoCallConversions: c.video_call_conversions,
    totalConversions,
    buyConversionRate: computeRate(c.buy_conversions, c.buy_clicks),
    videoCallConversionRate: computeRate(c.video_call_conversions, c.video_call_clicks),
    overallConversionRate: computeRate(totalConversions, totalClicks),
    recentEvents: store.events,
  };
}

export function resetFunnelStats(): FunnelSummary {
  const fresh = createEmptyStore();
  writeFunnelStore(fresh);
  return getFunnelSummary();
}

export function useFunnelMetrics(): FunnelSummary {
  const [summary, setSummary] = useState<FunnelSummary>(() => getFunnelSummary());

  useEffect(() => {
    const sync = () => setSummary(getFunnelSummary());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === FUNNEL_STORAGE_KEY) sync();
    };

    window.addEventListener(FUNNEL_UPDATED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(FUNNEL_UPDATED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return summary;
}
