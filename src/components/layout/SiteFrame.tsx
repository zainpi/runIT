"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

// Current pages render their own header and footer. Only The Last Echo admin keeps the
// original marketing chrome.
const usesLegacyChrome = (path: string) => path === "/the-last-echo/admin" || path.startsWith("/the-last-echo/admin/");

export function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/neutronium" || path.startsWith("/neutronium/"))
    return <main id="main">{children}</main>;
  if (!usesLegacyChrome(path)) return <>{children}</>;
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
