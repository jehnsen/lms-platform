import type { Metadata } from "next";
import { MessagesView } from "@/components/messages-view";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return <MessagesView />;
}
