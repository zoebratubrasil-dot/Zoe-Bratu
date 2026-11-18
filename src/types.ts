export type MediaType = 'photo' | 'video';
export type AccessTier = 'free' | 'vip' | 'ppv';
export type SaleType = 'vip_subscription' | 'ppv' | 'tip' | 'video_call';
export type PaymentMethod = 'pix' | 'card';
export type SaleStatus = 'paid' | 'pending' | 'refunded';

export interface VideoCallPlan {
  id: string;
  title: string;
  duration_minutes: number;
  price_brl: number;
  description: string;
  active: boolean;
}

export interface CreatorAboutStep {
  id: string;
  step: string;
  title: string;
  description: string;
}

export interface CreatorAboutExperience {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  duration_hint: string;
}

export interface CreatorAboutContent {
  headline_tag: string;
  carioca_title: string;
  carioca_bio: string;
  carioca_traits: string[];
  site_how_title: string;
  site_how_intro: string;
  site_steps: CreatorAboutStep[];
  videocall_title: string;
  videocall_intro: string;
  videocall_experiences: CreatorAboutExperience[];
  signature_quote: string;
}

export type MimoGiftIcon = 'wine' | 'heart' | 'sparkles' | 'crown';

export interface MimoGiftTier {
  id: string;
  title: string;
  subtitle: string;
  amount_brl: number;
  badge: string;
  perk: string;
  icon: MimoGiftIcon;
  featured: boolean;
  active: boolean;
}

export interface MimoSectionConfig {
  section_kicker: string;
  section_tag: string;
  section_title: string;
  section_description: string;
  cta_label: string;
  card_cta_label: string;
  modal_title: string;
  modal_description: string;
  tiers: MimoGiftTier[];
}

export type TestimonialCategory = 'video_call' | 'instagram' | 'vip_subscription' | 'tip' | 'ppv';

export interface FanTestimonial {
  id: string;
  author_name: string;
  author_location: string;
  author_email?: string;
  category: TestimonialCategory;
  rating: number;
  comment: string;
  verified_purchase: boolean;
  loyalty_label?: string | null;
  is_published: boolean;
  featured?: boolean;
  created_at: string;
}

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
  whatsapp_number?: string | null;
  video_call_plans?: VideoCallPlan[];
  about_section?: CreatorAboutContent;
  mimo_config?: MimoSectionConfig;
  testimonials?: FanTestimonial[];
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

export type LoyaltyTierId = 'admirer' | 'bronze' | 'silver' | 'gold_vip';

export interface FanLoyaltySummary {
  tier_id: LoyaltyTierId;
  tier_label: string;
  badge_label: string | null;
  is_gold_vip: boolean;
  purchases_count: number;
  recent_purchases_30d: number;
  total_spent_brl: number;
  gold_target_purchases: number;
  remaining_for_next: number;
  remaining_for_gold: number;
  next_tier_label: string | null;
  progress_percent: number;
  perks: string[];
}

export interface FanRecentOrder {
  id: string;
  sale_type: SaleType;
  amount_brl: number;
  payment_method: PaymentMethod;
  external_ref: string | null;
  media_title?: string | null;
  created_at: string;
}

export interface FanAccount {
  id: string;
  email: string;
  display_name: string | null;
  is_vip: boolean;
  vip_expires_at: string | null;
  age_confirmed_18: boolean;
  created_at: string;
  loyalty?: FanLoyaltySummary;
  recent_orders?: FanRecentOrder[];
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
    videoCallRevenueBrl?: number;
    totalSalesCount: number;
    activeVipFans: number;
    totalMediaCount: number;
  };
}

export interface WelcomeEmailLog {
  id: string;
  fan_id: string | null;
  fan_email: string;
  trigger_source: 'signup' | 'first_purchase' | 'manual_test';
  provider: string;
  status: 'sent' | 'skipped' | 'pending_config' | 'failed';
  edge_response: string | null;
  error_message: string | null;
  created_at: string;
}

export interface WelcomeEmailOverview {
  edgeDeployed: boolean;
  edgeUrl: string | null;
  resendConfigured: boolean;
  fromEmail: string;
  schemaNeedsMigration: boolean;
  logs: WelcomeEmailLog[];
  edgeFunctionCode: string;
  migrationSql: string;
}

