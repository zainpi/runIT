import { desktopApps, founderCards } from "@/components/runsos/apps";
import { ogContentType, ogSize, osPreview } from "@/components/runsos/og";

export const alt = "A runsIT co-founder’s portfolio";
export const size = ogSize;
export const contentType = ogContentType;

export function generateStaticParams() {
  return founderCards.map((founder) => ({ founder: founder.slug }));
}

export default async function OgImage({ params }: { params: Promise<{ founder: string }> }) {
  const { founder: slug } = await params;
  const founder = founderCards.find((person) => person.slug === slug) ?? founderCards[0];
  return osPreview({
    title: `${founder.slug}.profile`,
    tone: founder.tone,
    chips: desktopApps.map((app) => ({ label: app.name, tone: app.tone })),
    children: (
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 190, height: 190, border: "5px solid #1b1a17", borderRadius: 999, background: founder.tone, fontSize: 80, fontWeight: 800, letterSpacing: -4 }}>{founder.initials}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#5e594f" }}>{founder.role} at runsIT</div>
          <div style={{ display: "flex", fontSize: 80, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>{founder.name}</div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: "#3d3a33" }}>Building apps, games and business software in Canada.</div>
        </div>
      </div>
    ),
  });
}
