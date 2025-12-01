import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { useAutoFontSize } from "@/hooks/useAutoFontSize";

export default function Navbar() {
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { title, showUserInfo } = usePageHeader();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const desktopNavRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicatorMetrics, setIndicatorMetrics] = useState<{
    width: number;
    left: number;
  } | null>(null);

  const initials = user?.name
    ?.trim()
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase())
    .slice(0, 2)
    .join("") ?? "CV";

  const roleLabel = user?.role === "admin" ? "Administrador" : "Colaborador";
  const titleRef = useAutoFontSize<HTMLHeadingElement>(title, {
    minSize: 13,
    maxSize: 20,
    step: 0.5,
  });
  const userNameRef = useAutoFontSize<HTMLSpanElement>(user?.name ?? "", {
    minSize: 11,
    maxSize: 14,
    step: 0.5,
  });

  const navItems = useMemo(
    () => [
      {
        path: "/",
        label: "Home",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        ),
      },
      {
        path: "/employees",
        label: "Funcionários",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        path: "/sales",
        label: "Vendas",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        path: "/statistics",
        label: "Estatísticas",
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        path: "/admin/audit-logs",
        label: "Logs",
        adminOnly: true,
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l4 4a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
    ],
    [],
  );

  const isActive = (path: string) => {
    if (path === "/") {
      return location === "/";
    }
    return location === path || location.startsWith(`${path}/`);
  };

  useEffect(() => {
    const updateIndicatorPosition = () => {
      const container = desktopNavRef.current;
      if (!container) {
        setIndicatorMetrics(null);
        return;
      }

      const activeIndex = navItems.findIndex((item) => isActive(item.path));
      if (activeIndex === -1) {
        setIndicatorMetrics(null);
        return;
      }

      const activeButton = tabRefs.current[activeIndex];
      if (!activeButton) {
        setIndicatorMetrics(null);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();

      setIndicatorMetrics({
        width: buttonRect.width,
        left: buttonRect.left - containerRect.left,
      });
    };

    updateIndicatorPosition();
    window.addEventListener("resize", updateIndicatorPosition);
    return () => window.removeEventListener("resize", updateIndicatorPosition);
  }, [location, navItems]);

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-emerald-100/60 bg-white/95 backdrop-blur-xl md:bg-white/70 md:backdrop-blur-2xl">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:h-20 sm:gap-4 sm:px-4 md:px-6 lg:px-8">
          <div className="pointer-events-none absolute inset-x-3 -top-20 h-24 rounded-full bg-gradient-to-r from-emerald-200/30 via-cyan-200/20 to-transparent blur-2xl sm:inset-x-6 sm:-top-28 sm:h-32 sm:blur-3xl" />

          <div className="relative flex max-w-[180px] items-center gap-2 sm:max-w-[240px] sm:gap-3 md:max-w-xs lg:max-w-sm">
            <div className="relative h-9 w-9 shrink-0 sm:h-11 sm:w-11">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-md shadow-emerald-500/30 sm:rounded-2xl sm:shadow-lg sm:shadow-emerald-500/40" />
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white sm:h-11 sm:w-11 sm:rounded-2xl">
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h6" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l3 3 6-6" />
                </svg>
              </div>
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-500 sm:text-xs sm:tracking-[0.32em]">Controle</span>
              <h1
                ref={titleRef}
                className="-mt-0.5 overflow-hidden text-ellipsis text-sm font-semibold text-slate-900 sm:-mt-1 sm:text-base"
              >
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {showUserInfo && user && (
              <>
                {/* Avatar compacto para mobile */}
                <div className="flex sm:hidden items-center gap-2">
                  <div className="relative h-8 w-8 shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-md" />
                    <div className="relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white">
                      {initials}
                    </div>
                  </div>
                </div>
                {/* Versão desktop completa */}
                <div className="hidden sm:flex items-center gap-3 rounded-full border border-emerald-100 bg-white/80 px-2 pr-4 shadow-sm">
                  <div className="relative h-10 w-10 flex-shrink-0">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-lg shadow-emerald-500/40" />
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white">
                      {initials}
                    </div>
                    <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-emerald-600 shadow">✔</span>
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span
                      ref={userNameRef}
                      className="overflow-hidden text-ellipsis font-semibold text-slate-900"
                    >
                      {user.name}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-500 whitespace-nowrap">{roleLabel}</span>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-100 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50/80 hover:text-rose-600"
                    title="Sair"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H9m6 4v1a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h5a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-white/90 text-slate-600 shadow-sm transition active:scale-95 active:bg-emerald-50 sm:h-11 sm:w-11 sm:rounded-2xl"
              aria-expanded={mobileMenuOpen}
              aria-label="Abrir menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div
          ref={desktopNavRef}
          className="pointer-events-auto absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-2 overflow-hidden rounded-full border border-emerald-100 bg-white/70 p-1 shadow-inner shadow-emerald-100/60 md:flex"
        >
          {indicatorMetrics && (
            <span
              className="pointer-events-none absolute top-1 bottom-1 rounded-full bg-emerald-500/12 shadow-[0_0_20px_rgba(16,185,129,0.25)] transition-all duration-500 ease-out"
              style={{
                width: `${indicatorMetrics.width}px`,
                left: `${indicatorMetrics.left}px`,
              }}
            />
          )}
          {navItems
            .filter(item => !item.adminOnly || user?.role === 'admin')
            .map((item, index) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  ref={(element) => {
                    tabRefs.current[index] = element;
                  }}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/40"
                    : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-700"
                    }`}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition ${active
                      ? "border-white/40 bg-white/20"
                      : "border-emerald-200 bg-emerald-50 text-emerald-500 group-hover:border-emerald-300"
                      }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  {active && (
                    <span className="absolute -bottom-1 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-white/70" />
                  )}
                  <span
                    className={`absolute inset-0 rounded-full opacity-0 transition duration-500 ease-out group-hover:opacity-100 ${active ? "bg-white/10" : "bg-emerald-100/40"
                      }`}
                    style={{ zIndex: -1 }}
                  />
                </button>
              );
            })}
          <span className="pointer-events-none absolute bottom-0 left-0 right-0 top-0 -z-10" />
        </div>
      </nav>

      {/* Menu Mobile */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-x-0 top-16 origin-top rounded-b-2xl border-t border-emerald-100 bg-white shadow-2xl transition-all duration-200 animate-[slideDown_0.2s_ease-out] sm:top-20 sm:rounded-b-3xl sm:px-4 sm:py-6 px-3 py-4">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-sm font-semibold text-white shadow">
                    {initials}
                  </span>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">{user?.name ?? "Usuário"}</span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-emerald-600">{roleLabel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H9m6 4v1a3 3 0 01-3 3H7a3 3 0 01-3-3V7a3 3 0 013-3h5a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>

              <div className="grid gap-2">
                {navItems
                  .filter(item => !item.adminOnly || user?.role === 'admin')
                  .map((item) => {
                    const active = isActive(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => {
                          navigate(item.path);
                          setMobileMenuOpen(false);
                        }}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-base font-semibold transition ${active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 shadow"
                          : "border-transparent bg-slate-50 text-slate-600 hover:border-emerald-100 hover:bg-emerald-50/70 hover:text-emerald-700"
                          }`}
                      >
                        <span className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-500 shadow-inner">
                            {item.icon}
                          </span>
                          {item.label}
                        </span>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
