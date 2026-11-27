import { Brain, Code2, Flag, LineChart, Sparkles, Workflow, type LucideIcon } from "lucide-react";
import type { AgentName } from "@flagpilot/shared";

export const agentMeta: Record<AgentName, { label: string; icon: LucideIcon; role: string }> = {
  orchestrator: { label: "Orchestrator", icon: Workflow, role: "Leads the run" },
  planner: { label: "Planner", icon: Brain, role: "Designs the experiment" },
  flag_engineer: { label: "Flag engineer", icon: Flag, role: "Works in Flagsmith" },
  coder: { label: "Coder", icon: Code2, role: "Changes code, opens PRs" },
  analyst: { label: "Analyst", icon: LineChart, role: "Reads the results" },
  janitor: { label: "Janitor", icon: Sparkles, role: "Rolls out and cleans up" },
};
