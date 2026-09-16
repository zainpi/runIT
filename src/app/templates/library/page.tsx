import type { Metadata } from "next";
import { TemplateLibrary } from "./library";
export const metadata: Metadata = { title: "My templates", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function LibraryPage() { return <TemplateLibrary />; }
