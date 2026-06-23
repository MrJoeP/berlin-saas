// Shared types für alle Edge Functions.

export type JobStatus = "pending" | "running" | "completed" | "failed";

export type JobType =
  | "scrape_company"
  | "niche_news_scrape"
  | "niche_news_cluster"
  | "top_post_scrape"
  | "top_post_cluster";

export interface Job {
  id: string;
  type: JobType;
  company_id: string | null;
  payload: Record<string, unknown>;
  status: JobStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  depends_on: string[];
  created_at: string;
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
  negative_keywords?: string[];
  product_description?: string | null;
  icp?: string | null;
  target_market?: string | null;
  voice_sample: string | null;
  profile_json: CompanyProfile;
  active: boolean;
  created_at: string;
}

export interface CompanyProfile {
  tagline?: string;
  value_props?: string[];
  target_segments?: string[];
  tone_signals?: string[];
  key_terms?: string[];
  // Erweiterbar pro Modul
  [key: string]: unknown;
}

export interface Competitor {
  id: string;
  company_id: string;
  name: string;
  url: string | null;
  profile_json: Record<string, unknown>;
  created_at: string;
}

export type SourceType =
  | "rss"
  | "newsapi"
  | "reddit"
  | "hackernews"
  | "producthunt"
  | "twitter"
  | "custom";

export interface Source {
  id: string;
  name: string;
  url: string | null;
  type: SourceType;
  industry_tags: string[];
  config: Record<string, unknown>;
  is_default: boolean;
  tier: 1 | 2 | 3;
  min_score: number;
  max_age_days: number;
}

export interface NewsItem {
  title: string;
  url: string;
  source_name: string;
  source_tier: 1 | 2 | 3;
  published_at: string | null;
  score: number | null;
  raw: Record<string, unknown>;
}

export interface DigestCluster {
  cluster_name: string;
  items: NewsItem[];
  summary?: string;
}

export type DigestType = "niche_news" | "top_post" | "competitor" | "ugc";
