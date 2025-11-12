import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useAutoFontSize } from "@/hooks/useAutoFontSize";

interface AutoResizeTextProps extends HTMLAttributes<HTMLSpanElement> {
  text: string;
  minSize?: number;
  maxSize?: number;
  step?: number;
  respectHeight?: boolean;
  paddingOffset?: number;
}

export function AutoResizeText({
  text,
  minSize = 14,
  maxSize = 28,
  step = 0.5,
  respectHeight = false,
  paddingOffset = 8,
  className,
  ...rest
}: AutoResizeTextProps) {
  const spanRef = useAutoFontSize<HTMLSpanElement>(text, {
    minSize,
    maxSize,
    step,
    respectHeight,
    paddingOffset,
  });

  return (
    <span
      ref={spanRef}
      className={cn(
        "inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap leading-[1.2]",
        className,
      )}
      {...rest}
    >
      {text}
    </span>
  );
}
