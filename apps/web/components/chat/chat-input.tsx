"use client";

import { useState } from "react";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// The message box at the bottom of a chat (and on the new-chat page).
export function ChatInput({
  onSend,
  disabled = false,
  placeholder,
  hint,
}: {
  onSend: (text: string) => Promise<unknown>;
  disabled?: boolean;
  placeholder: string;
  hint?: string;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const value = text.trim();
    if (!value || sending || disabled) return;
    setSending(true);
    try {
      await onSend(value);
      setText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send");
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      className="relative rounded-[8px] border border-line-2 bg-card shadow-[0_18px_40px_-28px_rgb(0_0_0/0.35)] focus-within:border-foreground/40"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <Textarea
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            send();
          }
        }}
        placeholder={placeholder}
        className="max-h-48 min-h-20 resize-none border-0 bg-transparent px-3.5 pt-3 pb-10 text-[13px] shadow-none focus-visible:ring-0 md:text-[13px] dark:bg-transparent"
      />
      <div className="absolute right-2 bottom-2 left-3.5 flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] text-muted-foreground">{hint ?? "↵ send · ⇧↵ new line"}</span>
        <Button type="submit" size="icon-sm" disabled={!text.trim() || sending || disabled} aria-label="Send">
          <ArrowUp />
        </Button>
      </div>
    </form>
  );
}
