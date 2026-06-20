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
  is_default: boolean;
}

export interface Company {
  id: string;
  user_id: string;
  name: string;
  url: string | null;
  tagline: string | null;
  industry: string | null;
  niche: string | null;
  keywords: string[];
  voice_sample: string | null;
  profile_json: Record<string, unknown>;
  active: boolean;
  created_at: string;
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
  was_passiert: string;
  warum_relevant: string;
  industry_uneins: string;
  action_woche: string[];
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
