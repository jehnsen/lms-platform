import type { Metadata } from "next";
import { ForumList } from "@/components/forum-view";

export const metadata: Metadata = { title: "Discussions" };

export default function Page() {
  return <ForumList />;
}
