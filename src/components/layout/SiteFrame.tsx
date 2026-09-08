"use client";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
export function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/neutronium" || path.startsWith("/neutronium/"))
    return <main id="main">{children}</main>;
  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6839111786994082"
        crossOrigin="anonymous"
      />
      <Navbar />
      <main id="main" className="pt-16 sm:pt-18">
        {children}
      </main>
      <Footer />
    </>
  );
}
