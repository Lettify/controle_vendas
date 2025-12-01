import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface SensitiveValueProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  initiallyVisible?: boolean;
  revealLabel?: string;
  hideLabel?: string;
  allowWrap?: boolean;
  fullWidth?: boolean;
}

interface SensitiveSectionContextValue {
  isVisible: boolean;
  toggle: () => void;
  show: () => void;
  hide: () => void;
}

const SensitiveSectionContext = createContext<SensitiveSectionContextValue | null>(null);

function useOptionalSensitiveSection() {
  return useContext(SensitiveSectionContext);
}

export function SensitiveSection({
  children,
  defaultVisible = false,
}: {
  children: ReactNode;
  defaultVisible?: boolean;
}) {
  const [isVisible, setIsVisible] = useState(defaultVisible);

  const toggle = useCallback(() => setIsVisible(prev => !prev), []);
  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);

  const value = useMemo(
    () => ({ isVisible, toggle, show, hide }),
    [hide, isVisible, show, toggle],
  );

  return (
    <SensitiveSectionContext.Provider value={value}>
      {children}
    </SensitiveSectionContext.Provider>
  );
}

export function useSensitiveSection() {
  const context = useContext(SensitiveSectionContext);

  if (!context) {
    throw new Error("useSensitiveSection must be used within a SensitiveSection");
  }

  return context;
}

export function SensitiveSectionToggleButton({
  className,
  revealLabel = "Mostrar valores",
  hideLabel = "Ocultar valores",
  showLabel = true,
}: {
  className?: string;
  revealLabel?: string;
  hideLabel?: string;
  showLabel?: boolean;
}) {
  const { isVisible, toggle } = useSensitiveSection();
  const label = isVisible ? hideLabel : revealLabel;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2",
        className,
      )}
      aria-pressed={isVisible}
      aria-label={label}
      title={label}
    >
      {isVisible ? (
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {showLabel && <span>{label}</span>}
    </button>
  );
}

/**
 * Renders monetary (or otherwise sensitive) values blurred by default.
 * Clicking the value toggles between masked and revealed states.
 */
export function SensitiveValue({
  children,
  className,
  containerClassName,
  initiallyVisible = false,
  revealLabel = "Mostrar",
  hideLabel = "Ocultar",
  allowWrap = false,
  fullWidth = false,
}: SensitiveValueProps) {
  const section = useOptionalSensitiveSection();
  const [localVisible, setLocalVisible] = useState(initiallyVisible);
  const toggleLocalVisibility = useCallback(() => setLocalVisible(current => !current), []);

  const isVisible = section ? section.isVisible : localVisible;
  const toggleVisibility = section ? section.toggle : toggleLocalVisibility;
  const label = isVisible ? hideLabel : revealLabel;

  const containerLayout = fullWidth
    ? "flex w-full items-start justify-start"
    : allowWrap
      ? "inline-flex items-start"
      : "inline-flex items-baseline";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggleVisibility();
      }}
      className={cn(
        "group rounded-sm bg-transparent p-0 m-0 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500/70",
        containerLayout,
        allowWrap ? "whitespace-normal break-words" : "whitespace-nowrap",
        containerClassName,
      )}
      aria-pressed={isVisible}
      aria-label={label}
      title={label}
    >
      <span
        className={cn(
          "relative transition-all duration-200 leading-[1.2] text-left",
          fullWidth ? "block w-full" : "inline-block",
          isVisible ? "blur-0 opacity-100" : "blur-lg opacity-85 select-none",
          className,
        )}
      >
        {children}
        {!isVisible && (
          <span className="pointer-events-none absolute inset-[-2px] -z-10 rounded-sm border border-slate-200/80 bg-slate-100/60 shadow-inner" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
