import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  bearerHeaders,
  createBotSession,
  createOwnerSession,
} from "../helpers/auth";

const profile = {
  professionalType: "advocate",
  fullName: "Synthetic Advocate",
  professionalStatus: "Advokat",
  experienceYears: 9,
  regionCode: "tashkent",
  bioUz: "Sintetik integratsiya testi uchun professional profil.",
  bioRu: "Синтетический профиль для интеграционного теста.",
  bioEn: "Synthetic professional profile for integration testing.",
  phone: "+998901234567",
  telegramUsername: "synthetic_advocate",
  contactVisible: true,
  remoteAvailable: true,
  officeAddress: "Synthetic test address",
  priceNote: null,
  education: ["Synthetic Law University"],
  services: ["Huquqiy maslahat"],
  certificates: [],
  licenseNumber: "SYNTHETIC-LICENSE-001",
  licenseIssuer: "Synthetic test authority",
  specializations: ["family", "civil"],
  primarySpecialization: "family",
  languages: ["uz", "ru", "en"],
};

describe("Stage 09 lawyer directory", () => {
  it("enforces verification, directory trust, reviews, moderation and reverification", async () => {
    const professional = await createBotSession(SELF, "910000091");
    const professionalHeaders = bearerHeaders(professional.accessToken);
    const reviewer = await createOwnerSession(SELF);
    const reviewerHeaders = bearerHeaders(reviewer.accessToken);

    const specializations = await SELF.fetch(
      "https://example.test/api/v1/lawyers/specializations?locale=uz",
    );
    expect(specializations.status).toBe(200);
    expect((await specializations.json<{ data: { specializations: unknown[] } }>()).data.specializations).toHaveLength(20);

    const registration = await SELF.fetch(
      "https://example.test/api/v1/lawyers/professional/registration",
      { method: "POST", headers: professionalHeaders, body: JSON.stringify(profile) },
    );
    expect(registration.status).toBe(201);
    const registered = await registration.json<{ data: { id: string; licenseNumber: string } }>();
    const profileId = registered.data.id;
    expect(registered.data.licenseNumber).toBe("SYNTHETIC-LICENSE-001");

    const hiddenDirectory = await SELF.fetch(
      "https://example.test/api/v1/lawyers/directory",
      { headers: reviewerHeaders },
    );
    expect(hiddenDirectory.status).toBe(200);
    expect(
      (await hiddenDirectory.json<{ data: { profiles: Array<{ id: string }> } }>()).data.profiles.some(
        (item) => item.id === profileId,
      ),
    ).toBe(false);

    const upload = await SELF.fetch(
      "https://example.test/api/v1/lawyers/professional/verification/documents",
      { method: "POST", headers: professionalHeaders, body: "{}" },
    );
    expect(upload.status).toBe(403);

    const submission = await SELF.fetch(
      "https://example.test/api/v1/lawyers/professional/verification/submit",
      { method: "POST", headers: professionalHeaders, body: JSON.stringify({ applicantNote: "Synthetic verification" }) },
    );
    expect(submission.status).toBe(201);
    const verificationCase = await submission.json<{ data: { caseId: string } }>();

    const approval = await SELF.fetch(
      "https://example.test/api/v1/admin/lawyers/verifications/" +
        verificationCase.data.caseId +
        "/decision",
      {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({ decision: "approved", reasonCode: null, note: "Synthetic approval" }),
      },
    );
    expect(approval.status).toBe(200);

    const directory = await SELF.fetch(
      "https://example.test/api/v1/lawyers/directory?specialization=family&language=uz&sort=relevance",
      { headers: reviewerHeaders },
    );
    expect(directory.status).toBe(200);
    const publicProfile = (
      await directory.json<{ data: { profiles: Array<Record<string, unknown>> } }>()
    ).data.profiles.find((item) => item.id === profileId);
    expect(publicProfile).toBeDefined();
    expect(publicProfile).not.toHaveProperty("licenseNumber");
    expect(publicProfile).not.toHaveProperty("accountId");

    const recommendation = await SELF.fetch(
      "https://example.test/api/v1/lawyers/recommendations",
      {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({ issue: "Oilaviy ajrashish va aliment masalasi", locale: "uz" }),
      },
    );
    expect(recommendation.status).toBe(200);
    const recommended = await recommendation.json<{
      data: { profiles: Array<{ id: string }>; matchedSpecializations: string[] };
    }>();
    expect(recommended.data.matchedSpecializations).toContain("family");
    expect(recommended.data.profiles.every((item) => item.id === profileId)).toBe(true);

    const favorite = await SELF.fetch(
      "https://example.test/api/v1/lawyers/favorites/" + profileId,
      { method: "PUT", headers: reviewerHeaders },
    );
    expect(favorite.status).toBe(200);

    const contact = await SELF.fetch(
      "https://example.test/api/v1/lawyers/directory/" + profileId + "/contact",
      {
        method: "POST",
        headers: { ...reviewerHeaders, "idempotency-key": "synthetic-contact-001" },
        body: JSON.stringify({ type: "phone" }),
      },
    );
    expect(contact.status).toBe(201);
    expect((await contact.json<{ data: { serviceConfirmed: boolean } }>()).data.serviceConfirmed).toBe(false);

    const review = await SELF.fetch(
      "https://example.test/api/v1/lawyers/directory/" + profileId + "/reviews",
      {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({ rating: 5, body: "Sintetik sharh", anonymous: false }),
      },
    );
    expect(review.status).toBe(201);

    const duplicateReview = await SELF.fetch(
      "https://example.test/api/v1/lawyers/directory/" + profileId + "/reviews",
      {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({ rating: 4, body: "Takroriy sharh", anonymous: false }),
      },
    );
    expect(duplicateReview.status).toBe(409);

    const complaint = await SELF.fetch(
      "https://example.test/api/v1/lawyers/complaints",
      {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({
          profileId,
          reviewId: null,
          category: "professional_info",
          description: "Synthetic moderation evidence for an integration test.",
          evidenceNote: "No private file attached.",
        }),
      },
    );
    expect(complaint.status).toBe(201);
    const complaintId = (await complaint.json<{ data: { complaintId: string } }>()).data.complaintId;

    const warning = await SELF.fetch(
      "https://example.test/api/v1/admin/lawyers/moderation/actions",
      {
        method: "POST",
        headers: reviewerHeaders,
        body: JSON.stringify({
          profileId,
          complaintId,
          reviewId: null,
          action: "warning",
          reasonCode: "SYNTHETIC_WARNING",
          note: "Synthetic reasoned decision",
          complaintDecision: "upheld",
        }),
      },
    );
    expect(warning.status).toBe(201);

    const own = await SELF.fetch(
      "https://example.test/api/v1/lawyers/professional/profile",
      { headers: professionalHeaders },
    );
    const ownProfile = (await own.json<{ data: typeof profile & { publicSlug: string } }>()).data;
    const changed = await SELF.fetch(
      "https://example.test/api/v1/lawyers/professional/profile",
      {
        method: "PATCH",
        headers: professionalHeaders,
        body: JSON.stringify({ ...profile, fullName: "Synthetic Advocate Updated" }),
      },
    );
    expect(changed.status).toBe(200);
    const changedPayload = await changed.json<{
      data: { profile: { verificationStatus: string; directoryStatus: string }; reverificationRequired: boolean };
    }>();
    expect(changedPayload.data.reverificationRequired).toBe(true);
    expect(changedPayload.data.profile.verificationStatus).toBe("reverification_required");
    expect(changedPayload.data.profile.directoryStatus).toBe("hidden");
    expect(ownProfile.publicSlug).toBeTruthy();

    const hiddenAfterCriticalChange = await SELF.fetch(
      "https://example.test/api/v1/lawyers/directory",
      { headers: reviewerHeaders },
    );
    expect(
      (await hiddenAfterCriticalChange.json<{ data: { profiles: Array<{ id: string }> } }>()).data.profiles.some(
        (item) => item.id === profileId,
      ),
    ).toBe(false);
  });
});
