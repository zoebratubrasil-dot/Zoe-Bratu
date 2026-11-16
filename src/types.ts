export type MediaType = 'photo' | 'video';
export type AccessTier = 'free' | 'vip' | 'ppv';
export type SaleType = 'vip_subscription' | 'ppv' | 'tip';
export type PaymentMethod = 'pix' | 'card';
export type SaleStatus = 'paid' | 'pending' | 'refunded';

export interface CreatorProfile {
  id: string;
  slug: string;
  display_name: string;
  handle: string;
  bio: string;
  location: string;
  avatar_url: string | null;
  hero_url: string | null;
  vip_monthly_price_brl: number;
  vip_description: string;
  pix_key: string;
  age_verified_18: boolean;
  updated_at: string;
}

export interface MediaItem {
  id: string;
  title: string;
  description: string;
  media_type: MediaType;
  access_tier: AccessTier;
  price_brl: number;
  collection_name: string;
  storage_path: string;
  media_url: string | null;
  preview_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  is_published: boolean;
  views_count: number;
  unlocks_count: number;
  created_at: string;
  is_unlocked?: boolean;
}

export interface FanAccount {
  id: string;
  email: string;
  display_name: string | null;
  is_vip: boolean;
  vip_expires_at: string | null;
  age_confirmed_18: boolean;
  created_at: string;
}

export interface SaleRecord {
  id: string;
  fan_id: string | null;
  buyer_email: string;
  buyer_name: string | null;
  sale_type: SaleType;
  media_id: string | null;
  media_title?: string | null;
  amount_brl: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  external_ref: string | null;
  created_at: string;
}

export interface SupabaseStatus {
  connected: boolean;
  schemaReady: boolean;
  bucketsReady: boolean;
  projectUrl: string | null;
  missingTables: string[];
  error: string | null;
}

export interface StorefrontStats {
  totalPhotos: number;
  totalVideos: number;
  collectionsCount: number;
  vipPriceBrl: number;
  activeVipCount: number;
}

export interface CreatorDashboardData {
  mediaItems: MediaItem[];
  sales: SaleRecord[];
  fans: FanAccount[];
  metrics: {
    totalRevenueBrl: number;
    vipRevenueBrl: number;
    ppvRevenueBrl: number;
    tipsRevenueBrl: number;
    totalSalesCount: number;
    activeVipFans: number;
    totalMediaCount: number;
  };
}
