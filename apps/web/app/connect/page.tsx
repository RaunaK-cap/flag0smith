"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eyebrow, Section, Title } from "@/components/frame";
import { clearConnection, readConnection, saveConnection, type Connection } from "@/lib/connection";

const empty: Connection = {
  flagsmithApiUrl: "https://api.flagsmith.com/api/v1",
  flagsmithToken: "",
  projectId: 0,
  environmentId: 0,
  environmentKey: "",
  serverKey: "",
  githubToken: "",
  githubRepo: "",
  llmProvider: "",
  llmKey: "",
};

const llmProviders = [
  { value: "", label: "Use FlagPilot's (default)", hint: "" },
  { value: "groq", label: "Groq", hint: "console.groq.com/keys (free)" },
  { value: "gemini", label: "Google Gemini", hint: "aistudio.google.com/apikey (free)" },
  { value: "openai", label: "OpenAI", hint: "platform.openai.com/api-keys" },
] as const;

type Field = {
  key: keyof Connection;
  label: string;
  hint: string;
  secret?: boolean;
  number?: boolean;
};

const flagsmithFields: Field[] = [
  { key: "flagsmithToken", label: "Admin API key", hint: "Organisation settings → API keys", secret: true },
  { key: "projectId", label: "Project ID", hint: "The number in the project URL", number: true },
  { key: "environmentId", label: "Environment ID", hint: "Numeric id of the environment", number: true },
  { key: "environmentKey", label: "Environment key", hint: "Client-side SDK key of the environment" },
  { key: "flagsmithApiUrl", label: "API URL", hint: "Change only if you self-host Flagsmith" },
];

const githubFields: Field[] = [
  { key: "githubRepo", label: "Repository", hint: "owner/name — where the agent opens pull requests" },
  {
    key: "githubToken",
    label: "Fine-grained token",
    hint: "Only this repo · Contents + Pull requests: read & write",
    secret: true,
  },
];

export default function ConnectPage() {
  const router = useRouter();
  const [form, setForm] = useState<Connection>(empty);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const saved = readConnection();
    if (saved) {
      setForm({ ...empty, ...saved });
      setConnected(true);
    }
  }, []);

  function update(field: Field, value: string) {
    setForm((previous) => ({ ...previous, [field.key]: field.number ? Number(value) : value }));
  }

  function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!form.flagsmithToken || !form.projectId || !form.environmentKey) {
      toast.error("Admin API key, project ID and environment key are required");
      return;
    }
    saveConnection(form);
    toast.success("Connected. New runs use your project.");
    router.push("/");
  }

  function disconnect() {
    clearConnection();
    setForm(empty);
    setConnected(false);
    toast("Back to the demo project");
  }

  return (
    <div className="flex flex-1 flex-col">
      <Section width="max-w-3xl" className="px-4 pt-12 pb-8 sm:px-10">
        <Eyebrow className="mb-4">Connect</Eyebrow>
        <Title lead="Your project." rest="Your Flagsmith, your repo." />
        <p className="mt-3 max-w-lg text-muted-foreground">
          Use FlagPilot on your own Flagsmith project and GitHub repo instead of the demo.
        </p>
      </Section>

      <Section width="max-w-3xl" className="px-4 py-8 sm:px-10">
      <div className="mb-8 flex gap-2.5 border bg-card p-3 text-[11.5px] text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-live" />
        <p>
          Keys stay in this browser tab only (session storage) and are sent with each run. The server uses them
          for that run and never saves them. Every change still needs your approval. Create keys just for
          FlagPilot so you can revoke them anytime.
        </p>
      </div>

      <form onSubmit={connect} className="space-y-8">
        <FieldGroup title="Flagsmith" fields={flagsmithFields} form={form} onChange={update} />
        <FieldGroup title="GitHub (optional)" fields={githubFields} form={form} onChange={update} />
        <LlmFields form={form} setForm={setForm} />

        <div className="flex items-center justify-end gap-2">
          {connected && (
            <Button type="button" variant="ghost" onClick={disconnect}>
              Disconnect
            </Button>
          )}
          <Button type="submit">{connected ? "Save" : "Connect"}</Button>
        </div>
      </form>
      </Section>
      <div className="flex-1" />
    </div>
  );
}

function FieldGroup({
  title,
  fields,
  form,
  onChange,
}: {
  title: string;
  fields: Field[];
  form: Connection;
  onChange: (field: Field, value: string) => void;
}) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4">
        <Eyebrow>{title}</Eyebrow>
      </legend>
      {fields.map((field) => (
        <div key={field.key} className="grid gap-1.5">
          <Label htmlFor={field.key} className="text-[12px]">
            {field.label}
          </Label>
          <Input
            id={field.key}
            type={field.secret ? "password" : field.number ? "number" : "text"}
            autoComplete="off"
            value={field.number ? (form[field.key] || "") : String(form[field.key] ?? "")}
            onChange={(event) => onChange(field, event.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">{field.hint}</p>
        </div>
      ))}
    </fieldset>
  );
}

// Optional own LLM key. Without one, FlagPilot's keys are used.
function LlmFields({
  form,
  setForm,
}: {
  form: Connection;
  setForm: React.Dispatch<React.SetStateAction<Connection>>;
}) {
  const provider = llmProviders.find((p) => p.value === form.llmProvider) ?? llmProviders[0];
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4">
        <Eyebrow>AI model (optional)</Eyebrow>
      </legend>
      <div className="grid gap-1.5">
        <Label htmlFor="llmProvider" className="text-[12px]">
          Provider
        </Label>
        <select
          id="llmProvider"
          value={form.llmProvider}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, llmProvider: event.target.value as Connection["llmProvider"] }))
          }
          className="h-8 rounded-[5px] border border-input bg-transparent px-2 text-[13px] outline-none focus-visible:border-ring"
        >
          {llmProviders.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Your key is tried first. If it is rate-limited, FlagPilot falls back to its own models.
        </p>
      </div>
      {form.llmProvider && (
        <div className="grid gap-1.5">
          <Label htmlFor="llmKey" className="text-[12px]">
            API key
          </Label>
          <Input
            id="llmKey"
            type="password"
            autoComplete="off"
            value={form.llmKey}
            onChange={(event) => setForm((previous) => ({ ...previous, llmKey: event.target.value }))}
          />
          <p className="text-[11px] text-muted-foreground">{provider.hint}</p>
        </div>
      )}
    </fieldset>
  );
}
