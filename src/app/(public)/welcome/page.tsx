import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: { absolute: "3rdLoopLearning — AI-powered learning" },
};

/** The public homepage. `src/proxy.ts` also shows it at `/` to anyone not signed in. */
export default function WelcomePage() {
  return <LandingPage />;
}
