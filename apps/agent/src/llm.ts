// Which LLM the agents talk to.
// - Gemini (free tier): uses Google's OpenAI-compatible endpoint. It only speaks the
//   Chat Completions API, so we switch the Agents SDK to that.
// - OpenAI: the SDK default (Responses API).
// Set GEMINI_API_KEY to use Gemini, or OPENAI_API_KEY to use OpenAI.

import OpenAI from "openai";
import { setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled } from "@openai/agents";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export const provider = process.env.GEMINI_API_KEY ? "gemini" : "openai";

export const model =
  process.env.MODEL || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-5.1");

export function setupLlm() {
  if (provider === "gemini") {
    setDefaultOpenAIClient(new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: GEMINI_URL }));
    setOpenAIAPI("chat_completions");
    // Tracing uploads to OpenAI's dashboard, which needs an OpenAI key.
    setTracingDisabled(true);
  }
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error("Set GEMINI_API_KEY or OPENAI_API_KEY in .env (see .env.example)");
  }
  console.log(`LLM: ${provider} (${model})`);
}
