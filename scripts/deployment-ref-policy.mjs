export const APPROVED_DEPLOYMENT_BRANCH = "development/stage-03-backend-foundation";

const fullCommitShaPattern = /^[0-9a-f]{40}$/;
const repositoryPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export const assertFullCommitSha = (value) => {
  if (typeof value !== "string" || !fullCommitShaPattern.test(value)) {
    throw new Error("Deployment commit must be a full lowercase 40-character SHA");
  }
  return value;
};

export const assertRepositoryName = (value) => {
  if (typeof value !== "string" || !repositoryPattern.test(value)) {
    throw new Error("GITHUB_REPOSITORY is invalid");
  }
  return value;
};

export const isCommitOnApprovedHistory = (compareStatus) =>
  compareStatus === "ahead" || compareStatus === "identical";

const readJson = async (response, description) => {
  if (!response.ok) throw new Error(`${description} failed with HTTP ${response.status}`);
  return response.json();
};

export const verifyDeploymentCommit = async ({
  commitSha,
  repository,
  approvedBranch = APPROVED_DEPLOYMENT_BRANCH,
  token,
  fetchImpl,
}) => {
  const sha = assertFullCommitSha(commitSha);
  const repo = assertRepositoryName(repository);
  if (typeof token !== "string" || token.length === 0) throw new Error("GITHUB_TOKEN is missing");
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");

  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  };
  const baseUrl = `https://api.github.com/repos/${repo}`;
  const commit = await readJson(
    await fetchImpl(`${baseUrl}/commits/${sha}`, { headers }),
    "Commit lookup",
  );
  if (commit.sha !== sha) throw new Error("GitHub did not return the exact requested commit");

  const compare = await readJson(
    await fetchImpl(`${baseUrl}/compare/${sha}...${encodeURIComponent(approvedBranch)}`, {
      headers,
    }),
    "Approved branch comparison",
  );
  if (!isCommitOnApprovedHistory(compare.status)) {
    throw new Error(`Commit is not on approved branch history (status: ${String(compare.status)})`);
  }
  return sha;
};
