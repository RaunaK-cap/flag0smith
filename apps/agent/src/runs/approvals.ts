// When the agent wants to do something risky, the run pauses here until a human
// clicks Approve or Reject on the dashboard.

type Pending = { resolve: (approved: boolean) => void };

const pending = new Map<string, Pending>(); // key: `${runId}:${approvalId}`

export function waitForApproval(runId: string, approvalId: string): Promise<boolean> {
  return new Promise((resolve) => {
    pending.set(`${runId}:${approvalId}`, { resolve });
  });
}

// Returns false if there was nothing waiting for this approval.
export function resolveApproval(runId: string, approvalId: string, approved: boolean): boolean {
  const key = `${runId}:${approvalId}`;
  const item = pending.get(key);
  if (!item) return false;
  pending.delete(key);
  item.resolve(approved);
  return true;
}
