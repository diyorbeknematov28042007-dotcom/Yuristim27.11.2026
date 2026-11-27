import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  APPROVED_DEPLOYMENT_BRANCH,
  assertFullCommitSha,
  isCommitOnApprovedHistory,
  verifyDeploymentCommit,
} from "./deployment-ref-policy.mjs";

const validSha = "a".repeat(40);

test("deployment SHA validation rejects partial and injected input", () => {
  assert.equal(assertFullCommitSha(validSha), validSha);
  for (const invalid of ["abc123", "A".repeat(40), `${validSha}; echo injected`, "$(id)"]) {
    assert.throws(() => assertFullCommitSha(invalid), /full lowercase 40-character SHA/);
  }
});

test("only commits identical to or behind the approved branch head are deployable", () => {
  assert.equal(isCommitOnApprovedHistory("identical"), true);
  assert.equal(isCommitOnApprovedHistory("ahead"), true);
  assert.equal(isCommitOnApprovedHistory("behind"), false);
  assert.equal(isCommitOnApprovedHistory("diverged"), false);
});

test("deployment authorization verifies exact commit existence and branch ancestry", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("/commits/")) return new Response(JSON.stringify({ sha: validSha }));
    return new Response(JSON.stringify({ status: "ahead" }));
  };

  assert.equal(
    await verifyDeploymentCommit({
      commitSha: validSha,
      repository: "owner/repository",
      approvedBranch: APPROVED_DEPLOYMENT_BRANCH,
      token: "test-token",
      fetchImpl,
    }),
    validSha,
  );
  assert.equal(calls.length, 2);
  assert.match(calls[1], /compare\/a{40}\.\.\.development%2Fstage-05-financial-core$/);
});

test("deployment workflow never interpolates dispatch input into shell or checkout", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/deploy-staging.yml", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(workflow, /run:[^\n]*\$\{\{\s*inputs\.commit_sha/);
  assert.doesNotMatch(workflow, /ref:\s*\$\{\{\s*inputs\.commit_sha/);
  assert.match(workflow, /DEPLOY_COMMIT_SHA:\s*\$\{\{\s*inputs\.commit_sha\s*\}\}/);
});
