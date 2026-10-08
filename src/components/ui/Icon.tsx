import type { ComponentProps } from "react";

type IconName = "plus" | "trash" | "copy" | "drag" | "arrow" | "eye" | "chevron";

const paths: Record<IconName, string> = {
  plus: "M12 5v14M5 12h14",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  copy: "M9 9h10v11H9zM5 15H4V4h11v1",
  drag: "M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01",
  arrow: "M5 12h14M13 6l6 6-6 6",
  eye: "M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  chevron: "m7 10 5 5 5-5"
};

export function Icon({ name, ...props }: { name: IconName } & ComponentProps<"svg">) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}><path d={paths[name]} /></svg>;
}
