import type { Metadata } from "next";
import { Neutronium } from "./workspace";
import "./neutronium.css";
export const metadata: Metadata = {
  title: "Neutronium — Your people. Their access. Under control.",
  description:
    "A simpler workspace for company IT. Manage onboarding, employee access, and offboarding in one place.",
  alternates: { canonical: "/neutronium" },
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Neutronium />;
}
