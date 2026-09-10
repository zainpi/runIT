"use client";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { founders } from "@/lib/company";
export function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === "/" || founders.some((founder) => path === founder.portfolioUrl || path === `/${founder.slug}`))
    return <>{children}</>;
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
