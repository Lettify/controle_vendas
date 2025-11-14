import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import type { DailySaleRecord, EmployeeRecord } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  SensitiveSection,
  SensitiveSectionToggleButton,
  SensitiveValue,
} from "@/components/SensitiveValue";
import { useLocation, useRoute } from "wouter";
import { usePageHeader } from "@/contexts/PageHeaderContext";

function formatDateWithoutTimezone(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  return parts
    .map((segment) => segment[0]!)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type ViewMode = "list" | "grid" | "compact";
type SortMode = "date-desc" | "date-asc" | "value-desc" | "value-asc";

type EmployeeEntity = EmployeeRecord;
type SalesList = DailySaleRecord[];
type SaleEntity = DailySaleRecord;
type SalesByDayBucket = { count: number; total: number; sales: SaleEntity[] };
type SalesByDayMap = Record<string, SalesByDayBucket>;

interface FeedbackState {
  type: "success" | "error";
  message: string;
}

export default function EmployeeDetails() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/employees/:id");
  const employeeId = params?.id ?? "";
  const { setTitle, setShowUserInfo } = usePageHeader();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [employeeId]);

  useEffect(() => {
    setShowUserInfo(true);
  }, [setShowUserInfo]);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortMode, setSortMode] = useState<SortMode>("date-desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [minValue, setMinValue] = useState<string>("");
  const [maxValue, setMaxValue] = useState<string>("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const employeeQuery = trpc.employees.get.useQuery(
    { id: employeeId },
    {
      enabled: !!employeeId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    },
  );

  const monthSalesQuery = trpc.sales.getTotalByEmployeeInMonth.useQuery(
    {
      employeeId,
      year: selectedYear,
      month: selectedMonth,
    },
    {
      enabled: !!employeeId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    },
  );

  const startDate =
    selectedDate ||
    `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;

  const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const endDate =
    selectedDate ||
    `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(
      lastDayOfMonth,
    ).padStart(2, "0")}`;

  const salesQuery = trpc.sales.getByEmployee.useQuery(
    {
      employeeId,
      startDate,
      endDate,
    },
    {
      enabled: !!employeeId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      staleTime: 0,
    },
  );

  const salesList: SalesList = (salesQuery.data as SalesList | undefined) ?? [];

  useEffect(() => {
    if (!employeeId) {
      setTitle("Erro");
      return;
    }

    if (employeeQuery.isLoading) {
      setTitle("Carregando colaborador...");
      return;
    }

    if (employeeQuery.isError) {
      setTitle("Erro ao carregar colaborador");
      return;
    }

    const employeeName = employeeQuery.data?.name;
    if (employeeName) {
      setTitle(employeeName);
      return;
    }

    if (employeeQuery.isFetched && !employeeQuery.data) {
      setTitle("Colaborador não encontrado");
      return;
    }

    setTitle("Detalhes do colaborador");
  }, [employeeId, employeeQuery.data, employeeQuery.isError, employeeQuery.isFetched, employeeQuery.isLoading, setTitle]);

  const totalSales = useMemo(() => {
    if (selectedDate) {
      return salesList.reduce<number>(
        (sum, sale: SaleEntity) => sum + parseFloat(sale.amount ?? "0"),
        0,
      );
    }

    if (monthSalesQuery.data !== undefined && monthSalesQuery.data !== null) {
      return monthSalesQuery.data;
    }

    return salesList.reduce<number>(
      (sum, sale: SaleEntity) => sum + parseFloat(sale.amount ?? "0"),
      0,
    );
  }, [selectedDate, salesList, monthSalesQuery.data]);

  const salesByDay = useMemo(() => {
    if (!salesList.length) return {} as SalesByDayMap;
    return salesList.reduce<SalesByDayMap>((acc, sale: SaleEntity) => {
      if (!sale?.date) return acc;
      const date = sale.date.split("T")[0];
      if (!acc[date]) {
        acc[date] = { count: 0, total: 0, sales: [] as SaleEntity[] };
      }

      acc[date].count += 1;
      acc[date].total += parseFloat(sale.amount ?? "0");
      acc[date].sales.push(sale);
      return acc;
    }, {} as SalesByDayMap);
  }, [salesList]);

  const bestDay = useMemo(() => {
    const entries = Object.entries(salesByDay) as Array<[string, SalesByDayBucket]>;
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1].total - a[1].total)[0];
  }, [salesByDay]);

  const filteredAndSortedSales = useMemo(() => {
    let filtered: SaleEntity[] = [...salesList];

    if (searchTerm) {
      filtered = filtered.filter((sale) => {
        const dateFormatted = formatDateWithoutTimezone(
          sale.date.split("T")[0],
        );
        return dateFormatted.includes(searchTerm);
      });
    }

    if (minValue) {
      const min = parseFloat(minValue);
      if (!Number.isNaN(min)) {
        filtered = filtered.filter(
          (sale) => parseFloat(sale.amount) >= min,
        );
      }
    }

    if (maxValue) {
      const max = parseFloat(maxValue);
      if (!Number.isNaN(max)) {
        filtered = filtered.filter(
          (sale) => parseFloat(sale.amount) <= max,
        );
      }
    }

    filtered.sort((a, b) => {
      switch (sortMode) {
        case "date-asc":
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "date-desc":
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "value-asc":
          return parseFloat(a.amount) - parseFloat(b.amount);
        case "value-desc":
          return parseFloat(b.amount) - parseFloat(a.amount);
        default:
          return 0;
      }
    });

    return filtered;
  }, [salesList, searchTerm, minValue, maxValue, sortMode]);

  const topDays = useMemo(() => {
    const entries = Object.entries(salesByDay) as Array<[string, SalesByDayBucket]>;
    return entries.sort((a, b) => b[1].total - a[1].total).slice(0, 3);
  }, [salesByDay]);

  if (!user) {
    navigate("/login");
    return null;
  }

  if (!employeeId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <Card className="border border-rose-200/50 bg-white/95 shadow-2xl">
            <CardContent className="space-y-4 p-10 text-center">
              <h3 className="text-2xl font-bold text-slate-900">
                ID do funcionário não fornecido
              </h3>
              <p className="text-sm text-slate-500">
                Não foi possível identificar o colaborador solicitado.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => navigate("/employees")}>
                  Voltar para Funcionários
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (
    employeeQuery.isLoading ||
    salesQuery.isLoading ||
    monthSalesQuery.isLoading
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <main className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="flex flex-col items-center gap-4 text-white/80">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-sm font-semibold tracking-wide">
              Carregando informações do colaborador...
            </p>
          </div>
        </main>
      </div>
    );
  }

  const employeeData = employeeQuery.data as EmployeeEntity | null | undefined;

  if (!employeeData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
          <Card className="border border-rose-200/50 bg-white/95 shadow-2xl">
            <CardContent className="space-y-4 p-10 text-center">
              <h3 className="text-2xl font-bold text-slate-900">
                Funcionário não localizado
              </h3>
              <p className="text-sm text-slate-500">
                O colaborador solicitado pode ter sido removido ou não existe.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => navigate("/employees")}>
                  Ver equipe completa
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const employee = employeeData;
  const salesCount = salesList.length;
  const avgSale = salesCount > 0 ? totalSales / salesCount : 0;
  const daysWithSales = Object.keys(salesByDay).length;

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const selectedMonthName = monthNames[selectedMonth - 1] ?? "";
  const periodLabel = selectedDate
    ? `Dia ${formatDateWithoutTimezone(selectedDate)}`
    : `${selectedMonthName} / ${selectedYear}`;

  const latestSale = filteredAndSortedSales[0] ?? null;
  const sanitizedPhone = (employee.phone ?? "").replace(/\D/g, "") || undefined;
  const firstName = employee.name.trim().split(" ")[0] || employee.name;

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: "date-desc", label: "Mais recentes" },
    { key: "date-asc", label: "Mais antigas" },
    { key: "value-desc", label: "Maior valor" },
    { key: "value-asc", label: "Menor valor" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        {feedback && (
          <div
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
              feedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {feedback.type === "success" ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              )}
            </svg>
            <span>{feedback.message}</span>
          </div>
        )}

        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 text-white shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.35),transparent_55%)]" />
          <div className="absolute -bottom-32 -left-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative p-8 sm:p-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="border-white/40 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/60"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Voltar
                </Button>
                <Button
                  onClick={() => setIsEditOpen(true)}
                  className="bg-white text-indigo-700 hover:bg-white/90 focus-visible:ring-white/70"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Editar colaborador
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => navigate(`/sales?employee=${employee.id}`)}
                  className="bg-white/10 px-4 text-white hover:bg-white/20 focus-visible:ring-white/60"
                >
                  <svg
                    className="mr-2 h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Registrar venda
                </Button>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">
                {periodLabel}
              </p>
            </div>

            <div className="mt-10 flex flex-col gap-10 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex max-w-3xl flex-col gap-6">
                <div className="flex items-start gap-5">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-3xl bg-white/10 blur-lg" />
                    <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 text-3xl font-bold uppercase tracking-tight backdrop-blur">
                      {getInitials(employee.name)}
                    </div>
                    {employee.isActive && (
                      <span className="absolute -bottom-1 -right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white ring-2 ring-indigo-800/80">
                        ✔
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80">
                      Perfil do colaborador
                    </span>
                    <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">
                      {employee.name}
                    </h1>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          employee.isActive
                            ? "bg-emerald-100/90 text-emerald-800"
                            : "bg-white/20 text-white"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            employee.isActive ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                        />
                        {employee.isActive ? "Disponível" : "Inativo"}
                      </span>
                      {employee.position && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {employee.position}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {periodLabel}
                      </span>
                    </div>
                    <p className="mt-6 max-w-2xl text-sm text-white/75">
                      {selectedDate
                        ? `Resumo das vendas registradas em ${formatDateWithoutTimezone(
                            selectedDate,
                          )}. Ajuste os filtros abaixo para investigar os detalhes desse dia.`
                        : `Acompanhe a performance de ${firstName} em ${selectedMonthName}. Use os painéis abaixo para identificar oportunidades, celebrar conquistas e alinhar os próximos passos.`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {employee.email && (
                    <a
                      href={`mailto:${employee.email}`}
                      className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {employee.email}
                    </a>
                  )}
                  {employee.phone && (
                    <a
                      href={sanitizedPhone ? `https://wa.me/${sanitizedPhone}` : `tel:${employee.phone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {employee.phone}
                    </a>
                  )}
                </div>
              </div>

              <SensitiveSection>
                <div className="w-full rounded-2xl border border-white/20 bg-white/10 p-6 shadow-lg backdrop-blur xl:max-w-md">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">
                        Saúde financeira
                      </p>
                      <span className="text-[11px] font-medium text-white/60">
                        Valores variam com os filtros ativos
                      </span>
                    </div>
                    <SensitiveSectionToggleButton className="border-white/40 bg-white/20 text-white hover:bg-white/30" />
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                        Faturamento
                      </p>
                      <p className="mt-3 text-2xl font-bold">
                        <SensitiveValue className="text-white" containerClassName="justify-start">
                          {formatCurrency(totalSales)}
                        </SensitiveValue>
                      </p>
                      <p className="mt-2 text-xs text-white/70">
                        Período {periodLabel}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                        Ticket médio
                      </p>
                      <p className="mt-3 text-2xl font-bold">
                        <SensitiveValue className="text-white" containerClassName="justify-start">
                          {formatCurrency(avgSale || 0)}
                        </SensitiveValue>
                      </p>
                      <p className="mt-2 text-xs text-white/70">
                        {salesCount} venda{salesCount === 1 ? "" : "s"} no período
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                        Vendas registradas
                      </p>
                      <p className="mt-3 text-3xl font-black text-white">{salesCount}</p>
                      <p className="mt-2 text-xs text-white/70">Dias ativos: {daysWithSales || 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                        Melhor dia
                      </p>
                      {bestDay ? (
                        <>
                          <p className="mt-3 text-sm font-semibold text-white">
                            {formatDateWithoutTimezone(bestDay[0])}
                          </p>
                          <p className="mt-2 text-lg font-bold text-white">
                            <SensitiveValue className="text-white" containerClassName="justify-start">
                              {formatCurrency(bestDay[1].total)}
                            </SensitiveValue>
                          </p>
                        </>
                      ) : (
                        <p className="mt-3 text-sm text-white/70">Sem vendas registradas ainda.</p>
                      )}
                    </div>
                  </div>
                </div>
              </SensitiveSection>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <SensitiveSection>
            <Card className="border-0 bg-white/95 shadow-2xl backdrop-blur">
              <CardContent className="space-y-6 p-6 sm:p-8">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Fluxo de vendas</h2>
                    <p className="text-sm text-slate-500">
                      Ajuste filtros, compare períodos e investigue cada venda registrada.
                    </p>
                  </div>
                  <SensitiveSectionToggleButton className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mês</label>
                    <select
                      value={selectedMonth}
                      onChange={(event) => {
                        setSelectedMonth(Number(event.target.value));
                        setSelectedDate("");
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    >
                      {monthNames.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ano</label>
                    <select
                      value={selectedYear}
                      onChange={(event) => {
                        setSelectedYear(Number(event.target.value));
                        setSelectedDate("");
                      }}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                    >
                      {[2023, 2024, 2025, 2026].map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dia específico</label>
                    <div className="mt-2 flex gap-3">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(event) => setSelectedDate(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                      />
                      {selectedDate && (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedDate("")}
                          className="h-12 w-12 flex-shrink-0 rounded-xl border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                          title="Limpar dia selecionado"
                        >
                          <span className="text-base leading-none">✕</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-3">
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Buscar por data
                      </label>
                      <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/60">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          placeholder="Ex: 10/11 ou 2025"
                          className="w-full border-0 bg-transparent text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor mínimo</label>
                      <input
                        type="number"
                        placeholder="0,00"
                        value={minValue}
                        onChange={(event) => setMinValue(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor máximo</label>
                      <input
                        type="number"
                        placeholder="9999,00"
                        value={maxValue}
                        onChange={(event) => setMaxValue(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
                      />
                    </div>
                    {(searchTerm || minValue || maxValue) && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSearchTerm("");
                          setMinValue("");
                          setMaxValue("");
                        }}
                        className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Resumo rápido
                    </p>
                    <div className="mt-3 space-y-3 text-sm">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Período ativo</span>
                        <span className="font-semibold text-slate-900">{periodLabel}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Vendas exibidas</span>
                        <span className="font-semibold text-slate-900">{filteredAndSortedSales.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Ticket médio filtrado</span>
                        <span className="font-semibold text-slate-900">
                          {filteredAndSortedSales.length > 0
                            ? formatCurrency(
                                filteredAndSortedSales.reduce<number>(
                                  (sum, sale: SaleEntity) => sum + parseFloat(sale.amount),
                                  0,
                                ) / filteredAndSortedSales.length,
                              )
                            : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    <span>Ordenar por:</span>
                    <div className="flex flex-wrap gap-2">
                      {sortOptions.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => setSortMode(option.key)}
                          className={`rounded-full px-3 py-1.5 transition ${
                            sortMode === option.key
                              ? "bg-indigo-100 text-indigo-700 shadow-sm"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Visualização
                    </span>
                    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
                      <button
                        onClick={() => setViewMode("list")}
                        className={`min-w-[110px] rounded-full px-4 py-1.5 text-center text-xs font-semibold transition ${
                          viewMode === "list"
                            ? "bg-indigo-500 text-white shadow"
                            : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                      >
                        Linha do tempo
                      </button>
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`min-w-[110px] rounded-full px-4 py-1.5 text-center text-xs font-semibold transition ${
                          viewMode === "grid"
                            ? "bg-indigo-500 text-white shadow"
                            : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                      >
                        Blocos
                      </button>
                      <button
                        onClick={() => setViewMode("compact")}
                        className={`min-w-[110px] rounded-full px-4 py-1.5 text-center text-xs font-semibold transition ${
                          viewMode === "compact"
                            ? "bg-indigo-500 text-white shadow"
                            : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
                        }`}
                      >
                        Tabela
                      </button>
                    </div>
                  </div>
                </div>

                {filteredAndSortedSales.length > 0 ? (
                  <>
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 text-sm text-indigo-800">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                            Panorama do filtro
                          </p>
                          <p className="text-sm font-semibold">
                            {filteredAndSortedSales.length === salesList.length
                              ? "Exibindo todo o período selecionado."
                              : `${filteredAndSortedSales.length} de ${salesList.length} vendas correspondem aos filtros.`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                            Ticket médio exibido
                          </p>
                          <SensitiveValue className="text-base font-bold text-indigo-700" containerClassName="justify-end">
                            {formatCurrency(
                              filteredAndSortedSales.reduce<number>(
                                (sum, sale: SaleEntity) => sum + parseFloat(sale.amount),
                                0,
                              ) / filteredAndSortedSales.length,
                            )}
                          </SensitiveValue>
                        </div>
                      </div>
                    </div>

                    {viewMode === "list" && (
                      <div className="relative pl-6">
                        <span className="absolute left-2 top-1 bottom-1 w-px bg-slate-200" />
                        <div className="space-y-4">
                          {filteredAndSortedSales.map((sale, index) => (
                            <div
                              key={sale.id}
                              className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                            >
                              <span className="absolute -left-[11px] top-5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                                {index + 1}
                              </span>
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Valor registrado
                                  </p>
                                  <SensitiveValue className="text-2xl font-bold text-slate-900" containerClassName="justify-start">
                                    {formatCurrency(parseFloat(sale.amount))}
                                  </SensitiveValue>
                                  <p className="mt-2 ml-2 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600">
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    {formatDateWithoutTimezone(sale.date.split("T")[0])}
                                  </p>
                                </div>
                                <div className="rounded-xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                                  <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                                    Id da venda
                                  </span>
                                  <span className="text-slate-700">{sale.id.slice(0, 8)}...</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {viewMode === "grid" && (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredAndSortedSales.map((sale, index) => (
                          <div
                            key={sale.id}
                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-lg"
                          >
                            <div className="flex items-start justify-between">
                              <div className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                                #{index + 1}
                              </div>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                {formatDateWithoutTimezone(sale.date.split("T")[0])}
                              </span>
                            </div>
                            <div className="mt-4">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Valor
                              </p>
                              <SensitiveValue className="text-2xl font-black text-slate-900" containerClassName="justify-start">
                                {formatCurrency(parseFloat(sale.amount))}
                              </SensitiveValue>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {viewMode === "compact" && (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3 text-left">#</th>
                              <th className="px-4 py-3 text-left">Data</th>
                              <th className="px-4 py-3 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
                            {filteredAndSortedSales.map((sale, index) => (
                              <tr key={sale.id} className="hover:bg-indigo-50/40">
                                <td className="px-4 py-3 font-semibold text-indigo-600">{index + 1}</td>
                                <td className="px-4 py-3">{formatDateWithoutTimezone(sale.date.split("T")[0])}</td>
                                <td className="px-4 py-3 text-right">
                                  <SensitiveValue className="font-semibold text-slate-900" containerClassName="justify-end">
                                    {formatCurrency(parseFloat(sale.amount))}
                                  </SensitiveValue>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white shadow">
                      <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A2 2 0 013 15.447V5.553a2 2 0 011.553-1.947L9 2m6 0l5.447 1.606A2 2 0 0121 5.553v9.894a2 2 0 01-1.553 1.947L15 20m-6 0v-8m6 8v-8m0-4a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h3 className="mt-6 text-lg font-semibold text-slate-700">Nenhuma venda encontrada</h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Ajuste os filtros ou registre novas vendas para acompanhar os resultados por aqui.
                    </p>
                    {(searchTerm || minValue || maxValue) && (
                      <Button
                        className="mt-6 rounded-full bg-indigo-600 px-6 text-white hover:bg-indigo-700"
                        onClick={() => {
                          setSearchTerm("");
                          setMinValue("");
                          setMaxValue("");
                        }}
                      >
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </SensitiveSection>

          <div className="space-y-6">
            <SensitiveSection>
              <Card className="border-0 bg-white shadow-xl">
                <CardContent className="space-y-5 p-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">Insights rápidos</h3>
                    <SensitiveSectionToggleButton className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" />
                  </div>
                  <div className="space-y-4 text-sm">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Última venda
                      </p>
                      {latestSale ? (
                        <div className="mt-2">
                          <SensitiveValue className="text-lg font-bold text-slate-900" containerClassName="justify-start">
                            {formatCurrency(parseFloat(latestSale.amount))}
                          </SensitiveValue>
                          <p className="text-xs text-slate-500">
                            {formatDateWithoutTimezone(latestSale.date.split("T")[0])}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">Nenhuma venda registrada ainda neste recorte.</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Dias com maior faturamento
                      </p>
                      <ul className="mt-3 space-y-2">
                        {topDays.length > 0 ? (
                          topDays.map(([day, data]) => (
                            <li key={day} className="flex items-center justify-between text-xs text-slate-600">
                              <span className="font-semibold text-slate-700">{formatDateWithoutTimezone(day)}</span>
                              <SensitiveValue className="text-sm font-semibold text-slate-900" containerClassName="justify-end">
                                {formatCurrency(data.total)}
                              </SensitiveValue>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-slate-500">Ainda não há volume suficiente para gerar o ranking.</li>
                        )}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Atividade
                      </p>
                      <p className="mt-2 text-sm text-slate-700">
                        {salesCount > 0
                          ? `${salesCount} venda${salesCount === 1 ? "" : "s"} distribuídas em ${daysWithSales} dia${daysWithSales === 1 ? "" : "s"}.`
                          : "Nenhuma venda registrada no período atual."}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </SensitiveSection>

            <Card className="border-0 bg-white shadow-xl">
              <CardContent className="space-y-5 p-6">
                <h3 className="text-lg font-semibold text-slate-900">Atalhos do gestor</h3>
                <div className="space-y-3 text-sm">
                  <button
                    onClick={() => navigate(`/sales?employee=${employee.id}`)}
                    className="flex w-full items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left font-semibold text-indigo-700 transition hover:bg-indigo-100"
                  >
                    Registrar nova venda
                    <span>→</span>
                  </button>
                  <button
                    onClick={() => navigate("/statistics")}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Abrir painel analítico
                    <span>→</span>
                  </button>
                  <button
                    onClick={() => navigate("/employees")}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Voltar para equipe
                    <span>→</span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <EditEmployeeDialog
        open={isEditOpen}
        employee={employee}
        onClose={() => setIsEditOpen(false)}
        onSaved={(message) => {
          setFeedback({ type: "success", message });
          employeeQuery.refetch();
        }}
        onError={(message) => setFeedback({ type: "error", message })}
      />
    </div>
  );
}

interface EditEmployeeDialogProps {
  open: boolean;
  employee: EmployeeEntity;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

function EditEmployeeDialog({
  open,
  employee,
  onClose,
  onSaved,
  onError,
}: EditEmployeeDialogProps) {
  const [name, setName] = useState(employee.name ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [position, setPosition] = useState(employee.position ?? "");

  useEffect(() => {
    if (!open) return;
    setName(employee.name ?? "");
    setEmail(employee.email ?? "");
    setPhone(employee.phone ?? "");
    setPosition(employee.position ?? "");
  }, [open, employee]);

  const updateEmployee = trpc.employees.update.useMutation();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim()) {
      onError("Informe pelo menos um nome.");
      return;
    }

    try {
      await updateEmployee.mutateAsync({
        id: employee.id,
        name: name.trim(),
        email: email.trim() ? email.trim() : undefined,
        phone: phone.trim() ? phone.trim() : undefined,
        position: position.trim() ? position.trim() : undefined,
      });
      onSaved("Informações do colaborador atualizadas com sucesso.");
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o colaborador.";
      onError(message);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Editar colaborador</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50/80 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            <span className="sr-only">Fechar</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nome completo
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
              placeholder="Nome do colaborador"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
              placeholder="email@empresa.com"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Telefone
            </label>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
              placeholder="(11) 99999-0000"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Cargo / função
            </label>
            <input
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
              placeholder="Ex: Executivo de vendas"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={updateEmployee.isPending}
              className="flex-1 bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {updateEmployee.isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1 bg-white text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-700"
              disabled={updateEmployee.isPending}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
