import { AppError } from "@yuristim/errors";
import {
  buildSafeFtsQuery,
  type LegalAuthority,
  type LegalCompleteness,
  type VerifiedLegalCitation,
} from "@yuristim/knowledge";
import { runD1Operation, type D1ExecutionPolicy } from "./execution";

export type LegalSearchInput = {
  query: string;
  asOf: string;
  limit: number;
  documentType?: string;
  authority?: LegalAuthority;
  includeMetadata?: boolean;
};

export type LegalSearchResult = {
  provisionId: string;
  versionId: string;
  body: string;
  heading: string | null;
  path: string;
  rank: number;
  citation: VerifiedLegalCitation;
};

type SearchRow = {
  provisionId: string;
  versionId: string;
  body: string;
  heading: string | null;
  path: string;
  rank: number;
  documentId: string;
  documentTitle: string;
  documentNumber: string | null;
  authority: LegalAuthority;
  provisionNumber: string | null;
  versionLabel: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  verifiedAt: string;
  officialUrl: string;
  completeness: LegalCompleteness;
};

export type VerifiedImport = {
  sourceId: string;
  document: {
    id: string;
    externalId: string;
    title: string;
    documentNumber: string | null;
    documentType: string;
    legalAuthority: LegalAuthority;
    language: string;
    adoptedAt: string | null;
    officialUrl: string;
  };
  version: {
    id: string;
    label: string;
    legalStatus: "current" | "historical" | "repealed" | "future";
    effectiveFrom: string | null;
    effectiveTo: string | null;
    publishedAt: string | null;
    verifiedAt: string;
    completeness: LegalCompleteness;
    sourceHash: string;
    contentHash: string;
  };
  provisions: Array<{
    id: string;
    kind: string;
    number: string | null;
    heading: string | null;
    body: string;
    path: string;
    ordinal: number;
    contentHash: string;
  }>;
  runId: string;
};

export class D1LegalKnowledgeRepository {
  constructor(
    private readonly database: D1Database,
    private readonly policy: D1ExecutionPolicy,
  ) {}

  async status(): Promise<{
    sources: number;
    documents: number;
    versions: number;
    provisions: number;
    verifiedVersions: number;
    metadataOnlyVersions: number;
  }> {
    const row = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT
              (SELECT count(*) FROM legal_sources WHERE status = 'active') AS sources,
              (SELECT count(*) FROM legal_documents WHERE status = 'active') AS documents,
              (SELECT count(*) FROM legal_document_versions) AS versions,
              (SELECT count(*) FROM legal_provisions) AS provisions,
              (SELECT count(*) FROM legal_document_versions WHERE verification_status = 'verified') AS verifiedVersions,
              (SELECT count(*) FROM legal_document_versions WHERE completeness = 'metadata_only') AS metadataOnlyVersions`,
          )
          .first<{
            sources: number;
            documents: number;
            versions: number;
            provisions: number;
            verifiedVersions: number;
            metadataOnlyVersions: number;
          }>(),
      this.policy,
    );
    if (row === null)
      throw new AppError("SERVICE_UNAVAILABLE", "Legal knowledge status unavailable");
    return row;
  }

  async sources(): Promise<unknown[]> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, code, name, base_url AS baseUrl, official_domain AS officialDomain,
              authority_kind AS authorityKind, access_mode AS accessMode,
              auto_sync_enabled AS autoSyncEnabled, status, last_checked_at AS lastCheckedAt,
              last_success_at AS lastSuccessAt
             FROM legal_sources ORDER BY code`,
          )
          .all(),
      this.policy,
    );
    return result.results;
  }

  async search(input: LegalSearchInput): Promise<LegalSearchResult[]> {
    const fts = buildSafeFtsQuery(input.query);
    const conditions = [
      "legal_provisions_fts MATCH ?1",
      "d.status = 'active'",
      "v.verification_status = 'verified'",
      "v.legal_status <> 'quarantined'",
      "(v.effective_from IS NULL OR v.effective_from <= ?2)",
      "(v.effective_to IS NULL OR v.effective_to > ?2)",
    ];
    const bindings: unknown[] = [fts, input.asOf];
    if (!input.includeMetadata) conditions.push("v.completeness <> 'metadata_only'");
    if (input.documentType !== undefined) {
      bindings.push(input.documentType);
      conditions.push(`d.document_type = ?${bindings.length}`);
    }
    if (input.authority !== undefined) {
      bindings.push(input.authority);
      conditions.push(`d.legal_authority = ?${bindings.length}`);
    }
    bindings.push(input.limit);
    const limitBinding = `?${bindings.length}`;
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT p.id AS provisionId, p.version_id AS versionId, p.body,
              p.heading, p.path, bm25(legal_provisions_fts) AS rank,
              d.id AS documentId, d.title AS documentTitle,
              d.document_number AS documentNumber, d.legal_authority AS authority,
              p.provision_number AS provisionNumber, v.version_label AS versionLabel,
              v.effective_from AS effectiveFrom, v.effective_to AS effectiveTo,
              v.verified_at AS verifiedAt, d.official_url AS officialUrl,
              v.completeness
             FROM legal_provisions_fts
             JOIN legal_provisions p ON p.id = legal_provisions_fts.provision_id
             JOIN legal_document_versions v ON v.id = p.version_id
             JOIN legal_documents d ON d.id = v.document_id
             WHERE ${conditions.join(" AND ")}
             ORDER BY rank ASC, d.title ASC, p.ordinal ASC
             LIMIT ${limitBinding}`,
          )
          .bind(...bindings)
          .all<SearchRow>(),
      this.policy,
    );
    return result.results.map((row) => ({
      provisionId: row.provisionId,
      versionId: row.versionId,
      body: row.body,
      heading: row.heading,
      path: row.path,
      rank: row.rank,
      citation: {
        documentId: row.documentId,
        documentTitle: row.documentTitle,
        documentNumber: row.documentNumber,
        authority: row.authority,
        provision:
          row.provisionNumber === null
            ? row.heading
            : `${row.provisionNumber}${row.provisionNumber.match(/^\d+$/u) ? "-modda" : ""}`,
        version: row.versionLabel,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        verifiedAt: row.verifiedAt,
        officialUrl: row.officialUrl,
        completeness: row.completeness,
      },
    }));
  }

  async document(documentId: string, asOf: string): Promise<unknown> {
    const version = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT d.id, d.title, d.document_number AS documentNumber,
              d.document_type AS documentType, d.legal_authority AS legalAuthority,
              d.official_url AS officialUrl, d.adopted_at AS adoptedAt,
              v.id AS versionId, v.version_label AS version, v.legal_status AS legalStatus,
              v.effective_from AS effectiveFrom, v.effective_to AS effectiveTo,
              v.verified_at AS verifiedAt, v.verification_status AS verificationStatus,
              v.completeness
             FROM legal_documents d
             JOIN legal_document_versions v ON v.document_id = d.id
             WHERE d.id = ?1 AND d.status = 'active'
               AND v.verification_status = 'verified' AND v.legal_status <> 'quarantined'
               AND (v.effective_from IS NULL OR v.effective_from <= ?2)
               AND (v.effective_to IS NULL OR v.effective_to > ?2)
             ORDER BY v.effective_from DESC LIMIT 1`,
          )
          .bind(documentId, asOf)
          .first<Record<string, unknown>>(),
      this.policy,
    );
    if (version === null) throw new AppError("NOT_FOUND", "Legal document version not found");
    const provisions = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT id, provision_kind AS kind, provision_number AS number,
              heading, body, path, ordinal, content_hash AS contentHash
             FROM legal_provisions WHERE version_id = ?1 ORDER BY ordinal`,
          )
          .bind(version.versionId)
          .all(),
      this.policy,
    );
    return { ...version, provisions: provisions.results };
  }

  async ingestionRuns(limit = 50): Promise<unknown[]> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT r.id, s.code AS source, r.mode, r.status,
              r.discovered_count AS discoveredCount, r.imported_count AS importedCount,
              r.quarantined_count AS quarantinedCount, r.safe_error_code AS safeErrorCode,
              r.started_at AS startedAt, r.completed_at AS completedAt
             FROM legal_ingestion_runs r JOIN legal_sources s ON s.id = r.source_id
             ORDER BY r.started_at DESC LIMIT ?1`,
          )
          .bind(limit)
          .all(),
      this.policy,
    );
    return result.results;
  }

  async quarantine(limit = 50): Promise<unknown[]> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `SELECT q.id, s.code AS source, q.external_id AS externalId,
              q.reason_code AS reasonCode, q.payload_hash AS payloadHash,
              q.status, q.created_at AS createdAt, q.reviewed_at AS reviewedAt
             FROM legal_quarantine q JOIN legal_sources s ON s.id = q.source_id
             ORDER BY q.created_at DESC LIMIT ?1`,
          )
          .bind(limit)
          .all(),
      this.policy,
    );
    return result.results;
  }

  async reviewQuarantine(input: {
    id: string;
    decision: "approved" | "rejected";
    actorAccountId: string;
    now: string;
  }): Promise<void> {
    const result = await runD1Operation(
      () =>
        this.database
          .prepare(
            `UPDATE legal_quarantine SET status = ?1, reviewed_by_account_id = ?2,
              reviewed_at = ?3 WHERE id = ?4 AND status = 'open'`,
          )
          .bind(input.decision, input.actorAccountId, input.now, input.id)
          .run(),
      this.policy,
    );
    if (result.meta.changes !== 1) throw new AppError("CONFLICT", "Quarantine item is not open");
  }

  async source(sourceId: string): Promise<{ id: string; officialDomain: string } | null> {
    return runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT id, official_domain AS officialDomain FROM legal_sources WHERE id = ?1 AND status = 'active'",
          )
          .bind(sourceId)
          .first<{ id: string; officialDomain: string }>(),
      this.policy,
    );
  }

  async importVerified(input: VerifiedImport): Promise<void> {
    const statements: D1PreparedStatement[] = [
      this.database
        .prepare(
          `INSERT INTO legal_documents (
            id, source_id, external_id, title, document_number, document_type,
            legal_authority, language, adopted_at, official_url, status
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'active')`,
        )
        .bind(
          input.document.id,
          input.sourceId,
          input.document.externalId,
          input.document.title,
          input.document.documentNumber,
          input.document.documentType,
          input.document.legalAuthority,
          input.document.language,
          input.document.adoptedAt,
          input.document.officialUrl,
        ),
      this.database
        .prepare(
          `INSERT INTO legal_document_versions (
            id, document_id, version_label, legal_status, effective_from, effective_to,
            published_at, verified_at, verification_status, completeness, ingestion_method,
            source_hash, content_hash, source_url
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'verified', ?9,
            'manual_verified', ?10, ?11, ?12)`,
        )
        .bind(
          input.version.id,
          input.document.id,
          input.version.label,
          input.version.legalStatus,
          input.version.effectiveFrom,
          input.version.effectiveTo,
          input.version.publishedAt,
          input.version.verifiedAt,
          input.version.completeness,
          input.version.sourceHash,
          input.version.contentHash,
          input.document.officialUrl,
        ),
      ...input.provisions.map((provision) =>
        this.database
          .prepare(
            `INSERT INTO legal_provisions (
              id, version_id, provision_kind, provision_number, heading,
              body, path, ordinal, content_hash
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
          )
          .bind(
            provision.id,
            input.version.id,
            provision.kind,
            provision.number,
            provision.heading,
            provision.body,
            provision.path,
            provision.ordinal,
            provision.contentHash,
          ),
      ),
      this.database
        .prepare(
          `INSERT INTO legal_ingestion_runs (
            id, source_id, mode, status, discovered_count, imported_count,
            quarantined_count, started_at, completed_at
          ) VALUES (?1, ?2, 'manual', 'completed', 1, 1, 0, ?3, ?3)`,
        )
        .bind(input.runId, input.sourceId, input.version.verifiedAt),
    ];
    await runD1Operation(() => this.database.batch(statements), this.policy);
  }

  async reindex(): Promise<number> {
    const count = await runD1Operation(
      () =>
        this.database
          .prepare("SELECT count(*) AS count FROM legal_provisions")
          .first<{ count: number }>(),
      this.policy,
    );
    await runD1Operation(
      () =>
        this.database.batch([
          this.database.prepare("DELETE FROM legal_provisions_fts"),
          this.database.prepare(
            `INSERT INTO legal_provisions_fts (
              provision_id, version_id, document_title, document_number, heading, body
            )
            SELECT p.id, p.version_id, d.title, COALESCE(d.document_number, ''),
              COALESCE(p.heading, ''), p.body
            FROM legal_provisions p
            JOIN legal_document_versions v ON v.id = p.version_id
            JOIN legal_documents d ON d.id = v.document_id`,
          ),
        ]),
      this.policy,
    );
    return count?.count ?? 0;
  }

  async scheduledCheck(mode: "hourly_check" | "daily_sync", now: string): Promise<number> {
    const sources = await runD1Operation(
      () =>
        this.database
          .prepare(
            "SELECT id FROM legal_sources WHERE status = 'active' AND auto_sync_enabled = 1 ORDER BY id LIMIT 5",
          )
          .all<{ id: string }>(),
      this.policy,
    );
    for (const source of sources.results) {
      await runD1Operation(
        () =>
          this.database.batch([
            this.database
              .prepare(
                `INSERT INTO legal_ingestion_runs (
                  id, source_id, mode, status, started_at, completed_at, safe_error_code
                ) VALUES (?1, ?2, ?3, 'skipped', ?4, ?4, 'REMOTE_FETCH_REQUIRES_ADAPTER_APPROVAL')`,
              )
              .bind(crypto.randomUUID(), source.id, mode, now),
            this.database
              .prepare(
                "UPDATE legal_sources SET last_checked_at = ?1, updated_at = ?1 WHERE id = ?2",
              )
              .bind(now, source.id),
          ]),
        this.policy,
      );
    }
    return sources.results.length;
  }
}
