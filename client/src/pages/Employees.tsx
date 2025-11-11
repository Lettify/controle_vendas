import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";

const COMPANY_ID = "default-company";

const VISUAL_PALETTE = [
  {
    gradient: "from-violet-500 via-indigo-500 to-sky-500",
    soft: "bg-indigo-50/70",
    accent: "text-indigo-200",
    border: "border-indigo-200/70",
    beam: "from-indigo-400/40 via-transparent to-transparent",
  },
  {
    gradient: "from-emerald-400 via-emerald-500 to-teal-500",
    soft: "bg-emerald-50/70",
    accent: "text-emerald-200",
    border: "border-emerald-200/70",
    beam: "from-emerald-400/35 via-transparent to-transparent",
  },
  {
    gradient: "from-rose-500 via-pink-500 to-orange-500",
    soft: "bg-rose-50/70",
    accent: "text-rose-200",
    border: "border-rose-200/70",
    beam: "from-rose-400/35 via-transparent to-transparent",
  },
  {
    gradient: "from-blue-500 via-sky-500 to-cyan-500",
    soft: "bg-sky-50/70",
    accent: "text-sky-200",
    border: "border-sky-200/70",
    beam: "from-sky-400/35 via-transparent to-transparent",
  },
  {
    gradient: "from-amber-400 via-orange-500 to-red-500",
    soft: "bg-amber-50/70",
    accent: "text-amber-100",
    border: "border-amber-200/70",
    beam: "from-amber-400/30 via-transparent to-transparent",
  },
  {
    gradient: "from-slate-500 via-gray-500 to-zinc-500",
    soft: "bg-slate-50/70",
    accent: "text-slate-200",
    border: "border-slate-200/70",
    beam: "from-slate-400/35 via-transparent to-transparent",
  },
] as const;

const MAP_VISUAL_THRESHOLD = 12;

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

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export default function Employees() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [newEmployee, setNewEmployee] = useState({ name: "", email: "", phone: "", position: "" });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'mosaic' | 'table'>('mosaic');
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const flowSectionRef = useRef<HTMLElement | null>(null);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    setNewEmployee({ name: "", email: "", phone: "", position: "" });
  }, []);

  const employeesQuery = trpc.employees.list.useQuery({ companyId: COMPANY_ID });
  const createMutation = trpc.employees.create.useMutation({
    onSuccess: () => {
      handleCloseAddModal();
      employeesQuery.refetch();
    },
  });

  const deactivateMutation = trpc.employees.deactivate.useMutation({
    onSuccess: () => employeesQuery.refetch(),
  });

  const activateMutation = trpc.employees.activate.useMutation({
    onSuccess: () => employeesQuery.refetch(),
  });

  const deleteMutation = trpc.employees.delete.useMutation({
    onSuccess: () => employeesQuery.refetch(),
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

  const employees = employeesQuery.data ?? [];
  const totalEmployees = employees.length;

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive),
    [employees]
  );

  const inactiveEmployees = useMemo(
    () => employees.filter((employee) => !employee.isActive),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    if (employees.length === 0) return [];
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesStatus =
        statusFilter === 'all' ? true : statusFilter === 'active' ? employee.isActive : !employee.isActive;

      if (!matchesStatus) return false;

      if (!normalizedTerm) return true;

      const haystack = [employee.name, employee.email, employee.position]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());

      return haystack.some((value) => value.includes(normalizedTerm));
    });
  }, [employees, searchTerm, statusFilter]);

  const activationRate = totalEmployees > 0 ? Math.round((activeEmployees.length / totalEmployees) * 100) : 0;
  const inactivityRate = totalEmployees > 0 ? Math.round((inactiveEmployees.length / totalEmployees) * 100) : 0;

  const topPositions = useMemo(() => {
    const counts = new Map<string, number>();
    employees.forEach((employee) => {
      const key = employee.position?.trim() || "Sem cargo definido";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [employees]);

  const spotlightEmployee = activeEmployees.length > 0
    ? activeEmployees[spotlightIndex % activeEmployees.length]
    : undefined;

  const spotlightToken = useMemo(() => {
    if (!spotlightEmployee) return getVisualToken(0);
    const index = employees.findIndex((employee) => employee.id === spotlightEmployee.id);
    return getVisualToken(index >= 0 ? index : 0);
  }, [spotlightEmployee, employees]);

  useEffect(() => {
    if (activeEmployees.length === 0) return;
    const interval = window.setInterval(() => {
      setSpotlightIndex((previous) => (previous + 1) % activeEmployees.length);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [activeEmployees.length]);

  useEffect(() => {
    setSpotlightIndex(0);
  }, [activeEmployees.length]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = previousOverflow;
    };
  }, [isAddModalOpen]);

  useEffect(() => {
    if (!isAddModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseAddModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddModalOpen, handleCloseAddModal]);

  const dnaSegments = useMemo(
    () => employees.map((employee, index) => ({ employee, token: getVisualToken(index) })),
    [employees]
  );

  const isLoading = employeesQuery.isLoading;
  const hasGlobalEmptyState = !isLoading && employees.length === 0;
  const hasFilteredEmptyState = !isLoading && employees.length > 0 && filteredEmployees.length === 0;

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter('all');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Navbar title="Equipe" showUserInfo={true} />

      <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 space-y-10">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-600 to-blue-700 text-white shadow-2xl">
          <div className="absolute inset-0 opacity-50">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={`absolute rounded-full blur-3xl bg-white/20 ${index % 2 === 0 ? 'w-48 h-48' : 'w-32 h-32'}`}
                style={{
                  top: `${index * 18 + 8}%`,
                  left: index % 2 === 0 ? `${index * 12}%` : 'auto',
                  right: index % 2 === 0 ? 'auto' : `${index * 14}%`,
                }}
              />
            ))}
          </div>

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between px-6 py-10 sm:px-10 lg:px-14">
            <div className="max-w-2xl space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white/80">
                <span className="inline-block h-2 w-2 rounded-full bg-lime-300 animate-pulse" />
                Painel de pessoas • Indicadores em tempo real
              </span>
              <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-[2.7rem]">
                Gestão de pessoas com inteligência acionável
              </h1>
              <p className="text-sm sm:text-base text-white/85">
                Acompanhe indicadores críticos, identifique tendências e tome decisões com uma visão estruturada e atualizada da equipe.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-white/12 p-5 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Taxa de ativação</p>
                  <p className="mt-3 text-3xl font-extrabold">{activationRate}%</p>
                  <div className="mt-4 h-2 w-full rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-lime-300 via-emerald-300 to-sky-300"
                      style={{ width: `${clampPercentage(activationRate)}%` }}
                    />
                  </div>
                  <span className="mt-3 block text-[11px] font-semibold text-white/65">
                    {activeEmployees.length} colaboradores ativos
                  </span>
                </div>

                <div className="rounded-2xl bg-white/12 p-5 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Engajamento da equipe</p>
                  <p className="mt-3 text-3xl font-extrabold">{inactiveEmployees.length}</p>
                  <span className="text-sm font-semibold text-white/75">Inativos no momento</span>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-white/65">
                    <span>Ativos • {activationRate}%</span>
                    <span>Inativos • {inactivityRate}%</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-white/12 p-5 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Função mais frequente</p>
                  <p className="mt-3 text-xl font-extrabold">
                    {topPositions.length > 0 ? topPositions[0][0] : 'Defina cargos'}
                  </p>
                  <p className="text-sm font-semibold text-white/80">
                    {topPositions.length > 0 ? `${topPositions[0][1]} colaboradores nessa função` : 'Defina cargos para gerar indicadores'}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-white/65">
                    <span>Outras funções:</span>
                    <div className="inline-flex items-center gap-1">
                      {topPositions.slice(1).map(([role]) => (
                        <span key={role} className="rounded-full bg-white/15 px-2 py-0.5 font-semibold">
                          {role}
                        </span>
                      ))}
                      {topPositions.length <= 1 && <span className="italic text-white/50">aguardando novos registros</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full max-w-sm rounded-3xl border border-white/20 bg-white/12 p-6 shadow-2xl backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/70">Destaque automático</p>
              <h2 className="mt-2 text-lg font-bold text-white">
                {spotlightEmployee ? spotlightEmployee.name : 'Cadastre colaboradores ativos para iniciar o destaque'}
              </h2>
              <p className="text-sm text-white/80">
                {spotlightEmployee
                  ? spotlightEmployee.position || 'Cargo não informado'
                  : 'A adição de novos registros libera esta área automaticamente.'}
              </p>

              <div className="mt-6 flex items-center gap-4">
                <div className={`relative h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br ${spotlightToken.gradient} shadow-xl`}>
                  <span className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-white">
                    {spotlightEmployee ? getInitials(spotlightEmployee.name) : '??'}
                  </span>
                  <div className="absolute -bottom-2 -right-2 h-7 w-7 rounded-full bg-white/95 text-indigo-600 shadow-lg">
                    <div className="flex h-full w-full items-center justify-center text-[11px] font-black">
                      {activeEmployees.length || 0}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-white/75">
                  <p className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-lime-300 animate-pulse" />
                    {spotlightEmployee ? 'Em destaque' : 'Aguardando próximo destaque'}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-white/60" />
                    {totalEmployees} profissionais conectados
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="inline-flex h-2 w-2 rounded-full bg-white/40" />
                    Rotação automática a cada 7 segundos
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  className="text-white/85 hover:bg-white/10"
                  onClick={() => {
                    flowSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                >
                  Ver painel de talentos
                </Button>
                {spotlightEmployee && (
                  <Button
                    variant="outline"
                    className="border-white/40 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => navigate(`/employees/${spotlightEmployee.id}`)}
                  >
                    Abrir perfil
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-indigo-100 bg-white/90 p-6 backdrop-blur shadow-xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-indigo-900">Painel de gestão da equipe</h2>
              <p className="text-sm text-indigo-600">
                Controle filtros, cadastre novos colaboradores e alterne entre visualizações conforme a necessidade.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg hover:from-indigo-700 hover:to-purple-700"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Adicionar colaborador
              </Button>

              <div className="flex items-center gap-1 rounded-xl border border-indigo-100 bg-indigo-50/80 p-1">
                <button
                  onClick={() => setViewMode('mosaic')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'mosaic'
                      ? 'bg-white text-indigo-600 shadow'
                      : 'text-indigo-500 hover:bg-white/60 hover:text-indigo-700'
                  }`}
                >
                  Visão cartões
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    viewMode === 'table'
                      ? 'bg-white text-indigo-600 shadow'
                      : 'text-indigo-500 hover:bg-white/60 hover:text-indigo-700'
                  }`}
                >
                  Visão tabela
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.5fr)_minmax(0,1.5fr)]">
            <div className="lg:col-span-3">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Buscar por nome, cargo ou e-mail
              </label>
              <div className="relative">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Ex: Ana, Inside Sales, ana@empresa.com"
                  className="h-12 rounded-xl border-indigo-100 bg-white pr-12 text-indigo-900 shadow-sm focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-300 hover:text-indigo-500"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex h-full flex-col gap-2 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Status</span>
              <div className="grid grid-cols-3 gap-2">
                {(['all', 'active', 'inactive'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setStatusFilter(option)}
                    className={`w-full min-w-0 rounded-xl px-3 py-2 text-xs font-semibold uppercase text-center transition ${
                      statusFilter === option
                        ? 'bg-white text-indigo-600 shadow'
                        : 'text-indigo-400 hover:bg-white/60 hover:text-indigo-600'
                    }`}
                  >
                    {option === 'all' ? 'Todos' : option === 'active' ? 'Ativos' : 'Inativos'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-indigo-500">
                {filteredEmployees.length} resultado{filteredEmployees.length === 1 ? '' : 's'} visíveis agora.
              </span>
            </div>

            <div className="h-full rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Resumo rápido</span>
              <div className="mt-3 space-y-2 text-sm text-indigo-700">
                <p className="flex items-center justify-between">
                  <span>Base total</span>
                  <strong>{totalEmployees}</strong>
                </p>
                <p className="flex items-center justify-between">
                  <span>Taxa ativa</span>
                  <strong>{activationRate}%</strong>
                </p>
                <p className="flex items-center justify-between">
                  <span>Funções mapeadas</span>
                  <strong>{topPositions.length}</strong>
                </p>
              </div>
            </div>
          </div>
        </section>
        {totalEmployees > 0 && filteredEmployees.length > 0 && (
          <section ref={flowSectionRef} className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold text-indigo-900">Painel dinâmico de talentos</h2>
                <p className="text-sm text-indigo-600">Arraste para navegar pelos colaboradores e acessar informações essenciais rapidamente.</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-indigo-500">
                <span>{filteredEmployees.length} perfis na visualização</span>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{new Date().toLocaleDateString('pt-BR')}</span>
                <span className="rounded-full border border-indigo-100 bg-indigo-50/70 px-3 py-1 text-[11px] font-semibold text-indigo-600">
                  {totalEmployees} colaboradores cadastrados
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-3xl border border-indigo-100 bg-white/80 backdrop-blur shadow-xl">
              <div className="flex min-w-max items-stretch gap-5 px-6 py-6">
                {filteredEmployees.map((employee, index) => {
                  const token = getVisualToken(index);
                  return (
                    <div
                      key={employee.id}
                      className="group relative flex w-[240px] flex-col overflow-hidden rounded-3xl border border-indigo-100/60 bg-white/80 shadow-lg transition-transform hover:-translate-y-1 hover:shadow-2xl"
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${token.gradient} opacity-20`} />
                      <div className="relative flex-1 space-y-4 p-5">
                        <div className={`h-14 w-14 rounded-2xl bg-gradient-to-br ${token.gradient} shadow-xl`}>
                          <span className="flex h-full w-full items-center justify-center text-lg font-black text-white">
                            {getInitials(employee.name)}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <p className="text-base font-semibold text-slate-900 line-clamp-2">
                            {employee.name}
                          </p>
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {employee.position || 'Cargo não informado'}
                          </p>
                          <div className="rounded-xl bg-slate-100/60 p-3 text-xs text-slate-600">
                            <p className="truncate">{employee.email || 'E-mail não informado'}</p>
                            <p className="mt-1 font-semibold text-slate-500">
                              {employee.phone || 'Telefone pendente'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-indigo-100/70 bg-white/70 p-4 text-xs font-semibold text-indigo-600">
                        <span className="inline-flex items-center gap-2">
                          <span className={`inline-flex h-2 w-2 rounded-full ${employee.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                          {employee.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                        <button
                          onClick={() => navigate(`/employees/${employee.id}`)}
                          className="inline-flex items-center gap-1 text-indigo-500 hover:text-indigo-700"
                        >
                          Ver
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {totalEmployees >= MAP_VISUAL_THRESHOLD && (
              <div className="mt-10 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-indigo-900">Mapa visual da equipe</h3>
                    <p className="text-sm text-indigo-600">Visualize padrões de equipe e identifique rapidamente cada colaborador.</p>
                  </div>
                  <span className="rounded-full border border-indigo-100 bg-indigo-50/70 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                    {totalEmployees} colaboradores mapeados
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
                  {dnaSegments.slice(0, 24).map(({ employee, token }, index) => (
                    <div
                      key={employee.id}
                      className={`relative overflow-hidden rounded-2xl border ${token.border} bg-gradient-to-br ${token.gradient} p-4 text-white shadow-lg transition-transform hover:-translate-y-1`}
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-white/80">
                        {getInitials(employee.name)}
                      </span>
                      <p className="mt-2 text-[11px] text-white/70 line-clamp-2">{employee.name}</p>
                      <span className="absolute bottom-2 right-3 text-[10px] font-semibold text-white/60">#{index + 1}</span>
                    </div>
                  ))}
                </div>

                {dnaSegments.length > 24 && (
                  <p className="mt-2 text-xs text-indigo-500">
                    +{dnaSegments.length - 24} colaboradores aguardando exibição.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {isLoading && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-3xl border border-indigo-100 bg-white/80 p-6">
                <div className="mb-4 h-12 w-12 rounded-2xl bg-indigo-100" />
                <div className="mb-2 h-4 rounded bg-indigo-100/80" />
                <div className="mb-6 h-3 rounded bg-indigo-100/60" />
                <div className="h-10 rounded-xl bg-indigo-50/70" />
              </div>
            ))}
          </div>
        )}

        {hasGlobalEmptyState && (
          <Card className="border-2 border-dashed border-indigo-200 bg-white/95 text-center shadow-xl">
            <CardContent className="py-16">
              <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-50/80">
                <svg className="h-10 w-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mt-6 text-2xl font-bold text-indigo-900">Cadastre os primeiros colaboradores</h3>
              <p className="mt-3 text-sm text-indigo-600">
                Inclua o primeiro registro para liberar os módulos de visualização, destaque automático e mapa da equipe.
              </p>
              <Button
                onClick={() => setIsAddModalOpen(true)}
                className="mt-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Cadastrar colaborador
              </Button>
            </CardContent>
          </Card>
        )}

        {hasFilteredEmptyState && (
          <Card className="border border-rose-100 bg-white/95 text-center shadow-xl">
            <CardContent className="py-14">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-50/80">
                <svg className="h-9 w-9 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-5 text-xl font-bold text-rose-600">Nenhum resultado com esses filtros</h3>
              <p className="mt-2 text-sm text-rose-500">
                Ajuste os filtros ou reinicie a busca para visualizar novamente toda a equipe.
              </p>
              <Button
                onClick={resetFilters}
                className="mt-5 bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg hover:from-rose-600 hover:to-rose-700"
              >
                Limpar filtros
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !hasGlobalEmptyState && !hasFilteredEmptyState && (
          <section>
            {viewMode === 'mosaic' ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredEmployees.map((employee, index) => {
                  const token = getVisualToken(index);
                  const isActive = employee.isActive;

                  return (
                    <Card
                      key={employee.id}
                      className={`relative overflow-hidden rounded-3xl border ${isActive ? 'border-indigo-100' : 'border-slate-200/80'} bg-white/90 backdrop-blur shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${
                        isActive ? '' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${token.gradient} opacity-10`} />
                      <CardContent className="relative space-y-5 p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${token.gradient} shadow-xl`}>
                            <span className="flex h-full w-full items-center justify-center text-xl font-black text-white">
                              {getInitials(employee.name)}
                            </span>
                          </div>
                          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                            {isActive ? 'Ativo' : 'Em pausa'}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold text-slate-900">{employee.name}</h3>
                          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                            {employee.position || 'Função em definição'}
                          </p>
                        </div>

                        <div className="grid gap-3 rounded-2xl border border-indigo-50 bg-indigo-50/60 p-4 text-sm text-slate-600">
                          <p className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/80 text-indigo-500">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </span>
                            {employee.email || 'E-mail não informado'}
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-white/80 text-indigo-500">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </span>
                            {employee.phone || 'Telefone não informado'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/employees/${employee.id}`)}
                            className="flex-1 rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            Ver trajetória
                          </Button>
                          {isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deactivateMutation.mutate({ id: employee.id })}
                              disabled={deactivateMutation.isPending}
                              className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700"
                            >
                              Pausar
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => activateMutation.mutate({ id: employee.id })}
                              disabled={activateMutation.isPending}
                              className="rounded-xl border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              Reativar
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Remover ${employee.name}? Essa ação é permanente.`)) {
                                deleteMutation.mutate({ id: employee.id });
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                          >
                            Remover
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-xl">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50/80">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-6 py-4">Colaborador</th>
                          <th className="px-6 py-4">Função</th>
                          <th className="px-6 py-4">Contato</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Comandos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-sm">
                        {filteredEmployees.map((employee, index) => {
                          const token = getVisualToken(index);
                          return (
                            <tr key={employee.id} className="hover:bg-slate-50/70">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${token.gradient} text-white shadow`}> 
                                    <span className="flex h-full w-full items-center justify-center text-sm font-bold">
                                      {getInitials(employee.name)}
                                    </span>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-900">{employee.name}</p>
                                    <p className="text-xs text-slate-500">ID • {employee.id.slice(0, 8)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {employee.position ? (
                                  <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                                    {employee.position}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Defina uma função</span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1 text-xs text-slate-600">
                                  <p>{employee.email || 'E-mail pendente'}</p>
                                  <p>{employee.phone || 'Telefone pendente'}</p>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                                  employee.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <span className={`h-2 w-2 rounded-full ${employee.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                                  {employee.isActive ? 'Ativo' : 'Inativo'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(`/employees/${employee.id}`)}
                                    className="text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                                  >
                                    Ver
                                  </Button>
                                  {employee.isActive ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => deactivateMutation.mutate({ id: employee.id })}
                                      disabled={deactivateMutation.isPending}
                                      className="text-orange-500 hover:bg-orange-50 hover:text-orange-700"
                                    >
                                      Pausar
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => activateMutation.mutate({ id: employee.id })}
                                      disabled={activateMutation.isPending}
                                      className="text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
                                    >
                                      Ativar
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      if (confirm(`Remover ${employee.name}? Essa ação não pode ser desfeita.`)) {
                                        deleteMutation.mutate({ id: employee.id });
                                      }
                                    }}
                                    disabled={deleteMutation.isPending}
                                    className="text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    Remover
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {isAddModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm px-4 py-6"
            onClick={handleCloseAddModal}
          >
            <div
              role="dialog"
              aria-modal="true"
              className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl ring-1 ring-indigo-100/70"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-indigo-100 px-6 py-5">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-indigo-900">Cadastrar colaborador</h2>
                  <p className="text-sm text-slate-500">
                    Preencha as informações do colaborador para registrar na base da equipe.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="rounded-xl border border-slate-200/80 p-2 text-slate-400 transition hover:border-slate-300 hover:text-slate-500"
                  aria-label="Fechar modal"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 pb-6 pt-5">
                <form onSubmit={handleAddEmployee} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-indigo-900">Nome completo *</label>
                      <Input
                        placeholder="Ex: Maria Santos"
                        value={newEmployee.name}
                        onChange={(event) => setNewEmployee({ ...newEmployee, name: event.target.value })}
                        className="h-11 rounded-xl border-indigo-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-indigo-900">Cargo / Squad</label>
                      <Input
                        placeholder="Ex: Growth Specialist"
                        value={newEmployee.position}
                        onChange={(event) => setNewEmployee({ ...newEmployee, position: event.target.value })}
                        className="h-11 rounded-xl border-indigo-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-indigo-900">E-mail profissional</label>
                      <Input
                        type="email"
                        placeholder="nome@empresa.com"
                        value={newEmployee.email}
                        onChange={(event) => setNewEmployee({ ...newEmployee, email: event.target.value })}
                        className="h-11 rounded-xl border-indigo-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-indigo-900">Contato direto</label>
                      <Input
                        placeholder="(11) 99999-9999"
                        value={newEmployee.phone}
                        onChange={(event) => setNewEmployee({ ...newEmployee, phone: event.target.value })}
                        className="h-11 rounded-xl border-indigo-100 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseAddModal}
                      className="rounded-xl border-indigo-100 text-indigo-700 hover:bg-indigo-50"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700"
                    >
                      {createMutation.isPending ? (
                        <>
                          <svg className="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Salvando colaborador…
                        </>
                      ) : (
                        <>
                          <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Salvar colaborador
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
