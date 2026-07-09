import type { Metadata } from "next";
import "./theme.css";

export const metadata: Metadata = {
  title: "Admin — The Last Echo : Idle RPG",
  robots: { index: false, follow: false },
};

// Wraps both /ancient-horizon/admin/login and the (dashboard) group in the
// The Last Echo : Idle RPG parchment theme.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="ah-admin">{children}</div>;
}
