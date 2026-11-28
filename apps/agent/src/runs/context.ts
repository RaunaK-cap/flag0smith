// The "context" object is handed to every tool during a run.
// It says WHICH Flagsmith project and GitHub repo this run works on,
// so the same tools work for demo mode and for "connect your own" mode.

import type { RunEvent } from "@flagpilot/shared";
import type { LlmKeys } from "../llm";
import { FlagsmithClient } from "../clients/flagsmith";
import { GithubClient } from "../clients/github";

export type RunTarget = {
  flagsmithApiUrl: string;
  flagsmithToken: string;
  projectId: number;
  environmentId: number; // numeric id, used by a few endpoints
  environmentKey: string; // the environment's client-side api_key, used in most API paths
  serverKey: string; // server-side SDK key, used by the traffic simulator
  githubToken: string;
  githubRepo: string; // "owner/name"
  llmKeys?: LlmKeys; // the user's own LLM key from the Connect page (tried before ours)
};

export type RunContext = {
  runId: string;
  target: RunTarget;
  flagsmith: FlagsmithClient;
  github: GithubClient;
  emit: (event: RunEvent) => void;
};

export function createRunContext(runId: string, target: RunTarget, emit: (e: RunEvent) => void): RunContext {
  return {
    runId,
    target,
    flagsmith: new FlagsmithClient(target.flagsmithApiUrl, target.flagsmithToken),
    github: new GithubClient(target.githubToken, target.githubRepo),
    emit,
  };
}
