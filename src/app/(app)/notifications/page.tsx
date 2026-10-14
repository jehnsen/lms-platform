import type { Metadata } from "next";
import { NotificationCentre } from "@/components/notification-centre";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return <NotificationCentre />;
}
