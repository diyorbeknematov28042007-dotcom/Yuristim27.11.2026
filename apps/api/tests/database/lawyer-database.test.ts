import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Stage 09 lawyer D1 constraints", () => {
  it("seeds exactly 20 approved specializations", async () => {
    const result = await env.DB.prepare(
      "SELECT count(*) AS count FROM lawyer_specializations WHERE active = 1",
    ).first<{ count: number }>();
    expect(result?.count).toBe(20);
  });

  it("keeps contact events append-only and enforces foreign keys", async () => {
    const suffix = crypto.randomUUID();
    const ownerId = "lawyer-owner-" + suffix;
    const viewerId = "lawyer-viewer-" + suffix;
    const profileId = "lawyer-profile-" + suffix;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO accounts (id, telegram_user_id, status) VALUES (?1, ?2, 'active')",
      ).bind(ownerId, 920000000 + Math.floor(Math.random() * 100000)),
      env.DB.prepare(
        "INSERT INTO accounts (id, telegram_user_id, status) VALUES (?1, ?2, 'active')",
      ).bind(viewerId, 930000000 + Math.floor(Math.random() * 100000)),
      env.DB.prepare(
        "INSERT INTO lawyer_profiles (id, account_id, public_slug, professional_type, full_name, professional_status, experience_years, region_code, verification_status, directory_status, profile_revision, verified_revision) VALUES (?1, ?2, ?3, 'lawyer', 'Synthetic Lawyer', 'Yurist', 3, 'test', 'verified', 'active', 1, 1)",
      ).bind(profileId, ownerId, "synthetic-" + suffix),
    ]);
    const eventId = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO lawyer_contact_events (id, profile_id, account_id, contact_type, request_id, clicked_at) VALUES (?1, ?2, ?3, 'phone', ?4, ?5)",
    )
      .bind(eventId, profileId, viewerId, crypto.randomUUID(), new Date().toISOString())
      .run();
    await expect(
      env.DB.prepare("UPDATE lawyer_contact_events SET clicked_at = ?1 WHERE id = ?2")
        .bind(new Date().toISOString(), eventId)
        .run(),
    ).rejects.toThrow(/append-only/u);
    await expect(
      env.DB.prepare(
        "INSERT INTO lawyer_favorites (account_id, profile_id, created_at) VALUES (?1, ?2, ?3)",
      )
        .bind(viewerId, "missing-profile", new Date().toISOString())
        .run(),
    ).rejects.toThrow();
  });
});
