import { getSupabaseAdmin } from "../_core/supabaseAdmin";
import { decryptSocialToken } from "./social-oauth";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type SocialAccount = {
  id: number;
  workspace_id: string;
  platform: string;
  provider_account_id: string | null;
  access_token_encrypted: string | null;
};
type AnalyticsSnapshot = {
  providerObjectId: string;
  metricDate: string;
  metrics: Record<string, number>;
  source: string;
};
export type AnalyticsRunSummary = {
  checked: number;
  collected: number;
  unsupported: number;
  failed: number;
  snapshots: number;
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
};

const apiVersion = process.env.SOCIAL_API_VERSION ?? "v27.0";
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateDaysAgo = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return isoDate(date);
};
const unixSeconds = (date: string) =>
  Math.floor(Date.parse(`${date}T00:00:00.000Z`) / 1000);
const dayStart = dateDaysAgo(1);
const dayEnd = isoDate(new Date());

async function providerJson(
  url: string,
  token: string,
  options: RequestOptions = {}
) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(options.body === undefined
        ? {}
        : { "content-type": "application/json" }),
      ...options.headers,
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`analytics_provider_${response.status}`);
  return body as any;
}

function metricDate(value: unknown, fallback: string) {
  const text = String(value ?? "");
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? fallback;
}

function numeric(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function addMetric(
  target: Record<string, number>,
  key: string,
  value: unknown
) {
  const number = numeric(value);
  if (number !== null) target[key] = number;
}

function mergeMetricValue(
  byDate: Map<string, Record<string, number>>,
  date: string,
  key: string,
  value: unknown
) {
  const number = numeric(value);
  if (number === null) return;
  const metrics = byDate.get(date) ?? {};
  metrics[key] = number;
  byDate.set(date, metrics);
}

async function collectYouTube(account: SocialAccount, token: string) {
  const params = new URLSearchParams({
    ids: "channel==MINE",
    startDate: dateDaysAgo(28),
    endDate: isoDate(new Date()),
    metrics: "views,likes,comments,subscribersGained,estimatedMinutesWatched",
    dimensions: "day",
    sort: "day",
  });
  const body = await providerJson(
    `https://youtubeanalytics.googleapis.com/v2/reports?${params}`,
    token
  );
  const headers = (body.columnHeaders ?? []).map((item: any) =>
    String(item.name ?? "").toLowerCase()
  );
  const rows = Array.isArray(body.rows) ? body.rows : [];
  return rows.map((row: any[]) => {
    const metrics: Record<string, number> = {};
    headers
      .slice(1)
      .forEach((name: string, index: number) =>
        addMetric(metrics, name, row[index + 1])
      );
    return {
      providerObjectId: account.provider_account_id!,
      metricDate: metricDate(row[0], isoDate(new Date())),
      metrics,
      source: "youtube_analytics_reports",
    };
  });
}

async function collectInstagram(account: SocialAccount, token: string) {
  const params = new URLSearchParams({
    metric: "impressions,reach,profile_views",
    period: "day",
  });
  const body = await providerJson(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(account.provider_account_id!)}/insights?${params}`,
    token
  );
  const byDate = new Map<string, Record<string, number>>();
  for (const metric of (body.data ?? []) as any[]) {
    const name = String(metric.name ?? "");
    for (const value of (metric.values ?? []) as any[]) {
      mergeMetricValue(
        byDate,
        metricDate(value.end_time ?? value.timestamp, dayStart),
        name,
        value.value
      );
    }
  }
  return Array.from(byDate.entries()).map(([metricDate, metrics]) => ({
    providerObjectId: account.provider_account_id!,
    metricDate,
    metrics,
    source: "instagram_insights",
  }));
}

async function collectFacebook(account: SocialAccount, token: string) {
  const params = new URLSearchParams({
    metric:
      "page_post_engagements,page_impressions,page_follows,page_fan_adds,page_fan_removes,page_views_total",
    period: "day",
    since: String(unixSeconds(dayStart)),
    until: String(unixSeconds(dayEnd)),
  });
  const body = await providerJson(
    `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(account.provider_account_id!)}/insights?${params}`,
    token
  );
  const byDate = new Map<string, Record<string, number>>();
  for (const metric of (body.data ?? []) as any[]) {
    const name = String(metric.name ?? "");
    for (const value of (metric.values ?? []) as any[]) {
      mergeMetricValue(
        byDate,
        metricDate(value.end_time ?? value.timestamp, dayStart),
        name,
        value.value
      );
    }
  }
  return Array.from(byDate.entries()).map(([metricDate, metrics]) => ({
    providerObjectId: account.provider_account_id!,
    metricDate,
    metrics,
    source: "facebook_page_insights",
  }));
}

async function collectThreads(account: SocialAccount, token: string) {
  const params = new URLSearchParams({
    metric: "views,likes,replies,reposts,quotes",
    since: String(unixSeconds(dayStart)),
    until: String(unixSeconds(dayEnd)),
  });
  const body = await providerJson(
    `https://graph.threads.com/v1.0/${encodeURIComponent(account.provider_account_id!)}/threads_insights?${params}`,
    token
  );
  const byDate = new Map<string, Record<string, number>>();
  for (const metric of (body.data ?? []) as any[]) {
    const name = String(metric.name ?? "");
    for (const value of (metric.values ?? []) as any[]) {
      mergeMetricValue(
        byDate,
        metricDate(value.end_time ?? value.timestamp, dayStart),
        name,
        value.value
      );
    }
    addMetric(byDate.get(dayStart) ?? {}, name, metric.total_value?.value);
    if (metric.total_value?.value !== undefined && !byDate.has(dayStart))
      mergeMetricValue(byDate, dayStart, name, metric.total_value.value);
  }
  return Array.from(byDate.entries()).map(([metricDate, metrics]) => ({
    providerObjectId: account.provider_account_id!,
    metricDate,
    metrics,
    source: "threads_user_insights",
  }));
}

async function collectTikTok(account: SocialAccount, token: string) {
  const body = await providerJson(
    "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count",
    token
  );
  const metrics: Record<string, number> = {};
  const user = body.data?.user ?? {};
  addMetric(metrics, "follower_count", user.follower_count);
  addMetric(metrics, "following_count", user.following_count);
  addMetric(metrics, "likes_count", user.likes_count);
  addMetric(metrics, "video_count", user.video_count);
  return [
    {
      providerObjectId: account.provider_account_id!,
      metricDate: dayStart,
      metrics,
      source: "tiktok_display_profile_totals",
    },
  ];
}

async function collectX(account: SocialAccount, token: string) {
  const postParams = new URLSearchParams({
    max_results: "100",
    "tweet.fields": "attachments,created_at",
    expansions: "attachments.media_keys",
    "media.fields": "media_key",
  });
  const posts = await providerJson(
    `https://api.x.com/2/users/${encodeURIComponent(account.provider_account_id!)}/tweets?${postParams}`,
    token
  );
  const ids = (posts.data ?? [])
    .map((post: any) => String(post.id ?? ""))
    .filter(Boolean);
  if (!ids.length) return [];
  const analyticsParams = new URLSearchParams({
    ids: ids.join(","),
    start_time: `${dayStart}T00:00:00Z`,
    end_time: `${dayEnd}T00:00:00Z`,
    granularity: "daily",
    "analytics.fields":
      "impressions,engagements,likes,replies,retweets,quotes,bookmarks,profile_visits,url_clicks,media_views",
  });
  const body = await providerJson(
    `https://api.x.com/2/tweets/analytics?${analyticsParams}`,
    token
  );
  const byDate = new Map<string, Record<string, number>>();
  for (const item of (body.data ?? []) as any[]) {
    const values = Array.isArray(item.timestamped_metrics)
      ? item.timestamped_metrics
      : [{ timestamp: item.timestamp, metrics: item.metrics }];
    for (const value of values) {
      const date = metricDate(value.timestamp, dayStart);
      for (const [key, metricValue] of Object.entries(value.metrics ?? {}))
        mergeMetricValue(byDate, date, `post_${key}`, metricValue);
    }
  }
  return Array.from(byDate.entries()).map(([metricDate, metrics]) => ({
    providerObjectId: account.provider_account_id!,
    metricDate,
    metrics,
    source: "x_post_analytics",
  }));
}

function dateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `start:(year:${year},month:${month},day:${day}),end:(year:${year},month:${month},day:${day})`;
}

function collectKnownNumbers(
  value: unknown,
  target: Record<string, number>,
  allowed: Set<string>,
  prefix = ""
) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = prefix ? `${prefix}_${key}` : key;
    if (allowed.has(key)) addMetric(target, normalized, child);
    if (child && typeof child === "object")
      collectKnownNumbers(child, target, allowed, normalized);
  }
}

async function collectLinkedIn(account: SocialAccount, token: string) {
  const headers = {
    "LinkedIn-Version": process.env.LINKEDIN_API_VERSION ?? "202601",
    "X-Restli-Protocol-Version": "2.0.0",
  };
  const followerBody = await providerJson(
    "https://api.linkedin.com/rest/memberFollowersCount?q=me",
    token,
    { headers }
  );
  const metrics: Record<string, number> = {};
  collectKnownNumbers(
    followerBody,
    metrics,
    new Set(["memberFollowersCount", "count", "value"]),
    "linkedin"
  );
  const dateRange = dateParts(dayStart);
  const analyticsParams = new URLSearchParams({
    q: "me",
    queryType: "IMPRESSION",
    aggregation: "DAILY",
    dateRange: `(${dateRange})`,
  });
  try {
    const analyticsBody = await providerJson(
      `https://api.linkedin.com/rest/memberCreatorPostAnalytics?${analyticsParams}`,
      token,
      { headers }
    );
    collectKnownNumbers(
      analyticsBody,
      metrics,
      new Set([
        "impressionCount",
        "membersReached",
        "reactionCount",
        "commentCount",
        "shareCount",
        "clickCount",
        "count",
        "value",
      ]),
      "linkedin_posts"
    );
  } catch (error) {
    console.warn(
      "[Analytics] LinkedIn post analytics unavailable",
      account.id,
      error instanceof Error ? error.message : "unknown"
    );
  }
  return [
    {
      providerObjectId: account.provider_account_id!,
      metricDate: dayStart,
      metrics,
      source: "linkedin_member_analytics",
    },
  ];
}

async function collectAccount(account: SocialAccount) {
  if (!account.access_token_encrypted || !account.provider_account_id)
    throw new Error("analytics_account_not_connected");
  const token = decryptSocialToken(account.access_token_encrypted);
  if (account.platform === "YouTube") return collectYouTube(account, token);
  if (account.platform === "Instagram") return collectInstagram(account, token);
  if (account.platform === "Facebook") return collectFacebook(account, token);
  if (account.platform === "Threads") return collectThreads(account, token);
  if (account.platform === "TikTok") return collectTikTok(account, token);
  if (account.platform === "X") return collectX(account, token);
  if (account.platform === "LinkedIn") return collectLinkedIn(account, token);
  return null;
}

export async function runAnalyticsCollectors(
  adminOverride?: Admin
): Promise<AnalyticsRunSummary> {
  const admin = adminOverride ?? getSupabaseAdmin();
  if (!admin) throw new Error("supabase_admin_not_configured");
  const { data: accounts, error } = await (admin.from("social_accounts") as any)
    .select(
      "id,workspace_id,platform,provider_account_id,access_token_encrypted"
    )
    .eq("connection_status", "connected")
    .limit(100);
  if (error) throw error;
  const summary: AnalyticsRunSummary = {
    checked: (accounts ?? []).length,
    collected: 0,
    unsupported: 0,
    failed: 0,
    snapshots: 0,
  };
  for (const account of (accounts ?? []) as SocialAccount[]) {
    try {
      const snapshots = (await collectAccount(account)) as
        | AnalyticsSnapshot[]
        | null;
      if (!snapshots) {
        summary.unsupported++;
        continue;
      }
      if (!snapshots.length) {
        summary.collected++;
        continue;
      }
      const rows = snapshots.map((snapshot: AnalyticsSnapshot) => ({
        workspace_id: account.workspace_id,
        social_account_id: account.id,
        platform: account.platform,
        provider_object_id: snapshot.providerObjectId,
        metric_date: snapshot.metricDate,
        metrics: snapshot.metrics,
        source: snapshot.source,
        collected_at: new Date().toISOString(),
      }));
      const { error: upsertError } = await (
        (admin as any).from("analytics_snapshots") as any
      ).upsert(rows, {
        onConflict: "social_account_id,provider_object_id,metric_date,source",
      });
      if (upsertError) throw upsertError;
      summary.collected++;
      summary.snapshots += rows.length;
    } catch (cause) {
      summary.failed++;
      console.error(
        "[Analytics] collector failed",
        account.id,
        account.platform,
        cause instanceof Error ? cause.message : "unknown"
      );
    }
  }
  return summary;
}
