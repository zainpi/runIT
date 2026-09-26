"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isPrivateLocation, META_PIXEL_ID, metaTrack } from "@/lib/meta-pixel";

// Loads the Meta Pixel on public store pages only (see src/lib/meta-pixel.ts).
// Automatic events and history-based page views are off, so the pixel only
// reports the events this store sends explicitly.
export function MetaPixel() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => { if (META_PIXEL_ID && !isPrivateLocation(window.location)) setAllowed(true); }, []);
  const firstPath = useRef<string | null>(null);
  // The loader below records the first page view; later client navigations are tracked here.
  useEffect(() => {
    if (!allowed) return;
    if (firstPath.current === null) { firstPath.current = pathname; return; }
    metaTrack("PageView");
  }, [allowed, pathname]);
  if (!META_PIXEL_ID || !allowed) return null;
  return <Script id="meta-pixel" strategy="afterInteractive">{`
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq.disablePushState=true;
fbq('set','autoConfig',false,'${META_PIXEL_ID}');
fbq('init','${META_PIXEL_ID}');
fbq('track','PageView');
(window.__metaPending||[]).forEach(function(a){fbq('track',a[0],a[1])});window.__metaPending=[];
`}</Script>;
}
