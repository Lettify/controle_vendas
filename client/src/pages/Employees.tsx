import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Plus,
  LayoutGrid,
  List as ListIcon,
  UserPlus,
  Users,
  Briefcase,
  Activity,
  X,
  Phone,
  Mail,
  Trash2,
  Power,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  SensitiveSection,
  SensitiveSectionToggleButton,
  SensitiveValue,
} from "@/components/SensitiveValue";

const COMPANY_ID = "default-company";

// --- Visual Constants & Helpers ---

const VISUAL_PALETTE = [
  {
    gradient: "from-violet-500 via-indigo-500 to-blue-500",
    shadow: "shadow-indigo-500/20",
    text: "text-indigo-600",
    bg: "bg-indigo-50",
    border: "border-indigo-100"
  },
  {
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    shadow: "shadow-emerald-500/20",
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100"
  },
  {
    gradient: "from-rose-500 via-pink-500 to-fuchsia-500",
    shadow: "shadow-rose-500/20",
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-100"
  },
  {
    gradient: "from-amber-400 via-orange-500 to-red-500",
    shadow: "shadow-orange-500/20",
    text: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-100"
  },
  {
    gradient: "from-blue-400 via-sky-500 to-indigo-500",
    shadow: "shadow-sky-500/20",
    text: "text-sky-600",
    bg: "bg-sky-50",
    border: "border-sky-100"
  },
] as const;

function getVisualToken(index: number) {
  return VISUAL_PALETTE[index % VISUAL_PALETTE.length];
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((segment) => segment[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}

// --- Animation Variants ---

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1
    }
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
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", duration: 0.5, bounce: 0.3 } as const
  },
  exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } as const }
};

// --- Components ---

export default function Employees() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { setTitle, setShowUserInfo } = usePageHeader();
  const utils = trpc.useUtils();

  useEffect(() => {
    setTitle("Equipe");
    setShowUserInfo(true);
  }, [setShowUserInfo, setTitle]);

  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", phone: "", position: "" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'mosaic' | 'table'>('mosaic');
  const [searchTerm, setSearchTerm] = useState("");
  // Removed unused statusFilter and page states
  const [pageSize] = useState(12);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setNewEmployee({ name: "", email: "", phone: "", position: "" });
  }, []);

  const employeesQuery = trpc.employees.list.useQuery({
    companyId: COMPANY_ID,
    limit: pageSize,
    offset: 0, // Fixed offset since page state was removed
    searchTerm: searchTerm || undefined,
    // Removed statusFilter usage
  });

  const createMutation = trpc.employees.create.useMutation({
    onSuccess: async () => {
      setIsSuccess(true);
      toast.success("Colaborador adicionado com sucesso!");

      // Pequeno delay para garantir que o banco processou
      await new Promise(resolve => setTimeout(resolve, 500));

      // Força o reset do cache da lista
      await utils.employees.list.reset();

      setTimeout(() => {
        handleCloseAddModal();
        setIsSuccess(false);
      }, 1000);
    },
  });

  const deactivateMutation = trpc.employees.deactivate.useMutation({
    onSuccess: () => employeesQuery.refetch(),
  });

  const activateMutation = trpc.employees.activate.useMutation({
    onSuccess: () => employeesQuery.refetch(),
  });

  const deleteMutation = trpc.employees.delete.useMutation({
    onSuccess: () => {
      employeesQuery.refetch();
      setEmployeeToDelete(null);
    },
  });

  const handleAddEmployee = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newEmployee.name.trim()) return;
    const normalizedPosition = newEmployee.position.trim() || "Vendedor";
    createMutation.mutate({
      companyId: COMPANY_ID,
      ...newEmployee,
      position: normalizedPosition,
    });
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  const employees = (employeesQuery.data as any)?.employees ?? [];
  const totalEmployees = (employeesQuery.data as any)?.total ?? 0;
  const activeEmployees = useMemo(() => employees.filter((e: any) => e.isActive), [employees]);
  // Removed unused inactiveEmployees

  const activationRate = totalEmployees > 0 ? Math.round((activeEmployees.length / totalEmployees) * 100) : 0;

  // Spotlight Logic
  useEffect(() => {
    if (activeEmployees.length === 0) return;
    const interval = window.setInterval(() => {
      setSpotlightIndex((prev) => (prev + 1) % activeEmployees.length);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [activeEmployees.length]);

  const spotlightEmployee = activeEmployees.length > 0 ? activeEmployees[spotlightIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <SensitiveSection>

          {/* --- Hero Section --- */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[2.5rem] bg-slate-900 shadow-2xl"
          >
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-purple-600/90 to-blue-600/90" />

            {/* Animated Background Blobs */}
            <div className="absolute inset-0 overflow-hidden">
              <motion.div
                animate={{
                  x: [0, 50, 0],
                  y: [0, 30, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/30 rounded-full blur-3xl"
              />
              <motion.div
                animate={{
                  x: [0, -30, 0],
                  y: [0, 50, 0],
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-1/2 right-0 w-80 h-80 bg-purple-500/30 rounded-full blur-3xl"
              />
            </div>

            <div className="relative z-10 p-8 md:p-12 lg:p-16 flex flex-col lg:flex-row gap-12 items-center justify-between">
              <div className="max-w-2xl space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/90 text-sm font-medium"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Gestão Inteligente de Pessoas</span>
                </motion.div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
                  Sua equipe, <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-200">
                    potencializada.
                  </span>
                </h1>

                <p className="text-lg text-blue-100/80 max-w-lg leading-relaxed">
                  Gerencie talentos, acompanhe métricas e impulsione resultados com uma visão 360º do seu time.
                </p>

                <div className="flex flex-wrap gap-4 pt-4">
                  <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Ativação</p>
                      <p className="text-xl font-bold text-white">{activationRate}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-white/60 uppercase tracking-wider font-semibold">Total</p>
                      <p className="text-xl font-bold text-white">{totalEmployees}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spotlight Card */}
              <AnimatePresence mode="wait">
                {spotlightEmployee && (
                  <motion.div
                    key={spotlightEmployee.id}
                    initial={{ opacity: 0, scale: 0.9, rotate: 2 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.9, rotate: -2 }}
                    transition={{ type: "spring", duration: 0.6 }}
                  >
                    <div
                      className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl relative group cursor-pointer hover:bg-white/15 transition-colors"
                      onClick={() => navigate(`/employees/${spotlightEmployee.id}`)}
                    >
                      <div className="flex justify-end items-center gap-3 mb-4">
                        <SensitiveSectionToggleButton className="bg-white/20 border-white/20 text-white hover:bg-white/30 hover:border-white/40 transition-all" />
                        <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Destaque
                        </div>
                      </div>

                      <div className="flex items-center gap-5 mb-6">
                        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${getVisualToken(0).gradient} shadow-lg flex items-center justify-center text-3xl font-bold text-white shrink-0`}>
                          {getInitials(spotlightEmployee.name)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-xl font-bold text-white leading-tight mb-1 truncate pr-2">{spotlightEmployee.name}</h3>
                          <p className="text-white/70 text-sm font-medium truncate">{spotlightEmployee.position || 'Colaborador'}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden flex flex-col justify-center">
                          <p className="text-[10px] sm:text-xs text-white/60 uppercase font-bold tracking-wider mb-1 truncate">Total (Mês)</p>
                          {(() => {
                            const val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(spotlightEmployee.totalMonthSales ?? 0);
                            // Dynamic font size based on character count
                            // <= 10 chars (e.g. R$ 500,00): text-2xl
                            // 11-13 chars (e.g. R$ 50.000,00): text-xl
                            // > 13 chars (e.g. R$ 100.000,00): text-lg
                            const sizeClass = val.length > 13 ? "text-lg" : val.length > 10 ? "text-xl" : "text-2xl";
                            return (
                              <SensitiveValue className={`${sizeClass} font-bold text-white block truncate w-full tracking-tight`}>
                                {val}
                              </SensitiveValue>
                            );
                          })()}
                        </div>
                        <div className="bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-sm overflow-hidden flex flex-col justify-center">
                          <p className="text-[10px] sm:text-xs text-white/60 uppercase font-bold tracking-wider mb-1 truncate">Última Venda</p>
                          {spotlightEmployee.lastSale ? (() => {
                            const val = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(spotlightEmployee.lastSale.amount));
                            const sizeClass = val.length > 13 ? "text-lg" : val.length > 10 ? "text-xl" : "text-2xl";
                            return (
                              <>
                                <SensitiveValue className={`${sizeClass} font-bold text-white block truncate w-full tracking-tight`}>
                                  {val}
                                </SensitiveValue>
                                <p className="text-[10px] text-white/50 mt-0.5 font-medium truncate">
                                  {new Date(spotlightEmployee.lastSale.date).toLocaleDateString('pt-BR')}
                                </p>
                              </>
                            );
                          })() : (
                            <p className="text-sm font-medium text-white/40 mt-1">—</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>

          {/* --- Controls Section --- */}
          <section className="sticky top-4 z-30 bg-white/80 backdrop-blur-xl border border-white/40 shadow-lg shadow-slate-200/50 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome, cargo..."
                className="pl-10 h-11 bg-slate-50 border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20 rounded-xl transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  onClick={() => setViewMode('mosaic')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'mosaic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <ListIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="h-8 w-px bg-slate-200 mx-1 shrink-0" />

              <SensitiveSectionToggleButton
                showLabel={false}
                className="h-11 w-11 justify-center rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm shrink-0"
              />

              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="h-11 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all shrink-0"
              >
                <Plus className="w-5 h-5 mr-2" />
                Novo Colaborador
              </Button>
            </div>
          </section>

          {/* --- Content Section --- */}
          <AnimatePresence mode="wait">
            {employeesQuery.isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse">
                    <div className="flex gap-4 mb-6">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl" />
                      <div className="flex-1 space-y-3 pt-2">
                        <div className="h-4 bg-slate-100 rounded w-3/4" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-10 bg-slate-50 rounded-xl" />
                      <div className="h-10 bg-slate-50 rounded-xl" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : employees.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                  <Users className="w-10 h-10 text-indigo-300" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Nenhum colaborador encontrado</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
                  Não encontramos ninguém com os filtros atuais. Tente buscar por outro termo ou adicione um novo membro.
                </p>
                <Button onClick={() => setIsAddModalOpen(true)} variant="outline" className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                  Adicionar membro
                </Button>
              </motion.div>
            ) : viewMode === 'mosaic' ? (
              <motion.div
                key="mosaic"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                {employees.map((employee: any, index: number) => {
                  const token = getVisualToken(index);
                  return (
                    <motion.div
                      key={employee.id}
                      variants={itemVariants}
                      layoutId={employee.id}
                      className="group relative bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                    >
                      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${token.gradient} opacity-[0.03] rounded-bl-[4rem] transition-opacity group-hover:opacity-[0.08]`} />

                      <div className="flex items-start justify-between mb-6 relative">
                        <div
                          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${token.gradient} shadow-lg flex items-center justify-center text-2xl font-bold text-white transform group-hover:scale-110 transition-transform duration-300`}
                        >
                          {getInitials(employee.name)}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${employee.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                          {employee.isActive ? 'Ativo' : 'Inativo'}
                        </div>
                      </div>

                      <div className="mb-6 relative">
                        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{employee.name}</h3>
                        <p className="text-slate-500 text-sm font-medium flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5" />
                          {employee.position || 'Sem cargo'}
                        </p>
                      </div>

                      <div className="space-y-3 relative">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-indigo-50/50 transition-colors">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Total (Mês)</p>
                            <SensitiveValue className="text-sm font-bold text-slate-900 text-ellipsis overflow-hidden">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(employee.totalMonthSales ?? 0)}
                            </SensitiveValue>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 group-hover:bg-indigo-50/50 transition-colors">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Última Venda</p>
                            {employee.lastSale ? (
                              <div>
                                <SensitiveValue className="text-sm font-bold text-slate-900 text-ellipsis overflow-hidden">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(employee.lastSale.amount))}
                                </SensitiveValue>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {new Date(employee.lastSale.date).toLocaleDateString('pt-BR')}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 font-medium mt-1">—</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-3">
                        <Button
                          onClick={() => navigate(`/employees/${employee.id}`)}
                          className="flex-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 h-10 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md"
                        >
                          Ver Perfil
                        </Button>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => (employee.isActive ? deactivateMutation : activateMutation).mutate({ id: employee.id })}
                            className={`p-2.5 rounded-xl transition-all shadow-sm hover:shadow-md ${employee.isActive
                              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            title={employee.isActive ? "Desativar" : "Ativar"}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEmployeeToDelete(employee.id)}
                            className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all shadow-sm hover:shadow-md"
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="table"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Colaborador</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Cargo</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Vendas (Mês)</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Última Venda</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs">Status</th>
                        <th className="px-6 py-4 font-semibold text-slate-500 uppercase tracking-wider text-xs text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {employees.map((employee: any) => (
                        <tr key={employee.id} className="group hover:bg-indigo-50/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                                {getInitials(employee.name)}
                              </div>
                              <span className="font-medium text-slate-900">{employee.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{employee.position || '—'}</td>
                          <td className="px-6 py-4 text-slate-900 font-bold">
                            <SensitiveValue>
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(employee.totalMonthSales ?? 0)}
                            </SensitiveValue>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {employee.lastSale ? (
                              <div className="flex flex-col text-xs">
                                <SensitiveValue className="font-bold text-slate-900">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(employee.lastSale.amount))}
                                </SensitiveValue>
                                <span className="text-slate-400">{new Date(employee.lastSale.date).toLocaleDateString('pt-BR')}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${employee.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                              {employee.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/employees/${employee.id}`)}
                              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SensitiveSection>
      </main>

      {/* --- Add Employee Modal --- */}
      <AnimatePresence>
        {
          isAddModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseAddModal}
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40"
              />
              <motion.div
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl pointer-events-auto overflow-hidden">
                  <div className="p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">Novo Colaborador</h2>
                        <p className="text-slate-500 text-sm">Preencha os dados para adicionar à equipe.</p>
                      </div>
                      <button
                        onClick={handleCloseAddModal}
                        className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    <form onSubmit={handleAddEmployee} className="space-y-5">
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">Nome Completo</label>
                        <div className="relative">
                          <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <Input
                            placeholder="Ex: Ana Silva"
                            value={newEmployee.name}
                            onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                            className="pl-12 h-12 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 ml-1">Cargo</label>
                          <div className="relative">
                            <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                              placeholder="Ex: Vendedor"
                              value={newEmployee.position}
                              onChange={(e) => setNewEmployee({ ...newEmployee, position: e.target.value })}
                              className="pl-12 h-12 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 ml-1">Telefone</label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                              placeholder="(00) 00000-0000"
                              value={newEmployee.phone}
                              onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                              className="pl-12 h-12 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-slate-700 ml-1">E-mail</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          <Input
                            type="email"
                            placeholder="ana@empresa.com"
                            value={newEmployee.email}
                            onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                            className="pl-12 h-12 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500/20"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button
                          type="submit"
                          disabled={createMutation.isPending || isSuccess}
                          className={`w-full h-12 rounded-xl font-semibold shadow-lg transition-all ${isSuccess
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/30"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/30 hover:shadow-indigo-500/40"
                            }`}
                        >
                          {isSuccess ? (
                            <span className="flex items-center gap-2">
                              <Check className="w-5 h-5" />
                              Cadastrado!
                            </span>
                          ) : createMutation.isPending ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Salvando...
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              <UserPlus className="w-5 h-5" />
                              Cadastrar Colaborador
                            </span>
                          )}
                        </Button>
                      </div>
                    </form>
                  </div>
                  <div className="bg-slate-50 p-4 text-center text-xs text-slate-400 border-t border-slate-100">
                    Pressione ESC para cancelar
                  </div>
                </div>
              </motion.div>
            </>
          )
        }
      </AnimatePresence >

      {/* --- Delete Confirmation Modal --- */}
      <AnimatePresence>
        {employeeToDelete && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEmployeeToDelete(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50"
            />
            <motion.div
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl pointer-events-auto overflow-hidden">
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-rose-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Tem certeza?</h3>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Essa ação removerá permanentemente o colaborador e pode afetar o histórico se houver vendas vinculadas.
                    <br />
                    <span className="font-semibold text-rose-600 mt-2 block">Recomendamos apenas desativar.</span>
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setEmployeeToDelete(null)}
                      className="h-11 rounded-xl border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => employeeToDelete && deleteMutation.mutate({ id: employeeToDelete })}
                      disabled={deleteMutation.isPending}
                      className="h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-500/30"
                    >
                      {deleteMutation.isPending ? "Removendo..." : "Sim, remover"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div >
  );
}
