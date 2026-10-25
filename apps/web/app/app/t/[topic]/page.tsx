import { notFound } from "next/navigation";
import { MessageList } from "@/components/message-list";
import { TOPIC_RE } from "@/lib/validation";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  if (!TOPIC_RE.test(topic)) notFound();
  return <MessageList topic={topic} />;
}
