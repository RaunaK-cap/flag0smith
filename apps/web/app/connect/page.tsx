"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
};

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
      setForm(saved);
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
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <h1 className="mb-1 text-lg font-medium">Connect your project</h1>
      <p className="mb-6 text-muted-foreground">
        Use FlagPilot on your own Flagsmith project and GitHub repo instead of the demo.
      </p>

      <div className="mb-6 flex gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
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

        <div className="flex items-center justify-end gap-2">
          {connected && (
            <Button type="button" variant="ghost" onClick={disconnect}>
              Disconnect
            </Button>
          )}
          <Button type="submit">{connected ? "Save" : "Connect"}</Button>
        </div>
      </form>
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
      <legend className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</legend>
      {fields.map((field) => (
        <div key={field.key} className="grid gap-1.5">
          <Label htmlFor={field.key} className="text-[13px]">
            {field.label}
          </Label>
          <Input
            id={field.key}
            type={field.secret ? "password" : field.number ? "number" : "text"}
            autoComplete="off"
            value={field.number ? (form[field.key] || "") : String(form[field.key] ?? "")}
            onChange={(event) => onChange(field, event.target.value)}
          />
          <p className="text-xs text-muted-foreground">{field.hint}</p>
        </div>
      ))}
    </fieldset>
  );
}
