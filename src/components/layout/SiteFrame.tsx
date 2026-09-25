"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/neutronium" || path.startsWith("/neutronium/"))
    return <main id="main">{children}</main>;
  // runsOS pages draw their own menu bar and taskbar; only The Last Echo admin keeps the legacy frame.
  if (!(path === "/the-last-echo/admin" || path.startsWith("/the-last-echo/admin/")))
    return <>{children}</>;
  return (
    <>
      <Navbar />
      <main id="main" className="pt-16 sm:pt-18">
        {children}
      </main>
      <Footer />
    </>
  );
}
