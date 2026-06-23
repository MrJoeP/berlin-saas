import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error(
    "VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY müssen in .env.local gesetzt sein.",
  );
}

export const supabase = createClient(url, key);

// Shared Types passend zum Schema im supabase/migrations.
export interface Industry {
  id: string;
  name: string;
  description: string | null;
}

export interface Source {
  id: string;
  name: string;
  url: string | null;
  type: "rss" | "newsapi" | "reddit" | "hackernews" | "producthunt" | "twitter" | "custom";
  industry_tags: string[];
  config: Record<string, unknown>;
  is_default: boolean;
  tier: 1 | 2 | 3;
  min_score: number | null;
  max_age_days: number | null;
}

export interface Company {
  id: string;
  user_id: string;
  name: string | null;
  url: string | null;
  tagline: string | null;
  industry: string | null;
  niche: string | null;
  keywords: string[];
  negative_keywords: string[];
  product_description: string | null;
  icp: string | null;
  target_market: string | null;
  voice_sample: string | null;
  profile_json: Record<string, unknown>;
  active: boolean;
  scan_frequency: "daily" | "weekly";
  created_at: string;
}

export interface Job {
  id: string;
  type: string;
  company_id: string | null;
  status: "pending" | "running" | "completed" | "failed";
  result: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SourceHealth {
  company_id: string;
  source_id: string;
  last_checked_at: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  items_fetched: number;
  items_accepted: number;
}

export interface Competitor {
  id: string;
  company_id: string;
  name: string;
  url: string | null;
}

export interface ClusterAnalysis {
  cluster_name: string;
  confidence: "verified" | "editorial" | "community";
  confidence_reason?: string;
  signal_metrics?: {
    priority_score: number;
    relevance_score: number;
    evidence_score: number;
    novelty_score: number;
    momentum_score: number;
    item_count: number;
    primary_source_count: number;
    editorial_source_count: number;
    community_source_count: number;
    action_hint: "act" | "watch" | "content" | "ignore";
    signal_reason: string;
  };
  was_passiert: string;
  warum_relevant?: string;
  einordnung?: string;
  next_move?: string;
  offene_fragen?: string[];
  key_quotes: { quote: string; source: string; url: string }[];
  trend_streak: number;
}

export interface Digest {
  id: string;
  company_id: string;
  type: "niche_news" | "top_post" | "competitor" | "ugc";
  title: string;
  generated_at: string;
  delivered_at: string | null;
  cluster_analyses: ClusterAnalysis[] | null;
}

export interface DigestItem {
  id: string;
  digest_id: string;
  cluster: string | null;
  title: string | null;
  summary: string | null;
  source_url: string | null;
  source_name: string | null;
  source_tier: 1 | 2 | 3 | null;
  cluster_confidence: "verified" | "editorial" | "community" | null;
  published_at: string | null;
}

// Vote in unified votes-Tabelle. value ist +1 oder -1, eindeutig pro user+target.
export interface Vote {
  user_id: string;
  target_type: "item" | "cluster";
  target_id: string; // item.id oder `${digest_id}|${cluster_name}`
  value: -1 | 1;
}
