import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — PROJECT_IDLE",
  robots: { index: false, follow: false },
};

// Pass-through: /admin/login renders bare; the (dashboard) route group
// carries the auth-checked shell.
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
