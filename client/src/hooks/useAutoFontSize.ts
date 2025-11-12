import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

interface AutoFontSizeOptions {
  minSize?: number;
  maxSize?: number;
  step?: number;
  respectHeight?: boolean;
  paddingOffset?: number;
}

/**
 * Ajusta dinamicamente o tamanho da fonte para caber no container pai sem quebrar linha.
 * Útil para textos dinâmicos (ex: nomes de usuários) que não podem ultrapassar o layout.
 */
export function useAutoFontSize<T extends HTMLElement>(
  content: string,
  options: AutoFontSizeOptions = {},
) {
  const {
    minSize = 12,
    maxSize = 18,
    step = 0.5,
    respectHeight = false,
    paddingOffset = 6,
  } = options;
  const elementRef = useRef<T | null>(null);

  const adjustFontSize = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    const container = element.parentElement;
    if (!container) return;

    const containerWidth = Math.max(0, container.clientWidth - paddingOffset);
    const containerHeight = respectHeight
      ? Math.max(0, container.clientHeight - paddingOffset)
      : Number.POSITIVE_INFINITY;

    if (containerWidth <= 0) {
      return;
    }

    element.style.transform = "scale(1)";
    element.style.transformOrigin = "left center";
    element.style.fontSize = `${maxSize}px`;
    element.style.whiteSpace = "nowrap";
    element.style.maxWidth = "100%";

    let currentSize = maxSize;
    let guard = 0;

    const isOverflowing = () => {
      const widthOverflow = element.scrollWidth > containerWidth + 0.5;
      const heightOverflow = respectHeight && containerHeight !== Number.POSITIVE_INFINITY
        ? element.scrollHeight > containerHeight + 0.5
        : false;
      return widthOverflow || heightOverflow;
    };

    while (currentSize > minSize && isOverflowing() && guard < 100) {
      currentSize = Math.max(minSize, currentSize - step);
      element.style.fontSize = `${currentSize}px`;
      guard += 1;
    }
  }, [maxSize, minSize, respectHeight, step]);

  useLayoutEffect(() => {
    adjustFontSize();
  }, [adjustFontSize, content]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const element = elementRef.current;
    if (!element) return;

    const container = element.parentElement;
    const observer = new ResizeObserver(() => adjustFontSize());
    observer.observe(element);
    if (container) {
      observer.observe(container);
    }

    return () => {
      observer.disconnect();
    };
  }, [adjustFontSize]);

  return elementRef;
}
