import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import os from "./os.module.css";

type WindowProps = {
  title: string;
  /** Title-bar colour. */
  tone?: string;
  /** Short text shown at the right of the title bar. */
  meta?: ReactNode;
  /** Renders a working close button when provided. */
  onClose?: () => void;
  titleBarProps?: HTMLAttributes<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  as?: "section" | "div" | "article";
  id?: string;
  labelledBy?: string;
  children: ReactNode;
};

/** An ink-outlined runsOS window with a coloured title bar. */
export function Window({ title, tone, meta, onClose, titleBarProps, className, style, as: Tag = "section", id, labelledBy, children }: WindowProps) {
  // Only landmark-capable elements get an accessible name; a plain div stays generic.
  const labelProps = Tag === "div" ? {} : labelledBy ? { "aria-labelledby": labelledBy } : { "aria-label": title };
  return (
    <Tag
      id={id}
      className={className ? `${os.window} ${className}` : os.window}
      style={{ ...(tone ? { "--tone": tone } : {}), ...style } as CSSProperties}
      {...labelProps}
    >
      <div {...titleBarProps} className={titleBarProps?.className ? `${os.titleBar} ${titleBarProps.className}` : os.titleBar}>
        <span className={os.titleControls}>
          {onClose ? (
            <button type="button" className={os.closeButton} onClick={onClose} aria-label={`Close ${title}`}>×</button>
          ) : (
            <span className={os.control} aria-hidden="true" />
          )}
          <span className={os.control} aria-hidden="true" />
          <span className={os.control} aria-hidden="true" />
        </span>
        <span className={os.title}>{title}</span>
        {meta ? <span className={os.titleMeta}>{meta}</span> : <span className={os.titleSpacer} aria-hidden="true" />}
      </div>
      {children}
    </Tag>
  );
}
