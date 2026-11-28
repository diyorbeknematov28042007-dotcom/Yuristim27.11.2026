import { appendFile } from "node:fs/promises";
import { APPROVED_DEPLOYMENT_BRANCH, verifyDeploymentCommit } from "./deployment-ref-policy.mjs";

const sha = await verifyDeploymentCommit({
  commitSha: process.env.DEPLOY_COMMIT_SHA,
  repository: process.env.GITHUB_REPOSITORY,
  approvedBranch: APPROVED_DEPLOYMENT_BRANCH,
  token: process.env.GITHUB_TOKEN,
  fetchImpl: fetch,
});

if (typeof process.env.GITHUB_OUTPUT !== "string" || process.env.GITHUB_OUTPUT.length === 0) {
  throw new Error("GITHUB_OUTPUT is missing");
}
await appendFile(process.env.GITHUB_OUTPUT, `sha=${sha}\n`, "utf8");
console.log(`Authorized staging deployment commit ${sha}`);
