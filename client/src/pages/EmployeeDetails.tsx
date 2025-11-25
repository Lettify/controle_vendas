import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import type { DailySaleRecord, EmployeeRecord } from "@/types/api";
import { Button } from "@/components/ui/button";
import {
  SensitiveSection,
  SensitiveSectionToggleButton,
  SensitiveValue,
} from "@/components/SensitiveValue";
import { useLocation, useRoute } from "wouter";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  ChevronDown,
  Edit2,
  Filter,
  LayoutGrid,
  List as ListIcon,
  Mail,
  Phone,
  Search,
  TrendingUp,
  User,
  X,
  Briefcase,
  DollarSign,
  Activity,
  Table as TableIcon
} from "lucide-react";
import { Input } from "@/components/ui/input";

// --- Types & Helpers ---

function formatDateWithoutTimezone(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.map((segment) => segment[0]!).slice(0, 2).join("").toUpperCase();
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

// --- Animation Variants ---

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0, scale: 0.95 },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 } as const
  }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", duration: 0.5, bounce: 0.3 } as const
  },
  exit: { opacity: 0, scale: 0.95, y: 20, transition: { duration: 0.2 } as const }
};

// --- Components ---

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
    setTitle("Detalhes do Colaborador");
  }, [setShowUserInfo, setTitle]);

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
    { enabled: !!employeeId, refetchOnMount: true, refetchOnWindowFocus: false }
  );

  const monthSalesQuery = trpc.sales.getTotalByEmployeeInMonth.useQuery(
    { employeeId, year: selectedYear, month: selectedMonth },
    { enabled: !!employeeId, refetchOnMount: true, refetchOnWindowFocus: false }
  );

  const startDate = selectedDate || `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-01`;
  const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const endDate = selectedDate || `${selectedYear}-${String(selectedMonth).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;

  const salesQuery = trpc.sales.getByEmployee.useQuery(
    { employeeId, startDate, endDate },
    { enabled: !!employeeId, refetchOnMount: true, refetchOnWindowFocus: false, staleTime: 0 }
  );

  const salesList: SalesList = (salesQuery.data as SalesList | undefined) ?? [];

  // --- Derived State ---

  const totalSales = useMemo(() => {
    if (selectedDate) {
      return salesList.reduce((sum, sale) => sum + parseFloat(sale.amount ?? "0"), 0);
    }
    if (monthSalesQuery.data !== undefined && monthSalesQuery.data !== null) {
      return monthSalesQuery.data;
    }
    return salesList.reduce((sum, sale) => sum + parseFloat(sale.amount ?? "0"), 0);
  }, [selectedDate, salesList, monthSalesQuery.data]);

  const salesByDay = useMemo(() => {
    if (!salesList.length) return {} as SalesByDayMap;
    return salesList.reduce<SalesByDayMap>((acc, sale) => {
      if (!sale?.date) return acc;
      const date = sale.date.split("T")[0];
      if (!acc[date]) acc[date] = { count: 0, total: 0, sales: [] };
      acc[date].count += 1;
      acc[date].total += parseFloat(sale.amount ?? "0");
      acc[date].sales.push(sale);
      return acc;
    }, {});
  }, [salesList]);

  const filteredAndSortedSales = useMemo(() => {
    let filtered = [...salesList];

    if (searchTerm) {
      filtered = filtered.filter((sale) => {
        const dateFormatted = formatDateWithoutTimezone(sale.date.split("T")[0]);
        return dateFormatted.includes(searchTerm);
      });
    }

    if (minValue) {
      const min = parseFloat(minValue);
      if (!Number.isNaN(min)) filtered = filtered.filter((sale) => parseFloat(sale.amount) >= min);
    }

    if (maxValue) {
      const max = parseFloat(maxValue);
      if (!Number.isNaN(max)) filtered = filtered.filter((sale) => parseFloat(sale.amount) <= max);
    }

    filtered.sort((a, b) => {
      switch (sortMode) {
        case "date-asc": return new Date(a.date).getTime() - new Date(b.date).getTime();
        case "date-desc": return new Date(b.date).getTime() - new Date(a.date).getTime();
        case "value-asc": return parseFloat(a.amount) - parseFloat(b.amount);
        case "value-desc": return parseFloat(b.amount) - parseFloat(a.amount);
        default: return 0;
      }
    });

    return filtered;
  }, [salesList, searchTerm, minValue, maxValue, sortMode]);

  const salesCount = salesList.length;
  const avgSale = salesCount > 0 ? totalSales / salesCount : 0;
  const daysWithSales = Object.keys(salesByDay).length;

  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const selectedMonthName = monthNames[selectedMonth - 1] ?? "";
  const periodLabel = selectedDate ? `Dia ${formatDateWithoutTimezone(selectedDate)}` : `${selectedMonthName} de ${selectedYear}`;

  const formatCurrency = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!user) {
    navigate("/login");
    return null;
  }

  if (employeeQuery.isLoading || salesQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Carregando dados...</p>
        </div>
      </div>
    );
  }

  const employee = employeeQuery.data as EmployeeEntity | null | undefined;

  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Colaborador não encontrado</h2>
          <Button onClick={() => navigate("/employees")} variant="outline">
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* --- Feedback Toast --- */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: -20, x: "-50%" }}
              className={`fixed top-6 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl backdrop-blur-md border flex items-center gap-3 font-medium ${feedback.type === "success"
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-700"
                : "bg-rose-50/90 border-rose-200 text-rose-700"
                }`}
            >
              {feedback.type === "success" ? <div className="w-2 h-2 rounded-full bg-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-rose-500" />}
              {feedback.message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- Header / Hero --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[2.5rem] bg-white border border-slate-200 shadow-xl shadow-slate-200/50"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />

          <div className="relative p-8 md:p-10">
            <div className="flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
              <div className="flex items-center gap-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/employees")}
                  className="rounded-full hover:bg-slate-100 text-slate-500"
                >
                  <ArrowLeft className="w-6 h-6" />
                </Button>

                <div className="relative">
                  <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-lg shadow-indigo-500/20 flex items-center justify-center text-4xl font-bold text-white">
                    {getInitials(employee.name)}
                  </div>
                  <div className={`absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-xs font-bold border-2 border-white shadow-sm ${employee.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    }`}>
                    {employee.isActive ? "ATIVO" : "INATIVO"}
                  </div>
                </div>

                <div>
                  <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{employee.name}</h1>
                  <div className="flex flex-wrap items-center gap-4 mt-2 text-slate-500 text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-4 h-4 text-indigo-500" />
                      {employee.position || "Sem cargo"}
                    </span>
                    {employee.email && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-indigo-500" />
                        {employee.email}
                      </span>
                    )}
                    {employee.phone && (
                      <span className="flex items-center gap-1.5">
                        <Phone className="w-4 h-4 text-indigo-500" />
                        {employee.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <Button
                  onClick={() => setIsEditOpen(true)}
                  variant="outline"
                  className="flex-1 md:flex-none h-11 rounded-xl border-slate-200 hover:bg-slate-50 hover:text-indigo-600"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar
                </Button>
                <Button
                  onClick={() => navigate(`/sales?employee=${employee.id}`)}
                  className="flex-1 md:flex-none h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Nova Venda
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* --- Stats Grid --- */}
        <SensitiveSection>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <SensitiveSectionToggleButton className="text-slate-400 hover:text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Vendido</p>
              <SensitiveValue className="text-3xl font-bold text-slate-900 mt-1">
                {formatCurrency(totalSales)}
              </SensitiveValue>
              <p className="text-xs text-slate-400 mt-2 font-medium">{periodLabel}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                  <Activity className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Ticket Médio</p>
              <SensitiveValue className="text-3xl font-bold text-slate-900 mt-1">
                {formatCurrency(avgSale)}
              </SensitiveValue>
              <p className="text-xs text-slate-400 mt-2 font-medium">{salesCount} vendas no período</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-2xl bg-blue-50 text-blue-600">
                  <Calendar className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Dias Ativos</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{daysWithSales}</p>
              <p className="text-xs text-slate-400 mt-2 font-medium">Dias com vendas registradas</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-gradient-to-br from-slate-900 to-slate-800 p-6 rounded-[2rem] shadow-lg text-white"
            >
              <p className="text-sm font-medium text-white/60 uppercase tracking-wide">Filtros Ativos</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">Mês</span>
                  <span className="font-bold">{selectedMonthName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/80">Ano</span>
                  <span className="font-bold">{selectedYear}</span>
                </div>
                {selectedDate && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/80">Dia</span>
                    <span className="font-bold text-emerald-400">{formatDateWithoutTimezone(selectedDate)}</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </SensitiveSection>

        {/* --- Filters & Content --- */}
        <div className="grid lg:grid-cols-[300px_1fr] gap-8">

          {/* Sidebar Filters */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm sticky top-24">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Filter className="w-5 h-5 text-indigo-500" />
                Filtros
              </h3>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Período</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <select
                        value={selectedMonth}
                        onChange={(e) => { setSelectedMonth(Number(e.target.value)); setSelectedDate(""); }}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={selectedYear}
                        onChange={(e) => { setSelectedYear(Number(e.target.value)); setSelectedDate(""); }}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Dia Específico</label>
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {selectedDate && (
                      <button
                        onClick={() => setSelectedDate("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 block">Busca e Valores</label>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Buscar data..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-10 bg-slate-50 border-slate-200 rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Min R$"
                        type="number"
                        value={minValue}
                        onChange={(e) => setMinValue(e.target.value)}
                        className="h-10 bg-slate-50 border-slate-200 rounded-xl"
                      />
                      <Input
                        placeholder="Max R$"
                        type="number"
                        value={maxValue}
                        onChange={(e) => setMaxValue(e.target.value)}
                        className="h-10 bg-slate-50 border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ListIcon className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode("compact")}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'compact' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <TableIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-sm font-medium text-slate-500 whitespace-nowrap">Ordenar por:</span>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="w-full sm:w-auto appearance-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="date-desc">Mais recentes</option>
                  <option value="date-asc">Mais antigas</option>
                  <option value="value-desc">Maior valor</option>
                  <option value="value-asc">Menor valor</option>
                </select>
              </div>
            </div>

            {/* Sales List */}
            <AnimatePresence mode="wait">
              {filteredAndSortedSales.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Nenhuma venda encontrada</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mt-2">
                    Tente ajustar os filtros ou selecione outro período.
                  </p>
                </motion.div>
              ) : (
                <SensitiveSection>
                  <motion.div
                    key={viewMode}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className={
                      viewMode === 'grid'
                        ? "grid grid-cols-1 sm:grid-cols-2 gap-4"
                        : "space-y-4"
                    }
                  >
                    {viewMode === 'compact' ? (
                      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                              <th className="px-6 py-4 font-semibold text-slate-500">Data</th>
                              <th className="px-6 py-4 font-semibold text-slate-500 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredAndSortedSales.map((sale) => (
                              <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-700">
                                  {formatDateWithoutTimezone(sale.date.split("T")[0])}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-slate-900">
                                  <SensitiveValue>{formatCurrency(parseFloat(sale.amount))}</SensitiveValue>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      filteredAndSortedSales.map((sale, index) => (
                        <motion.div
                          key={sale.id}
                          variants={itemVariants}
                          className={`bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group ${viewMode === 'grid' ? 'flex flex-col gap-4' : 'flex items-center justify-between'
                            }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                              #{index + 1}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Valor</p>
                              <SensitiveValue className="text-xl font-bold text-slate-900">
                                {formatCurrency(parseFloat(sale.amount))}
                              </SensitiveValue>
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 text-sm font-medium text-slate-500 ${viewMode === 'grid' ? 'mt-auto pt-4 border-t border-slate-50' : ''}`}>
                            <Calendar className="w-4 h-4 text-slate-400" />
                            {formatDateWithoutTimezone(sale.date.split("T")[0])}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                </SensitiveSection>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* --- Edit Modal --- */}
      <AnimatePresence>
        {isEditOpen && (
          <EditEmployeeDialog
            open={isEditOpen}
            employee={employee}
            onClose={() => setIsEditOpen(false)}
            onSaved={(msg) => {
              setFeedback({ type: "success", message: msg });
              employeeQuery.refetch();
            }}
            onError={(msg) => setFeedback({ type: "error", message: msg })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Edit Dialog Component ---

interface EditEmployeeDialogProps {
  open: boolean;
  employee: EmployeeEntity;
  onClose: () => void;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}

function EditEmployeeDialog({ employee, onClose, onSaved, onError }: EditEmployeeDialogProps) {
  const [name, setName] = useState(employee.name ?? "");
  const [email, setEmail] = useState(employee.email ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [position, setPosition] = useState(employee.position ?? "");

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
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        position: position.trim() || undefined,
      });
      onSaved("Informações atualizadas com sucesso.");
      onClose();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erro ao atualizar.");
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
      />
      <motion.div
        variants={modalVariants} initial="hidden" animate="visible" exit="exit"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl pointer-events-auto overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center justify-center relative">
            <h2 className="text-xl font-bold text-slate-900">Editar Colaborador</h2>
            <button onClick={onClose} className="absolute right-8 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-slate-100 text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="Nome completo" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Cargo</label>
                <Input value={position} onChange={e => setPosition(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="Ex: Vendedor" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Telefone</label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="(00) 00000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Email</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-200" placeholder="email@empresa.com" />
            </div>
            <div className="pt-4 flex gap-3">
              <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-12 rounded-xl text-slate-600 hover:bg-slate-100">Cancelar</Button>
              <Button type="submit" disabled={updateEmployee.isPending} className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20">
                {updateEmployee.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  );
}
