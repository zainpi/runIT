import type { Metadata } from "next";
import { TemplateTrial } from "./trial";
export const metadata: Metadata = { title: "Your free template trial", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function TrialPage() { return <TemplateTrial />; }
