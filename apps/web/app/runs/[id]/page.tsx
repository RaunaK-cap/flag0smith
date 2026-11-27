import { Suspense } from "react";
import { ChatScreen } from "@/components/chat/chat-screen";

// Next.js 16: reading params is dynamic, so it happens inside Suspense.
export default function RunPage({ params }: PageProps<"/runs/[id]">) {
  return (
    <Suspense fallback={null}>
      <RunLoader params={params} />
    </Suspense>
  );
}

async function RunLoader({ params }: { params: PageProps<"/runs/[id]">["params"] }) {
  const { id } = await params;
  return <ChatScreen id={id} />;
}
