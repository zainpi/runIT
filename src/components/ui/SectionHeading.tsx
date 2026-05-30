import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

type SectionHeadingProps = {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  const alignment =
    align === "center"
      ? "mx-auto max-w-2xl text-center items-center"
      : "max-w-2xl text-left items-start";

  return (
    <Reveal
      className={["flex flex-col gap-4", alignment, className]
        .filter(Boolean)
        .join(" ")}
    >
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.7rem] md:leading-[1.1]">
        {title}
      </h2>
      {description && (
        <p className="text-base leading-relaxed text-slate-400 sm:text-lg">
          {description}
        </p>
      )}
    </Reveal>
  );
}
