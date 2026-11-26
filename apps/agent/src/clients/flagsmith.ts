// A small wrapper around Flagsmith's Admin REST API.
// Tools call client.get("/projects/1/features/") etc. — paths are relative to the API base URL.

export class FlagsmithError extends Error {
  constructor(
    public status: number,
    public path: string,
    public body: unknown,
  ) {
    super(`Flagsmith ${status} on ${path}: ${JSON.stringify(body).slice(0, 300)}`);
  }
}

export class FlagsmithClient {
  constructor(
    private baseUrl: string,
    private token: string,
  ) {}

  get(path: string) {
    return this.request("GET", path);
  }
  post(path: string, body?: unknown) {
    return this.request("POST", path, body);
  }
  put(path: string, body?: unknown) {
    return this.request("PUT", path, body);
  }
  patch(path: string, body?: unknown) {
    return this.request("PATCH", path, body);
  }
  delete(path: string) {
    return this.request("DELETE", path);
  }

  private async request(method: string, path: string, body?: unknown): Promise<any> {
    const url = this.baseUrl.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Api-Key ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const data = text ? safeJson(text) : null;
    if (!response.ok) throw new FlagsmithError(response.status, path, data);
    return data;
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
