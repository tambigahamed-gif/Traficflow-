import { getSupabaseAdmin } from "../_core/supabaseAdmin";
import { decryptSocialToken } from "./social-oauth";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;
type SocialAccount = { id: number; workspace_id: string; platform: string; provider_account_id: string; access_token_encrypted: string | null };
type AnalyticsSnapshot = { providerObjectId: string; metricDate: string; metrics: Record<string, number>; source: string };
export type AnalyticsRunSummary = { checked: number; collected: number; unsupported: number; failed: number; snapshots: number };

const apiVersion = process.env.SOCIAL_API_VERSION ?? "v27.0";
const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const dateDaysAgo = (days: number) => { const date = new Date(); date.setUTCDate(date.getUTCDate() - days); return isoDate(date); };

async function providerJson(url: string, token: string) {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`analytics_provider_${response.status}`);
  return body as any;
}

function metricDate(value: unknown, fallback: string) {
  const text = String(value ?? "");
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? fallback;
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
  const body = await providerJson(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, token);
  const headers = (body.columnHeaders ?? []).map((item: any) => String(item.name ?? "").toLowerCase());
  const rows = Array.isArray(body.rows) ? body.rows : [];
  return rows.map((row: any[]) => {
    const metrics: Record<string, number> = {};
    headers.slice(1).forEach((name: string, index: number) => { const value = Number(row[index + 1]); if (Number.isFinite(value)) metrics[name] = value; });
    return { providerObjectId: account.provider_account_id, metricDate: metricDate(row[0], isoDate(new Date())), metrics, source: "youtube_analytics_reports" };
  });
}

async function collectInstagram(account: SocialAccount, token: string) {
  const params = new URLSearchParams({ metric: "impressions,reach,profile_views", period: "day" });
  const body = await providerJson(`https://graph.facebook.com/${apiVersion}/${encodeURIComponent(account.provider_account_id)}/insights?${params}`, token);
  const byDate = new Map<string, Record<string, number>>();
  for (const metric of (body.data ?? []) as any[]) {
    const name = String(metric.name ?? "");
    for (const value of (metric.values ?? []) as any[]) {
      const date = metricDate(value.end_time ?? value.timestamp, isoDate(new Date()));
      const current = byDate.get(date) ?? {};
      const numeric = Number(value.value);
      if (Number.isFinite(numeric)) current[name] = numeric;
      byDate.set(date, current);
    }
  }
  return Array.from(byDate.entries()).map(([metricDate, metrics]) => ({ providerObjectId: account.provider_account_id, metricDate, metrics, source: "instagram_insights" }));
}

async function collectAccount(account: SocialAccount) {
  if (!account.access_token_encrypted || !account.provider_account_id) throw new Error("analytics_account_not_connected");
  const token = decryptSocialToken(account.access_token_encrypted);
  if (account.platform === "YouTube") return collectYouTube(account, token);
  if (account.platform === "Instagram") return collectInstagram(account, token);
  return null;
}

export async function runAnalyticsCollectors(adminOverride?: Admin): Promise<AnalyticsRunSummary> {
  const admin = adminOverride ?? getSupabaseAdmin();
  if (!admin) throw new Error("supabase_admin_not_configured");
  const { data: accounts, error } = await (admin.from("social_accounts") as any)
    .select("id,workspace_id,platform,provider_account_id,access_token_encrypted")
    .eq("connection_status", "connected")
    .limit(100);
  if (error) throw error;
  const summary: AnalyticsRunSummary = { checked: (accounts ?? []).length, collected: 0, unsupported: 0, failed: 0, snapshots: 0 };
  for (const account of (accounts ?? []) as SocialAccount[]) {
    try {
      const snapshots = await collectAccount(account) as AnalyticsSnapshot[] | null;
      if (!snapshots) { summary.unsupported++; continue; }
      if (!snapshots.length) { summary.collected++; continue; }
      const rows = snapshots.map((snapshot: AnalyticsSnapshot) => ({ workspace_id: account.workspace_id, social_account_id: account.id, platform: account.platform, provider_object_id: snapshot.providerObjectId, metric_date: snapshot.metricDate, metrics: snapshot.metrics, source: snapshot.source, collected_at: new Date().toISOString() }));
      const { error: upsertError } = await ((admin as any).from("analytics_snapshots") as any).upsert(rows, { onConflict: "social_account_id,provider_object_id,metric_date,source" });
      if (upsertError) throw upsertError;
      summary.collected++;
      summary.snapshots += rows.length;
    } catch (cause) {
      summary.failed++;
      console.error("[Analytics] collector failed", account.id, account.platform, cause instanceof Error ? cause.message : "unknown");
    }
  }
  return summary;
}
