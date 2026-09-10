import type { Metadata } from "next";
import { JoinCompany } from "./join-company";
import "../neutronium.css";
export const metadata: Metadata = {
  title: "Join your company — Neutronium",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <JoinCompany />;
}
