// Neutronium keeps its own dark browser theme colour and icon (./icon.svg) rather than the runsOS company look.
export const viewport = { themeColor: "#05060a" };

export default function NeutroniumLayout({ children }: { children: React.ReactNode }) {
  return children;
}
