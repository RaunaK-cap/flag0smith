// Which tools each agent gets.
// Read-only tools are shared widely. Tools that change things only go to the agent that owns them,
// and every one of those asks a human for approval first (needsApproval in the tool file).

import * as flags from "./flags";
import * as segments from "./segments";
import * as environments from "./environments";
import * as identities from "./identities";
import * as experiments from "./experiments";
import * as rollouts from "./rollouts";
import * as history from "./history";
import * as github from "./github";
import * as traffic from "./traffic";

const readFlagsmith = [
  flags.listFlags,
  flags.getFlag,
  segments.listSegments,
  environments.listEnvironments,
  experiments.listMetrics,
  experiments.listExperiments,
  experiments.getExperiment,
];

export const plannerTools = [...readFlagsmith];

export const flagEngineerTools = [
  ...readFlagsmith,
  flags.createFlag,
  flags.addVariant,
  flags.updateFlagState,
  segments.createSegment,
  segments.addSegmentOverride,
  environments.compareEnvironments,
  environments.cloneEnvironment,
  identities.findIdentity,
  identities.getIdentityFlags,
  identities.setIdentityOverride,
  experiments.createMetric,
  experiments.createExperiment,
  experiments.startExperiment,
  experiments.pauseExperiment,
  experiments.warehouseStatus,
  history.registerWebhook,
];

export const coderTools = [
  flags.getFlag,
  github.listRepoFiles,
  github.readRepoFile,
  github.openPullRequest,
  github.pullRequestStatus,
];

export const analystTools = [
  experiments.getExperiment,
  experiments.refreshResults,
  experiments.getResults,
  traffic.trafficStatus,
];

export const janitorTools = [
  ...readFlagsmith,
  flags.updateFlagState,
  flags.archiveFlag,
  experiments.getResults,
  experiments.completeExperiment,
  rollouts.rolloutToPercentage,
  rollouts.removeRollout,
  history.getAuditLog,
  history.getFlagHistory,
  history.findStaleFlags,
];

// The orchestrator mostly delegates, but handles the "glue" steps itself.
export const orchestratorTools = [
  github.pullRequestStatus,
  experiments.startExperiment,
  experiments.getExperiment,
  traffic.startTraffic,
  traffic.stopTraffic,
  traffic.trafficStatus,
];
