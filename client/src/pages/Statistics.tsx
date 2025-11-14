import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import type { DailySaleRecord, EmployeeRecord } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import EmployeeLink from "@/components/EmployeeLink";
import { calculateCommission, formatCurrency, formatPercentage } from "@/lib/utils-commission";
import { SensitiveSection, SensitiveSectionToggleButton, SensitiveValue } from "@/components/SensitiveValue";
import { usePageHeader } from "@/contexts/PageHeaderContext";

const COMPANY_ID = "default-company";

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

type EmployeeEntity = EmployeeRecord;
type CompanySale = DailySaleRecord;
type CompanySales = CompanySale[];

type EmployeePerformance = {
  employee: EmployeeEntity;
  total: number;
  salesCount: number;
  average: number;
  sales: CompanySale[];
  commissionRate: number;
  commission: number;
};

type DailyPerformance = {
  employee: EmployeeEntity;
  total: number;
  salesCount: number;
  average: number;
  highestSale: number;
  lowestSale: number;
  sales: CompanySale[];
};

// Função para obter data no formato YYYY-MM-DD sem problemas de timezone
function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Statistics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { setTitle, setShowUserInfo } = usePageHeader();
  
  useEffect(() => {
    setTitle("Estatísticas");
    setShowUserInfo(true);
  }, [setShowUserInfo, setTitle]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [sortMode, setSortMode] = useState<'value' | 'name' | 'sales'>('value');
  
  // Estado para relatório diário
  const [selectedDate, setSelectedDate] = useState('');
  const [showDailyReport, setShowDailyReport] = useState(false);
  
  // Estado para visibilidade de comissões

  const numberFormatter = useMemo(() => new Intl.NumberFormat("pt-BR"), []);
  const compactCurrencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    []
  );

  const employeesQuery = trpc.employees.listActive.useQuery({ companyId: COMPANY_ID });
  const totalQuery = trpc.sales.getTotalByCompanyInMonth.useQuery({
    companyId: COMPANY_ID,
    year: selectedYear,
    month: selectedMonth,
  });

  // Buscar vendas de todos os funcionários no mês
  const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
  const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const salesQuery = trpc.sales.getByCompany.useQuery({
    companyId: COMPANY_ID,
    startDate,
    endDate,
  });

  const dailySalesQuery = trpc.sales.getByCompany.useQuery(
    {
      companyId: COMPANY_ID,
      startDate: selectedDate,
      endDate: selectedDate,
    },
    {
      enabled: showDailyReport && selectedDate !== "",
    }
  );

  const employeesData: EmployeeEntity[] = (employeesQuery.data as EmployeeEntity[] | undefined) ?? [];
  const monthlySales: CompanySales = (salesQuery.data as CompanySales | undefined) ?? [];
  const dailySalesData: CompanySales = (dailySalesQuery.data as CompanySales | undefined) ?? [];

  // Restaura filtros quando acessamos um link compartilhado
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const monthParam = Number(params.get("month"));
    const yearParam = Number(params.get("year"));
    const dateParam = params.get("date");

    if (monthParam >= 1 && monthParam <= 12) {
      setSelectedMonth(monthParam);
    }

    if (yearParam >= 2000 && yearParam <= 2100) {
      setSelectedYear(yearParam);
    }

    if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      setSelectedDate(dateParam);
      setShowDailyReport(true);
    }
  }, []);

  // Mantém a URL sincronizada com os filtros ativos
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    params.set("month", String(selectedMonth));
    params.set("year", String(selectedYear));

    if (showDailyReport && selectedDate) {
      params.set("date", selectedDate);
    }

    const search = params.toString();
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [selectedMonth, selectedYear, selectedDate, showDailyReport]);

  // Calcular estatísticas por funcionário
  const employeeStats = useMemo<EmployeePerformance[]>(() => {
    const statsByEmployee = new Map<string, { total: number; salesCount: number; sales: CompanySale[] }>();

    for (const sale of monthlySales) {
      const amount = parseFloat(String(sale.amount ?? 0));
      if (Number.isNaN(amount)) continue;

      const current = statsByEmployee.get(sale.employeeId) ?? {
        total: 0,
        salesCount: 0,
        sales: [] as CompanySale[],
      };

      current.total += amount;
      current.salesCount += 1;
      current.sales.push(sale);

      statsByEmployee.set(sale.employeeId, current);
    }

    const stats = employeesData.map<EmployeePerformance>((emp) => {
      const empStats = statsByEmployee.get(emp.id) ?? {
        total: 0,
        salesCount: 0,
        sales: [] as CompanySale[],
      };

      const commissionRate = emp.commissionRate ? parseFloat(emp.commissionRate) : 0.005;
      const safeCommissionRate = Number.isFinite(commissionRate) ? commissionRate : 0.005;
      const commission = calculateCommission(empStats.total, safeCommissionRate);

      return {
        employee: emp,
        total: empStats.total,
        salesCount: empStats.salesCount,
        average: empStats.salesCount > 0 ? empStats.total / empStats.salesCount : 0,
        sales: empStats.sales,
        commissionRate: safeCommissionRate,
        commission,
      };
    });

    return stats.sort((a, b) => {
      if (sortMode === "value") return b.total - a.total;
      if (sortMode === "sales") return b.salesCount - a.salesCount;
      return a.employee.name.localeCompare(b.employee.name);
    });
  }, [employeesData, monthlySales, sortMode]);

  const monthLabel = `${monthNames[selectedMonth - 1]} / ${selectedYear}`;
  const monthlyTotal = totalQuery.data || 0;

  const totalSales = employeeStats.reduce((sum, item) => sum + item.salesCount, 0);
  const activeEmployees = employeeStats.filter((item) => item.salesCount > 0).length;
  const averagePerEmployee = activeEmployees > 0 ? monthlyTotal / activeEmployees : 0;
  const totalCommissions = employeeStats.reduce((sum, item) => sum + item.commission, 0);

  const dailyStats = useMemo<DailyPerformance[]>(() => {
    if (!showDailyReport || dailySalesData.length === 0) return [];

    const statsByEmployee = new Map<
      string,
      {
        total: number;
        salesCount: number;
        highestSale: number;
        lowestSale: number;
        sales: CompanySale[];
      }
    >();

    for (const sale of dailySalesData) {
      const amount = parseFloat(String(sale.amount ?? 0));
      if (Number.isNaN(amount)) continue;

      const current = statsByEmployee.get(sale.employeeId) ?? {
        total: 0,
        salesCount: 0,
        highestSale: 0,
        lowestSale: Number.POSITIVE_INFINITY,
        sales: [] as CompanySale[],
      };

      current.total += amount;
      current.salesCount += 1;
      current.highestSale = Math.max(current.highestSale, amount);
      current.lowestSale = Math.min(current.lowestSale, amount);
      current.sales.push(sale);

      statsByEmployee.set(sale.employeeId, current);
    }

    const stats = employeesData.flatMap<DailyPerformance>((emp) => {
      const empStats = statsByEmployee.get(emp.id);
      if (!empStats) return [];

      return [
        {
          employee: emp,
          total: empStats.total,
          salesCount: empStats.salesCount,
          average: empStats.total / empStats.salesCount,
          highestSale: empStats.highestSale,
          lowestSale: empStats.lowestSale === Number.POSITIVE_INFINITY ? 0 : empStats.lowestSale,
          sales: empStats.sales,
        },
      ];
    });

    return stats.sort((a, b) => b.total - a.total);
  }, [dailySalesData, employeesData, showDailyReport]);

  const dailyTrendData = useMemo(() => {
    const totalsByDay = monthlySales.reduce<Record<string, number>>((acc, sale) => {
      const key = sale.date;
      if (!key) return acc;
      const amount = parseFloat(String(sale.amount ?? 0));
      if (Number.isNaN(amount)) return acc;
      acc[key] = (acc[key] || 0) + amount;
      return acc;
    }, {});

    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const key = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const total = totalsByDay[key] ?? 0;

      return {
        day,
        label: String(day).padStart(2, "0"),
        total,
      };
    });
  }, [monthlySales, selectedMonth, selectedYear]);

  const activeDaysInMonth = useMemo(
    () => dailyTrendData.filter((item) => item.total > 0).length,
    [dailyTrendData]
  );

  const averageDaily = activeDaysInMonth > 0 ? monthlyTotal / activeDaysInMonth : 0;
  const hasDailyTrend = dailyTrendData.some((item) => item.total > 0);

  const bestDay = useMemo(() => {
    const daysWithSales = dailyTrendData.filter((item) => item.total > 0);
    if (daysWithSales.length === 0) return null;
    return daysWithSales.reduce((acc, item) => (item.total > acc.total ? item : acc), daysWithSales[0]);
  }, [dailyTrendData]);

  const topPerformer = useMemo(() => {
    if (employeeStats.length === 0) return null;
    return [...employeeStats].sort((a, b) => b.total - a.total)[0];
  }, [employeeStats]);

  const topPerformerShare = topPerformer && monthlyTotal > 0 ? (topPerformer.total / monthlyTotal) * 100 : 0;

  const topEmployeesChartData = useMemo(() => {
    const ranked = [...employeeStats]
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return ranked.map((item) => {
      const firstName = item.employee.name?.split(" ")[0] ?? item.employee.name;
      const totalValue = Number(item.total);
      const share = monthlyTotal > 0 ? (totalValue / monthlyTotal) * 100 : 0;

      return {
        name: firstName,
        fullName: item.employee.name,
        total: totalValue,
        salesCount: item.salesCount,
        share,
      };
    });
  }, [employeeStats, monthlyTotal]);

  const hasTopEmployeesData = topEmployeesChartData.length > 0;

  const renderDailyTooltip = ({ active, payload, label }: TooltipContentProps<ValueType, NameType>) => {
    const point = payload?.[0];
    if (!active || !point) return null;
    const total = Number(point.value ?? 0);
    const difference = total - averageDaily;

    return (
      <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-gray-700">Dia {String(label ?? "").padStart(2, "0")}</p>
        <p className="mt-1 text-gray-600">
          Total:
          <SensitiveValue
            className="font-semibold text-indigo-600"
            containerClassName="ml-1"
          >
            {formatCurrency(total)}
          </SensitiveValue>
        </p>
        {averageDaily > 0 && (
          <p className="text-gray-500">
            Diferença vs média:{" "}
            <SensitiveValue className="font-semibold text-gray-600">
              {`${difference >= 0 ? "+" : "-"}${formatCurrency(Math.abs(difference))}`}
            </SensitiveValue>
          </p>
        )}
      </div>
    );
  };

  const renderTopEmployeesTooltip = ({ active, payload }: TooltipContentProps<ValueType, NameType>) => {
    const point = payload?.[0];
    if (!active || !point) return null;
    const item = point.payload as (typeof topEmployeesChartData)[number] | undefined;
    if (!item) return null;

    return (
      <div className="rounded-xl border border-indigo-100 bg-white px-3 py-2 text-xs shadow-lg">
        <p className="text-sm font-semibold text-gray-700">{item.fullName}</p>
        <p className="mt-1 text-gray-600">
          Total:
          <SensitiveValue
            className="font-semibold text-indigo-600"
            containerClassName="ml-1"
          >
            {formatCurrency(item.total)}
          </SensitiveValue>
        </p>
        <p className="text-gray-500">Vendas: {item.salesCount}</p>
        <p className="text-gray-500">Participação: {item.share.toFixed(1)}%</p>
      </div>
    );
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50">
      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-600 to-indigo-700 text-white shadow-xl">
          <div className="absolute inset-0 opacity-40">
            <div className="absolute -top-24 -right-12 h-72 w-72 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute top-32 -left-16 h-60 w-60 rounded-full bg-purple-300/30 blur-3xl" />
          </div>
          <div className="relative px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-sm font-semibold text-white/85 backdrop-blur-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-lime-300" />
                  {monthLabel} • Painel analítico
                </span>
                <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-[2.65rem]">
                  Insights do desempenho comercial da equipe
                </h1>
                <p className="text-sm sm:text-base text-white/85">
                  Explore tendências do mês, compare a performance da equipe e mergulhe em detalhes diários para tomar decisões rápidas e embasadas.
                </p>
                <div className="flex flex-wrap gap-3 text-xs font-semibold text-white/80">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h2m4 0h12M3 12h18M3 17h12" />
                    </svg>
                    {numberFormatter.format(totalSales)} vendas registradas
                  </span>
                  {activeDaysInMonth > 0 && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 backdrop-blur-sm">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {activeDaysInMonth} {activeDaysInMonth === 1 ? 'dia com movimento' : 'dias com movimento'}
                    </span>
                  )}
                </div>
              </div>

              <SensitiveSection>
                <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-white/10 p-6 shadow-lg backdrop-blur">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
                      Receita no período
                    </p>
                    <SensitiveSectionToggleButton className="border-white/40 bg-white/15 text-white/90 hover:bg-white/25" />
                  </div>
                <p className="mt-3 text-3xl font-bold sm:text-4xl">
                  <SensitiveValue className="text-inherit font-inherit" containerClassName="w-full justify-start">
                    {formatCurrency(monthlyTotal)}
                  </SensitiveValue>
                </p>
                <div className="mt-6 space-y-4">
                  {bestDay && (
                    <div className="rounded-xl border border-white/15 bg-white/15 px-4 py-3 text-sm text-white/90">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Melhor dia</p>
                      <p className="mt-1 text-base font-semibold text-white">
                        Dia {String(bestDay.day).padStart(2, '0')} •{' '}
                        <SensitiveValue className="font-semibold text-white" containerClassName="ml-1">
                          {formatCurrency(bestDay.total)}
                        </SensitiveValue>
                      </p>
                    </div>
                  )}
                  {averageDaily > 0 && (
                    <div className="rounded-xl border border-white/15 bg-white/12 px-4 py-3 text-sm text-white/90">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Média diária</p>
                      <p className="mt-1 text-base font-semibold text-white">
                        <SensitiveValue className="font-semibold text-white" containerClassName="w-full justify-start">
                          {formatCurrency(averageDaily)}
                        </SensitiveValue>
                      </p>
                    </div>
                  )}
                  {topPerformer && (
                    <div className="rounded-xl border border-white/15 bg-white/12 px-4 py-3 text-sm text-white/90">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Top performer</p>
                      <div className="mt-1 flex items-center justify-between gap-3">
                        <span className="text-base font-semibold text-white line-clamp-1">
                          {topPerformer.employee.name}
                        </span>
                        <button
                          onClick={() => navigate(`/employees/${topPerformer.employee.id}`)}
                          className="inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 text-[11px] font-semibold text-white/85 transition-all hover:bg-white/15"
                        >
                          Ver
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-white/85">
                        <span>{topPerformer.salesCount} venda{topPerformer.salesCount === 1 ? '' : 's'}</span>
                        <SensitiveValue className="font-semibold text-white" containerClassName="ml-auto">
                          {formatCurrency(topPerformer.total)}
                        </SensitiveValue>
                      </div>
                      <p className="text-[11px] text-white/75">
                        Participação no mês: {topPerformerShare.toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
                </div>
              </SensitiveSection>
            </div>
          </div>
        </section>

        {/* Filtros Modernos */}
        <Card className="border border-indigo-100 bg-white/90 backdrop-blur rounded-3xl shadow-lg">
          <CardHeader className="border-b border-indigo-100 bg-white/70 backdrop-blur-sm text-indigo-700">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-3 text-lg font-semibold text-indigo-800">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                Período de Análise
              </CardTitle>

              <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-100 px-3 py-1.5 text-sm font-semibold text-indigo-700">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-bold">{monthNames[selectedMonth - 1]} / {selectedYear}</span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 pb-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Seletor de Mês */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-indigo-900">Mês</label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full appearance-none rounded-xl border border-indigo-100 bg-white px-4 py-3 pr-10 text-indigo-900 shadow-sm transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    {monthNames.map((name, index) => (
                      <option key={index + 1} value={index + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Seletor de Ano */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-indigo-900">Ano</label>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full appearance-none rounded-xl border border-indigo-100 bg-white px-4 py-3 pr-10 text-indigo-900 shadow-sm transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    {Array.from({ length: 5 }, (_, i) => selectedYear - 2 + i).map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Botões de navegação rápida */}
              <div className="md:col-span-2 xl:col-span-2">
                <label className="text-sm font-semibold text-indigo-900">Atalhos de navegação</label>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedMonth === 1) {
                        setSelectedMonth(12);
                        setSelectedYear(selectedYear - 1);
                      } else {
                        setSelectedMonth(selectedMonth - 1);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
                    title="Mês anterior"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Anterior
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setSelectedMonth(now.getMonth() + 1);
                      setSelectedYear(now.getFullYear());
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                    title="Voltar para o mês atual"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 7l-1-1m0 0l-1 1m1-1v8m4 4h-4m8-12h3m0 0v3m0-3l-5 5" />
                    </svg>
                    Mês atual
                  </button>
                  <button
                    onClick={() => {
                      if (selectedMonth === 12) {
                        setSelectedMonth(1);
                        setSelectedYear(selectedYear + 1);
                      } else {
                        setSelectedMonth(selectedMonth + 1);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50"
                    title="Próximo mês"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Próximo
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-8">
          {/* Total Geral */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-emerald-400 to-teal-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-emerald-50 text-xs font-bold mb-1 uppercase tracking-wide">Total Geral</p>
              <p className="text-xl sm:text-2xl font-black mb-1 break-words">
                <SensitiveValue
                  className="text-inherit font-inherit"
                  containerClassName="w-full justify-start"
                >
                  {formatCurrency(totalQuery.data || 0)}
                </SensitiveValue>
              </p>
              <p className="text-emerald-50 text-xs font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                </svg>
                Receita do período
              </p>
            </CardContent>
          </Card>

          {/* Total de Comissões */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-purple-500 to-violet-600 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-purple-50 text-xs font-bold mb-1 uppercase tracking-wide">Comissões</p>
              <SensitiveValue
                className="text-xl sm:text-2xl font-black"
                containerClassName="mb-1 w-full justify-start break-words"
                hideLabel="Ocultar comissão"
                revealLabel="Mostrar"
              >
                {formatCurrency(totalCommissions)}
              </SensitiveValue>
              <p className="text-purple-50 text-xs font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                </svg>
                Total a pagar
              </p>
            </CardContent>
          </Card>

          {/* Total de Vendas */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-blue-400 to-indigo-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
              </div>
              <p className="text-blue-50 text-xs font-bold mb-1 uppercase tracking-wide">Vendas</p>
              <p className="text-xl sm:text-2xl font-black mb-1">{totalSales}</p>
              <p className="text-blue-50 text-xs font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                </svg>
                Transações realizadas
              </p>
            </CardContent>
          </Card>

          {/* Funcionários Ativos */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-purple-400 to-pink-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-purple-50 text-xs font-bold mb-1 uppercase tracking-wide">Funcionários</p>
              <p className="text-xl sm:text-2xl font-black mb-1">{activeEmployees}</p>
              <p className="text-purple-50 text-xs font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
                </svg>
                Com vendas ativas
              </p>
            </CardContent>
          </Card>

          {/* Ticket Médio por Funcionário */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-orange-400 to-amber-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-4 sm:p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-white/25 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-orange-50 text-xs font-bold mb-1 uppercase tracking-wide">Média/Funcionário</p>
              <p className="text-xl sm:text-2xl font-black mb-1 break-words">
                <SensitiveValue
                  className="text-inherit font-inherit"
                  containerClassName="w-full justify-start"
                >
                  {formatCurrency(averagePerEmployee)}
                </SensitiveValue>
              </p>
              <p className="text-orange-50 text-xs font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
                </svg>
                Performance média
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SensitiveSection>
            <Card className="xl:col-span-2 border border-indigo-100 bg-white/90 backdrop-blur rounded-3xl shadow-lg">
            <CardHeader className="border-b border-indigo-100 bg-white/70 backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-3 text-indigo-800">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h18M5 12h14M7 16h10M9 20h6" />
                      </svg>
                    </div>
                    Evolução diária das vendas
                  </CardTitle>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {monthLabel}
                    </span>
                    <SensitiveSectionToggleButton className="border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50" />
                  </div>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[320px]">
                {hasDailyTrend ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyTrendData} margin={{ left: -10, right: 0, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="monthlyTrendGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e0e7ff" strokeDasharray="4 8" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#4338ca', fontSize: 12, fontWeight: 600 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#4c1d95', fontSize: 12 }}
                      />
                      <Tooltip content={renderDailyTooltip} cursor={{ fill: '#eef2ff' }} />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fill="url(#monthlyTrendGradient)"
                        dot={{ r: 3.5, stroke: '#4338ca', strokeWidth: 1 }}
                        activeDot={{ r: 5, stroke: '#312e81', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-100 bg-indigo-50/60 text-center">
                    <div className="rounded-full bg-indigo-100 p-3 text-indigo-600">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h11M9 21V3m12 13h-4m0 0l2-2m-2 2l2 2" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-indigo-700">Sem vendas registradas neste mês</p>
                    <p className="text-xs text-indigo-500">Registre novas vendas para visualizar a evolução diária.</p>
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-500">Média diária</p>
                  <p className="mt-1 text-sm font-bold text-indigo-800">
                    {averageDaily > 0 ? (
                      <SensitiveValue className="font-bold text-indigo-800" containerClassName="w-full justify-start">
                        {formatCurrency(averageDaily)}
                      </SensitiveValue>
                    ) : '--'}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-500">Melhor dia</p>
                  <p className="mt-1 text-sm font-bold text-emerald-700">
                    {bestDay ? (
                      <>
                        Dia {String(bestDay.day).padStart(2, '0')} •{' '}
                        <SensitiveValue className="font-bold text-emerald-700" containerClassName="ml-1">
                          {formatCurrency(bestDay.total)}
                        </SensitiveValue>
                      </>
                    ) : 'Aguardando vendas'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Volume de vendas</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    {numberFormatter.format(totalSales)} registro{totalSales === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            </CardContent>
            </Card>
          </SensitiveSection>
          <SensitiveSection>
            <Card className="border border-indigo-100 bg-white/90 backdrop-blur rounded-3xl shadow-lg">
              <CardHeader className="border-b border-indigo-100 bg-white/70 backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-3 text-indigo-800">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3h2m-1 0v18m-7-4h14M5 11h14M5 7h14" />
                      </svg>
                    </div>
                    Ranking por faturamento
                  </CardTitle>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Top 6 do mês
                    </span>
                    <SensitiveSectionToggleButton className="border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50" />
                  </div>
                </div>
              </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[320px]">
                {hasTopEmployeesData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topEmployeesChartData}
                      margin={{ left: -10, right: 10, top: 10, bottom: 0 }}
                      barSize={32}
                    >
                      <CartesianGrid vertical={false} stroke="#e0e7ff" strokeDasharray="4 6" />
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#4338ca', fontSize: 12, fontWeight: 600 }}
                      />
                      <YAxis
                        tickFormatter={(value) => compactCurrencyFormatter.format(Number(value))}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#4c1d95', fontSize: 12 }}
                      />
                      <Tooltip content={renderTopEmployeesTooltip} cursor={{ fill: '#eef2ff' }} />
                      <Bar dataKey="total" radius={[10, 10, 6, 6]} fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-indigo-100 bg-slate-50/60 text-center">
                    <div className="rounded-full bg-indigo-100 p-3 text-indigo-600">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-indigo-700">Nenhum colaborador com vendas</p>
                    <p className="text-xs text-indigo-500">Assim que as vendas forem registradas, o ranking será atualizado automaticamente.</p>
                  </div>
                )}
              </div>

              {hasTopEmployeesData && (
                <div className="mt-6 space-y-3">
                  {topEmployeesChartData.slice(0, 3).map((item, index) => {
                    const podiumStyles = [
                      'bg-amber-200 text-amber-900',
                      'bg-slate-200 text-slate-800',
                      'bg-orange-200 text-orange-900',
                    ];
                    const badgeClass = podiumStyles[index] ?? 'bg-indigo-100 text-indigo-700';
                    const shareWidth = `${Math.min(item.share, 100).toFixed(1)}%`;

                    return (
                      <div key={item.fullName} className="flex items-center gap-3">
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${badgeClass}`}>
                          {index + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-700">{item.fullName}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                            <SensitiveValue className="font-semibold text-slate-500" containerClassName="w-fit">
                              {formatCurrency(item.total)}
                            </SensitiveValue>
                            <span>•</span>
                            <span>{item.salesCount} venda{item.salesCount === 1 ? '' : 's'}</span>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-indigo-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: shareWidth }} />
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-indigo-600">{item.share.toFixed(1)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            </Card>
          </SensitiveSection>
        </section>

        {/* Ranking de Funcionários */}
        <SensitiveSection>
          <Card className="border border-indigo-100 bg-white/95 backdrop-blur rounded-3xl shadow-xl overflow-hidden">
          <CardHeader className="border-b border-indigo-100 bg-white/75 backdrop-blur-sm text-indigo-800">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-3 text-indigo-800">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <span className="block text-xl font-bold">Performance por Funcionário - Mensal</span>
                  <span className="text-xs font-medium text-indigo-500">
                    {monthNames[selectedMonth - 1]} de {selectedYear} • {employeeStats.length} {employeeStats.length === 1 ? 'funcionário' : 'funcionários'}
                  </span>
                </div>
              </CardTitle>

              <div className="flex items-center gap-3">
                {/* Ordenação */}
                <div className="flex gap-1 rounded-lg bg-indigo-100 p-1">
                  <button
                    onClick={() => setSortMode('value')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      sortMode === 'value'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-indigo-600/80 hover:bg-white'
                    }`}
                    title="Ordenar por valor"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Valor
                  </button>
                  <button
                    onClick={() => setSortMode('sales')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      sortMode === 'sales'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-indigo-600/80 hover:bg-white'
                    }`}
                    title="Ordenar por quantidade"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Vendas
                  </button>
                  <button
                    onClick={() => setSortMode('name')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                      sortMode === 'name'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-indigo-600/80 hover:bg-white'
                    }`}
                    title="Ordenar por nome"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                    </svg>
                    Nome
                  </button>
                </div>

                {/* Visualização */}
                <div className="flex gap-1 rounded-lg bg-indigo-100 p-1">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'cards'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-indigo-600/80 hover:bg-white'
                    }`}
                    title="Visualização em cards"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'table'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-indigo-600/80 hover:bg-white'
                    }`}
                    title="Visualização em tabela"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                </div>
                <SensitiveSectionToggleButton className="border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            {viewMode === 'cards' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employeeStats.map((item, index) => (
                  <div
                    key={item.employee.id}
                    className={`relative overflow-hidden rounded-xl transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${
                      index === 0 && sortMode === 'value' ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300' :
                      index === 1 && sortMode === 'value' ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300' :
                      index === 2 && sortMode === 'value' ? 'bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300' :
                      'bg-white border-2 border-gray-200'
                    }`}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        {/* Position Badge */}
                        {sortMode === 'value' && index < 3 ? (
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg transition-transform hover:scale-110 hover:rotate-6 duration-200 ${
                            index === 0 ? 'bg-yellow-400 text-yellow-900' :
                            index === 1 ? 'bg-gray-400 text-gray-900' :
                            'bg-orange-400 text-orange-900'
                          }`}>
                            {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                          </div>
                        ) : (
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm transition-all hover:bg-indigo-200 hover:scale-110 duration-200">
                            {index + 1}
                          </div>
                        )}
                        
                        {/* Employee Name */}
                        <div className="flex-1 min-w-0">
                          <EmployeeLink
                            employeeId={item.employee.id}
                            employeeName={item.employee.name}
                            className="text-lg font-bold text-gray-900 truncate block"
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">Total</span>
                          <SensitiveValue
                            className="text-xl font-black text-emerald-600"
                            containerClassName="w-fit justify-end"
                          >
                            {formatCurrency(item.total)}
                          </SensitiveValue>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Vendas</span>
                          <span className="font-bold text-gray-900">{item.salesCount}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Ticket médio</span>
                          <SensitiveValue
                            className="font-bold text-indigo-600"
                            containerClassName="w-fit justify-end"
                          >
                            {formatCurrency(item.average)}
                          </SensitiveValue>
                        </div>
                        <div className="pt-2 mt-2 border-t border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">Comissão ({formatPercentage(item.commissionRate)})</span>
                            <SensitiveValue
                              key={`card-commission-${item.employee.id}`}
                              className="text-base font-bold text-purple-600"
                              containerClassName="w-fit justify-end"
                            >
                              {formatCurrency(item.commission)}
                            </SensitiveValue>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Funcionário</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Vendas</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Ticket Médio</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Comissão</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employeeStats.map((item, index) => (
                      <tr key={item.employee.id} className="hover:bg-indigo-50/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap">
                          {sortMode === 'value' && index < 3 ? (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-400 text-gray-900' :
                              'bg-orange-400 text-orange-900'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </div>
                          ) : (
                            <span className="font-bold text-gray-600">{index + 1}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <EmployeeLink
                            employeeId={item.employee.id}
                            employeeName={item.employee.name}
                            className="text-base font-bold text-gray-900"
                          />
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <SensitiveValue
                            className="text-lg font-black text-emerald-600"
                            containerClassName="ml-auto justify-end"
                          >
                            {formatCurrency(item.total)}
                          </SensitiveValue>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-700">
                            {item.salesCount}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <SensitiveValue
                            className="text-base font-bold text-indigo-600"
                            containerClassName="ml-auto justify-end"
                          >
                            {formatCurrency(item.average)}
                          </SensitiveValue>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="text-right">
                            <SensitiveValue
                              key={`table-commission-${item.employee.id}`}
                              className="text-base font-bold text-purple-600"
                              containerClassName="ml-auto justify-end"
                            >
                              {formatCurrency(item.commission)}
                            </SensitiveValue>
                            <span className="text-xs text-gray-500">
                              ({formatPercentage(item.commissionRate)})
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => navigate(`/employees/${item.employee.id}`)}
                            className="inline-flex items-center px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            Ver detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {employeeStats.length === 0 && (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-700 mb-2">Nenhum funcionário encontrado</h3>
                <p className="text-gray-500 text-sm">Não há dados para o período selecionado</p>
              </div>
            )}
          </CardContent>
          </Card>
        </SensitiveSection>
        {/* Seção de Relatório Diário */}
        <SensitiveSection>
          <Card className="mt-10 border border-rose-100 bg-white/95 backdrop-blur rounded-3xl shadow-xl overflow-hidden">
          <CardHeader className="border-b border-rose-100 bg-white/75 backdrop-blur-sm text-rose-600">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-3 text-rose-700">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                Relatório Diário Detalhado
              </CardTitle>
              <SensitiveSectionToggleButton className="border-rose-200 bg-white text-rose-600 hover:bg-rose-50" />
            </div>
          </CardHeader>
          
          <CardContent className="pt-6">
            {/* Seletor de Data */}
            <div className="mb-6 flex flex-wrap items-end gap-4">
              <div className="flex-1 min-w-[250px]">
                <label className="mb-2 block text-sm font-semibold text-rose-900">
                  Selecione uma Data para Visualizar o Relatório
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      if (e.target.value) {
                        setShowDailyReport(true);
                      }
                    }}
                    className="w-full appearance-none rounded-xl border border-rose-100 bg-white px-4 py-3 pr-10 text-rose-900 shadow-sm transition-all focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                    placeholder="Selecione uma data"
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              
              <button
                onClick={() => {
                  const today = getLocalDateString();
                  setSelectedDate(today);
                  setShowDailyReport(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:from-rose-600 hover:to-rose-700"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Hoje
              </button>
            </div>

            {/* Tabela de Relatório Diário */}
            {showDailyReport && (
              <div className="space-y-4">
                {dailySalesQuery.isLoading && (
                  <div className="text-center py-12">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-rose-400 border-t-transparent"></div>
                    <p className="mt-4 text-rose-600 font-medium">Carregando dados...</p>
                  </div>
                )}

                {!dailySalesQuery.isLoading && dailyStats.length > 0 && (
                  <>
                    {/* Cards de Resumo do Dia */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-pink-50 to-rose-50 border-2 border-pink-200 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-sm font-bold text-pink-700 uppercase">Total do Dia</span>
                        </div>
                        <p className="text-2xl font-black text-pink-600">
                          <SensitiveValue
                            className="text-2xl font-black text-pink-600"
                            containerClassName="w-full justify-start"
                          >
                            {formatCurrency(dailyStats.reduce((sum, s) => sum + s.total, 0))}
                          </SensitiveValue>
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-bold text-blue-700 uppercase">Total de Vendas</span>
                        </div>
                        <p className="text-2xl font-black text-blue-600">
                          {dailyStats.reduce((sum, s) => sum + s.salesCount, 0)}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-purple-50 to-violet-50 border-2 border-purple-200 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <span className="text-sm font-bold text-purple-700 uppercase">Funcionários Ativos</span>
                        </div>
                        <p className="text-2xl font-black text-purple-600">
                          {dailyStats.length}
                        </p>
                      </div>

                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                          <span className="text-sm font-bold text-orange-700 uppercase">Média por Venda</span>
                        </div>
                        <p className="text-2xl font-black text-orange-600">
                          <SensitiveValue
                            className="text-2xl font-black text-orange-600"
                            containerClassName="w-full justify-start"
                          >
                            {formatCurrency(dailyStats.reduce((sum, s) => sum + s.total, 0) / dailyStats.reduce((sum, s) => sum + s.salesCount, 0))}
                          </SensitiveValue>
                        </p>
                      </div>
                    </div>

                    {/* Tabela Moderna e Elegante */}
                    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-gray-100">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gradient-to-r from-pink-500 to-rose-500 text-white">
                              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">
                                <div className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                  Funcionário
                                </div>
                              </th>
                              <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">
                                <div className="flex items-center justify-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                                  </svg>
                                  Qtd. Vendas
                                </div>
                              </th>
                              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Total
                                </div>
                              </th>
                              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                  Média/Venda
                                </div>
                              </th>
                              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                  </svg>
                                  Maior Venda
                                </div>
                              </th>
                              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                  </svg>
                                  Menor Venda
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y-2 divide-gray-100">
                            {dailyStats.map((stat, index) => (
                              <tr 
                                key={stat.employee.id}
                                className={`hover:bg-gradient-to-r hover:from-pink-50 hover:to-rose-50 transition-all duration-200 ${
                                  index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50' : 
                                  index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50' :
                                  index === 2 ? 'bg-gradient-to-r from-orange-50 to-red-50' : ''
                                }`}
                              >
                                <td className="px-6 py-5">
                                  <div className="flex items-center gap-3">
                                    {index < 3 && (
                                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg' :
                                        index === 1 ? 'bg-gradient-to-br from-gray-400 to-slate-500 text-white shadow-lg' :
                                        'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-lg'
                                      }`}>
                                        {index + 1}
                                      </div>
                                    )}
                                    <EmployeeLink
                                      employeeId={stat.employee.id}
                                      employeeName={stat.employee.name}
                                      className="text-base font-bold text-gray-900 hover:text-pink-600 transition-colors"
                                    />
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-center">
                                  <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-full text-sm font-bold bg-blue-100 text-blue-700 border-2 border-blue-200">
                                    {stat.salesCount}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <SensitiveValue
                                    className="text-lg font-black text-pink-600"
                                    containerClassName="ml-auto justify-end"
                                  >
                                    {formatCurrency(stat.total)}
                                  </SensitiveValue>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <SensitiveValue
                                    className="text-base font-bold text-indigo-600"
                                    containerClassName="ml-auto justify-end"
                                  >
                                    {formatCurrency(stat.average)}
                                  </SensitiveValue>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <SensitiveValue
                                      className="text-base font-bold text-emerald-600"
                                      containerClassName="w-fit"
                                    >
                                      {formatCurrency(stat.highestSale)}
                                    </SensitiveValue>
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <SensitiveValue
                                      className="text-base font-bold text-red-600"
                                      containerClassName="w-fit"
                                    >
                                      {formatCurrency(stat.lowestSale)}
                                    </SensitiveValue>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {!dailySalesQuery.isLoading && dailyStats.length === 0 && (
                  <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl border-2 border-dashed border-gray-300">
                    <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">Nenhuma venda registrada</h3>
                    <p className="text-gray-500">Não há vendas registradas para a data selecionada</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
          </Card>
        </SensitiveSection>
      </main>
    </div>
  );
}
