// Which LLM the agents talk to.
//
// Every request goes down a "fallback chain" of models until one answers:
//   Groq (fast) → Gemini (slower, but higher free limits) → OpenAI (if a key is set)
// A model that is rate-limited, overloaded or too slow is skipped for a minute.
// The agents' context is not lost when the model changes: every request carries the whole
// conversation, so the next model sees everything that happened before.
//
// Keys come from the server's .env (demo mode). A user can also bring their own key on the
// Connect page: it is tried first, used for that chat only, and never saved.

import OpenAI from "openai";
import { OpenAIProvider, setTracingDisabled } from "@openai/agents";

export type LlmKeys = { groq?: string; gemini?: string; openai?: string };
export type LlmProviderName = keyof LlmKeys;

const PROVIDERS: Record<LlmProviderName, { url: string; models: string[] }> = {
  groq: { url: "https://api.groq.com/openai/v1", models: ["openai/gpt-oss-120b", "qwen/qwen3.8-27b"] },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-3.5-flash-lite", "gemini-2.5-flash"],
  },
  openai: { url: "https://api.openai.com/v1", models: ["gpt-5.1"] },
};

const serverKeys: LlmKeys = {
  groq: process.env.GROQ_API_KEY || undefined,
  gemini: process.env.GEMINI_API_KEY || undefined,
  openai: process.env.OPENAI_API_KEY || undefined,
};

// The agents need a model name, but the real model is picked per request by the chain below.
export const model = "auto";

export function setupLlm() {
  // Tracing uploads runs to OpenAI's dashboard and needs an OpenAI key.
  if (!serverKeys.openai) setTracingDisabled(true);
  const steps = buildChain([serverKeys]);
  if (steps.length === 0) console.warn("No LLM key in .env (GROQ_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY)");
  console.log(`LLM chain: ${steps.map((step) => step.name).join(" → ") || "none"}`);
}

// One model provider per chat. `userKeys` (from the Connect page) are tried before ours.
export function createModelProvider(userKeys?: LlmKeys) {
  const steps = buildChain([userKeys ?? {}, serverKeys]);
  if (steps.length === 0) throw new Error("No LLM key: set GROQ_API_KEY or GEMINI_API_KEY in .env");
  const client = new OpenAI({ apiKey: "set-per-request", baseURL: BASE, fetch: chainFetch(steps), maxRetries: 2 });
  return new OpenAIProvider({ openAIClient: client, useResponses: false });
}

// ---------------------------------------------------------------------------

type Step = { name: string; provider: LlmProviderName; url: string; key: string; model: string };

const BASE = "http://llm-chain"; // placeholder; chainFetch swaps in each provider's real URL

const WAIT_FOR_ANSWER_MS = 25_000; // how long to wait for a model to start answering
const BUSY_PAUSE_MS = 60_000; // a busy model is skipped for this long
const busyUntil = new Map<string, number>(); // step name + key -> time it can be tried again

function buildChain(keySets: LlmKeys[]): Step[] {
  const steps: Step[] = [];
  for (const keys of keySets) {
    for (const provider of ["groq", "gemini", "openai"] as const) {
      const key = keys[provider];
      if (!key) continue;
      for (const model of PROVIDERS[provider].models) {
        if (steps.some((step) => step.model === model && step.key === key)) continue;
        steps.push({ name: `${provider}:${model}`, provider, url: PROVIDERS[provider].url, key, model });
      }
    }
  }
  return steps;
}

function chainFetch(steps: Step[]) {
  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = String(url).replace(BASE, ""); // e.g. "/chat/completions"
    const body = JSON.parse(String(init?.body ?? "{}"));
    const usable = steps.filter((step, i) => i === steps.length - 1 || (busyUntil.get(busyId(step)) ?? 0) < Date.now());

    let response: Response | undefined;
    for (const [i, step] of usable.entries()) {
      const last = i === usable.length - 1;
      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${step.key}`);
      const started = Date.now();
      response = await fetchWithTimeout(
        step.url + path,
        { ...init, headers, body: JSON.stringify(bodyFor(step, body)) },
        last ? 0 : WAIT_FOR_ANSWER_MS,
      );

      if (response && response.ok) {
        console.log(`[llm] ${step.name} ${Date.now() - started}ms`);
        break;
      }
      const reason = response ? await failureReason(response) : "no answer";
      if (!reason) break; // a real error (e.g. bad request): let the SDK report it
      busyUntil.set(busyId(step), Date.now() + BUSY_PAUSE_MS);
      console.warn(`[llm] ${step.name} ${reason}, trying ${usable[i + 1]?.name ?? "nothing else"}`);
    }

    if (!response?.body) return response ?? new Response("All models are busy", { status: 503 });
    if (!response.ok) return response;

    // Read a copy of the answer for Gemini's thought signatures; the SDK reads the other copy.
    const [copy, forSdk] = response.body.tee();
    new Response(copy).text().then(rememberSignatures).catch(() => {});
    return new Response(forSdk, response);
  };
}

// Why a model should be skipped, or undefined if the error is not about the model being busy.
async function failureReason(response: Response): Promise<string | undefined> {
  if (response.status === 429) return "is rate-limited (429)";
  if (response.status === 503) return "is overloaded (503)";
  if (response.status === 413) return "says the request is too large (413)";
  if (response.status === 401 || response.status === 403) return `rejected the key (${response.status})`;
  // 400: e.g. Groq's "tool_use_failed" when a model writes a broken tool call,
  // or a provider being stricter than others about the request. Another model can try it.
  if (response.status === 400) {
    const message = (await response.clone().text()).slice(0, 160).replace(/\s+/g, " ");
    return `rejected the request (400: ${message})`;
  }
  return undefined;
}

function busyId(step: Step) {
  return `${step.name}:${step.key.slice(-6)}`;
}

// Returns undefined if the model hasn't started answering within `ms` (0 = no limit).
async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  if (!ms) return fetch(url, init);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), ms);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout.signal]) : timeout.signal;
  try {
    return await fetch(url, { ...init, signal });
  } catch (error) {
    if (timeout.signal.aborted && !init.signal?.aborted) return undefined;
    throw error;
  } finally {
    clearTimeout(timer); // only limits the wait for the first byte, not the whole streamed answer
  }
}

// The same request, adjusted for one provider.
function bodyFor(step: Step, body: any) {
  const messages = (body.messages ?? []).map((message: any) => {
    if (!message.tool_calls) return message;
    const toolCalls = message.tool_calls.map((call: any) => {
      const { extra_content, ...rest } = call;
      // Gemini needs its thought signature back; other providers may reject the extra field.
      if (step.provider !== "gemini") return rest;
      return { ...rest, extra_content: { google: { thought_signature: signatures.get(call.id) ?? NO_SIGNATURE } } };
    });
    return { ...message, tool_calls: toolCalls };
  });
  const tools = body.tools?.map((tool: any) =>
    tool.function?.parameters
      ? { ...tool, function: { ...tool.function, parameters: simplifySchema(tool.function.parameters) } }
      : tool,
  );
  return { ...body, model: step.model, messages, ...(tools && { tools }) };
}

// Groq is stricter than OpenAI/Gemini about tool schemas. This rewrites two patterns it rejects
// into ones that mean the same thing (and that every provider accepts):
// - a tool without inputs: `required: []` next to empty `properties`
// - an "anyOf" directly inside another "anyOf" (e.g. an optional string|number|boolean)
export function simplifySchema(schema: any): any {
  if (Array.isArray(schema)) return schema.map(simplifySchema);
  if (!schema || typeof schema !== "object") return schema;

  const result: any = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "$schema") continue;
    result[key] = simplifySchema(value);
  }
  if (Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.flatMap((option: any) =>
      option.anyOf && Object.keys(option).length === 1 ? option.anyOf : [option],
    );
  }
  if (result.type === "object" && Object.keys(result.properties ?? {}).length === 0) {
    delete result.required;
  }
  return result;
}

// --- Gemini "thought signatures" ---
// Newer Gemini models attach a thought_signature to every tool call and refuse the next request
// unless it is sent back. The Agents SDK drops it, so we remember it here and add it back above.

const signatures = new Map<string, string>(); // tool call id -> signature

// Google's documented placeholder for tool calls without a signature
// (made by another model, or before a server restart).
const NO_SIGNATURE = "skip_thought_signature_validator";

// Works for both a plain JSON response and a streamed one ("data: {...}" lines).
function rememberSignatures(text: string) {
  const chunks = text.includes("data:")
    ? text.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim())
    : [text];
  for (const chunk of chunks) {
    try {
      for (const choice of JSON.parse(chunk).choices ?? []) {
        for (const call of (choice.delta ?? choice.message)?.tool_calls ?? []) {
          const signature = call.extra_content?.google?.thought_signature;
          if (call.id && signature) signatures.set(call.id, signature);
        }
      }
    } catch {
      // "[DONE]" or a partial line: nothing to remember
    }
  }
}
