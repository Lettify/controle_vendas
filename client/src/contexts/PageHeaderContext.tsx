import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface PageHeaderContextValue {
  title: string;
  setTitle: (value: string) => void;
  showUserInfo: boolean;
  setShowUserInfo: (value: boolean) => void;
}

const DEFAULT_TITLE = "Controle de Vendas";

const PageHeaderContext = createContext<PageHeaderContextValue | undefined>(undefined);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [showUserInfo, setShowUserInfo] = useState(true);

  const value = useMemo(
    () => ({
      title,
      setTitle,
      showUserInfo,
      setShowUserInfo,
    }),
    [title, showUserInfo],
  );

  return <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>;
}

export function usePageHeader() {
  const context = useContext(PageHeaderContext);
  if (!context) {
    throw new Error("usePageHeader must be used within a PageHeaderProvider");
  }
  return context;
}

export function resetPageHeaderDefaults({
  setTitle,
  setShowUserInfo,
}: Pick<PageHeaderContextValue, "setTitle" | "setShowUserInfo">) {
  setTitle(DEFAULT_TITLE);
  setShowUserInfo(true);
}
