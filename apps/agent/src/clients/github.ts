// A small wrapper around the GitHub API for the coder agent.
// It can read files and open pull requests. It can NOT merge — a human always merges.

import { Octokit } from "@octokit/rest";

export type FileChange = { path: string; content: string | null }; // null = delete the file

export class GithubClient {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(token: string, repoFullName: string) {
    this.octokit = new Octokit({ auth: token });
    [this.owner = "", this.repo = ""] = repoFullName.split("/");
  }

  async defaultBranch(): Promise<string> {
    const { data } = await this.octokit.repos.get({ owner: this.owner, repo: this.repo });
    return data.default_branch;
  }

  // Lists every file path in the repo (skips node_modules and lock files).
  async listFiles(): Promise<string[]> {
    const branch = await this.defaultBranch();
    const { data } = await this.octokit.git.getTree({
      owner: this.owner,
      repo: this.repo,
      tree_sha: branch,
      recursive: "true",
    });
    return data.tree
      .filter((item) => item.type === "blob" && item.path)
      .map((item) => item.path!)
      .filter((path) => !path.includes("node_modules/") && !path.endsWith(".lock") && !path.endsWith("lock.json"));
  }

  async readFile(path: string): Promise<string> {
    const { data } = await this.octokit.repos.getContent({ owner: this.owner, repo: this.repo, path });
    if (Array.isArray(data) || data.type !== "file") throw new Error(`${path} is not a file`);
    return Buffer.from(data.content, "base64").toString("utf8");
  }

  // Creates a branch with all the changes in ONE commit, then opens a PR.
  async openPullRequest(input: { branch: string; title: string; body: string; changes: FileChange[] }) {
    const { owner, repo } = this;
    const base = await this.defaultBranch();

    const { data: baseRef } = await this.octokit.git.getRef({ owner, repo, ref: `heads/${base}` });
    const baseSha = baseRef.object.sha;
    const { data: baseCommit } = await this.octokit.git.getCommit({ owner, repo, commit_sha: baseSha });

    const { data: tree } = await this.octokit.git.createTree({
      owner,
      repo,
      base_tree: baseCommit.tree.sha,
      tree: input.changes.map((change) => ({
        path: change.path,
        mode: "100644" as const,
        type: "blob" as const,
        content: change.content ?? undefined,
        sha: change.content === null ? null : undefined, // sha: null deletes the file
      })),
    });

    const { data: commit } = await this.octokit.git.createCommit({
      owner,
      repo,
      message: input.title,
      tree: tree.sha,
      parents: [baseSha],
    });

    await this.octokit.git.createRef({ owner, repo, ref: `refs/heads/${input.branch}`, sha: commit.sha });

    const { data: pr } = await this.octokit.pulls.create({
      owner,
      repo,
      head: input.branch,
      base,
      title: input.title,
      body: input.body,
    });
    return { number: pr.number, url: pr.html_url };
  }

  async pullRequestStatus(number: number) {
    const { data } = await this.octokit.pulls.get({ owner: this.owner, repo: this.repo, pull_number: number });
    return { state: data.state, merged: data.merged, url: data.html_url, title: data.title };
  }
}
