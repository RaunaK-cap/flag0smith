// Which LLM the agents talk to.
// - Gemini: uses Google's OpenAI-compatible endpoint. It only speaks the
//   Chat Completions API, so we switch the Agents SDK to that.
// - OpenAI: the SDK default (Responses API).
// Set GEMINI_API_KEY to use Gemini, or OPENAI_API_KEY to use OpenAI.

import OpenAI from "openai";
import { setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from "@openai/agents";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export const provider = process.env.GEMINI_API_KEY ? "gemini" : "openai";

export const model =
  process.env.MODEL || (provider === "gemini" ? "gemini-3.5-flash" : "gpt-5.1");

export function setupLlm() {
  if (provider === "gemini") {
    setDefaultOpenAIClient(
      new OpenAI({
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: GEMINI_URL,
        fetch: geminiFetch,
        maxRetries: 4, // Gemini sometimes answers 503 "high demand"; the client retries with backoff
      }),
    );
    setOpenAIAPI("chat_completions");
    // Tracing uploads to OpenAI's dashboard, which needs an OpenAI key.
    setTracingDisabled(true);
  }
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error("Set GEMINI_API_KEY or OPENAI_API_KEY in .env (see .env.example)");
  }
  console.log(`LLM: ${provider} (${model})`);
}

// --- Gemini "thought signatures" ---
// Newer Gemini models attach a thought_signature to every tool call and refuse the next
// request unless it is sent back with that tool call. The Agents SDK doesn't know about it
// and drops it, so we remember signatures from responses and put them back into requests.

const signatures = new Map<string, string>(); // tool call id -> signature

// Google's documented placeholder for a tool call whose signature we don't have
// (e.g. a chat continued after a server restart).
const NO_SIGNATURE = "skip_thought_signature_validator";

// If the chosen model is overloaded (Google answers 503/429, or doesn't answer at all),
// the same request is retried on these models, in order.
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-2.5-flash"];
const WAIT_FOR_ANSWER_MS = 25_000; // how long to wait for a model to start answering
const BUSY_PAUSE_MS = 60_000; // after a model says it's busy, skip it for this long
const busyUntil = new Map<string, number>(); // model -> time it can be tried again

async function geminiFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  if (typeof init?.body !== "string") return fetch(url, init);

  const body = JSON.parse(init.body);
  for (const message of body.messages ?? []) {
    for (const call of message.tool_calls ?? []) {
      call.extra_content ??= { google: { thought_signature: signatures.get(call.id) ?? NO_SIGNATURE } };
    }
  }

  const models = [body.model, ...FALLBACK_MODELS.filter((m) => m !== body.model)].filter(
    (m, i, all) => i === all.length - 1 || (busyUntil.get(m) ?? 0) < Date.now(),
  );
  let response: Response | undefined;
  for (const [i, model] of models.entries()) {
    const last = i === models.length - 1;
    response = await fetchWithTimeout(url, { ...init, body: JSON.stringify({ ...body, model }) }, last ? 0 : WAIT_FOR_ANSWER_MS);
    if (response && response.status !== 503 && response.status !== 429) break;
    busyUntil.set(model, Date.now() + BUSY_PAUSE_MS);
    console.warn(`[llm] ${model} is busy (${response?.status ?? "no answer"}), trying ${models[i + 1] ?? "again later"}`);
  }
  if (!response?.body) return response ?? new Response("model timed out", { status: 504 });

  // Read a copy of the response for signatures; the SDK reads the other copy as usual.
  const [copy, forSdk] = response.body.tee();
  new Response(copy).text().then(rememberSignatures).catch(() => {});
  return new Response(forSdk, response);
}

// Returns undefined if the model hasn't started answering within `ms` (0 = no limit).
async function fetchWithTimeout(url: string | URL | Request, init: RequestInit, ms: number) {
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
      // "[DONE]" or a partial line, nothing to remember
    }
  }
}
