// "Connect your own" keys. Kept in sessionStorage only: they disappear when the tab closes,
// and the backend uses them for a single run without saving them.

export type Connection = {
  flagsmithApiUrl: string;
  flagsmithToken: string;
  projectId: number;
  environmentId: number;
  environmentKey: string;
  serverKey: string;
  githubToken: string;
  githubRepo: string;
};

const KEY = "flagpilot.connection";

export function readConnection(): Connection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Connection) : null;
  } catch {
    return null;
  }
}

export function saveConnection(connection: Connection) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(connection));
  } catch {
    // Private mode or blocked storage: the user just stays in demo mode.
  }
}

export function clearConnection() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
