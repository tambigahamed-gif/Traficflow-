import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSocialToken } from "./integrations/social-oauth";
import { runAnalyticsCollectors } from "./integrations/social-analytics";

process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-social-token-key";

type Account = {
  id: number;
  workspace_id: string;
  platform: string;
  provider_account_id: string;
  access_token_encrypted: string;
};

const accounts: Account[] = [
  "Facebook",
  "TikTok",
  "Threads",
  "X",
  "LinkedIn",
].map((platform, index) => ({
  id: index + 1,
  workspace_id: "00000000-0000-4000-8000-000000000001",
  platform,
  provider_account_id: `${platform.toLowerCase()}-account`,
  access_token_encrypted: encryptSocialToken(`token-${platform}`),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fakeAdmin() {
  const snapshots: Array<Record<string, unknown>> = [];
  return {
    snapshots,
    from(table: string) {
      if (table === "social_accounts") {
        const query = {
          eq: () => query,
          limit: async () => ({ data: accounts, error: null }),
        };
        return {
          select: () => query,
        };
      }
      return {
        upsert: async (rows: Array<Record<string, unknown>>) => {
          snapshots.push(...rows);
          return { error: null };
        },
      };
    },
  };
}

describe("social analytics collectors", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (
          url.includes("graph.facebook.com") &&
          url.includes("facebook-account")
        ) {
          return jsonResponse({
            data: [
              {
                name: "page_impressions",
                values: [{ value: 120, end_time: "2026-11-19T23:59:59+0000" }],
              },
            ],
          });
        }
        if (url.includes("open.tiktokapis.com")) {
          return jsonResponse({
            data: {
              user: {
                follower_count: 10,
                following_count: 20,
                likes_count: 30,
                video_count: 4,
              },
            },
          });
        }
        if (url.includes("graph.threads.com")) {
          return jsonResponse({
            data: [
              {
                name: "views",
                values: [{ value: 55, end_time: "2026-11-19T23:59:59+0000" }],
              },
            ],
          });
        }
        if (url.includes("api.x.com/2/users")) {
          return jsonResponse({ data: [{ id: "x-post-1" }] });
        }
        if (url.includes("api.x.com/2/tweets/analytics")) {
          return jsonResponse({
            data: [
              {
                timestamped_metrics: [
                  {
                    timestamp: "2026-11-19T23:00:00Z",
                    metrics: { impressions: 8, engagements: 2 },
                  },
                ],
              },
            ],
          });
        }
        if (url.includes("memberFollowersCount")) {
          return jsonResponse({ memberFollowersCount: 77 });
        }
        if (url.includes("memberCreatorPostAnalytics")) {
          return jsonResponse({ elements: [{ impressionCount: 21 }] });
        }
        throw new Error(`unexpected analytics URL: ${url}`);
      })
    );
  });

  it("collects real-provider-shaped snapshots for all five remaining platforms", async () => {
    const admin = fakeAdmin();
    const summary = await runAnalyticsCollectors(admin as never);

    expect(summary).toMatchObject({
      checked: 5,
      collected: 5,
      unsupported: 0,
      failed: 0,
      snapshots: 5,
    });
    expect(admin.snapshots.map(snapshot => snapshot.source).sort()).toEqual([
      "facebook_page_insights",
      "linkedin_member_analytics",
      "threads_user_insights",
      "tiktok_display_profile_totals",
      "x_post_analytics",
    ]);
    expect(
      admin.snapshots.every(snapshot =>
        Object.values(snapshot.metrics as Record<string, number>).every(
          value => typeof value === "number"
        )
      )
    ).toBe(true);
  });
});
