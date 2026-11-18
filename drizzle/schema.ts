import {
  boolean,
  index,
  int,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: varchar("role", { length: 24 }).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const socialAccounts = mysqlTable(
  "social_accounts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    platform: varchar("platform", { length: 32 }).notNull(),
    handle: varchar("handle", { length: 120 }).notNull(),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    niche: varchar("niche", { length: 120 }).default("Créateur").notNull(),
    avatarUrl: text("avatarUrl"),
    followers: int("followers").default(0).notNull(),
    engagementRate: varchar("engagementRate", { length: 16 }).default("0.0").notNull(),
    connectionStatus: varchar("connectionStatus", { length: 24 }).default("pending").notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    connectedAt: timestamp("connectedAt").defaultNow().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("social_accounts_user_idx").on(table.userId),
    platformHandleIdx: index("social_accounts_platform_handle_idx").on(table.platform, table.handle),
  }),
);

export const aiAssistants = mysqlTable(
  "ai_assistants",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    socialAccountId: int("socialAccountId").notNull(),
    tone: varchar("tone", { length: 80 }).default("Authentique").notNull(),
    language: varchar("language", { length: 48 }).default("Français").notNull(),
    style: varchar("style", { length: 160 }).default("Clair, chaleureux et utile").notNull(),
    audience: varchar("audience", { length: 255 }).default("Communauté intéressée par la niche").notNull(),
    rules: text("rules"),
    permission: varchar("permission", { length: 32 }).default("suggestions").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("ai_assistants_user_idx").on(table.userId),
    accountUnique: uniqueIndex("ai_assistants_account_unique").on(table.socialAccountId),
  }),
);

export const media = mysqlTable(
  "media",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    title: varchar("title", { length: 240 }).notNull(),
    mediaType: varchar("mediaType", { length: 24 }).default("image").notNull(),
    url: text("url"),
    tags: text("tags"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({ userIdx: index("media_user_idx").on(table.userId) }),
);

export const posts = mysqlTable(
  "posts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    socialAccountId: int("socialAccountId"),
    mediaId: int("mediaId"),
    title: varchar("title", { length: 240 }).notNull(),
    caption: text("caption"),
    hashtags: text("hashtags"),
    cta: varchar("cta", { length: 240 }),
    status: varchar("status", { length: 24 }).default("draft").notNull(),
    scheduledAt: timestamp("scheduledAt"),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userIdx: index("posts_user_idx").on(table.userId),
    scheduleIdx: index("posts_schedule_idx").on(table.userId, table.scheduledAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type MediaItem = typeof media.$inferSelect;
export type SocialPost = typeof posts.$inferSelect;
export type AiAssistant = typeof aiAssistants.$inferSelect;

// Social OAuth tokens are intentionally not modeled in this first version.
// Add a dedicated encrypted server-side credential store when official OAuth apps are configured.
