import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { SensitiveSection, SensitiveSectionToggleButton, SensitiveValue } from "@/components/SensitiveValue";
import { AutoResizeText } from "@/components/AutoResizeText";
import { usePageHeader } from "@/contexts/PageHeaderContext";

const COMPANY_ID = "default-company";

// Função para obter data no formato YYYY-MM-DD sem problemas de timezone
function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { setTitle, setShowUserInfo } = usePageHeader();

  useEffect(() => {
    setTitle("Controle de Vendas");
    setShowUserInfo(true);
  }, [setShowUserInfo, setTitle]);

  // Buscar dados do mês atual
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const totalSalesQuery = trpc.sales.getTotalByCompanyInMonth.useQuery({
    companyId: COMPANY_ID,
    year: currentYear,
    month: currentMonth,
  });

  const employeesQuery = trpc.employees.listActive.useQuery({ companyId: COMPANY_ID });

  // Buscar vendas recentes (últimos 7 dias)
  const endDate = getLocalDateString(now);
  const startDate = getLocalDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const recentSalesQuery = trpc.sales.getByCompany.useQuery({
    companyId: COMPANY_ID,
    startDate,
    endDate,
  });

  if (!user) {
    navigate("/login");
    return null;
  }

  const totalSales = totalSalesQuery.data ?? 0;
  const activeEmployees = employeesQuery.data?.length || 0;
  const recentSalesCount = recentSalesQuery.data?.length || 0;
  const averageTicketPerEmployee = activeEmployees > 0 ? totalSales / activeEmployees : 0;
  const greeting = getGreeting(now);
  const firstName = user.name?.split(" ")[0] ?? user.name;
  const todayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(now);

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-cyan-50">
      <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8 lg:py-10 space-y-6 sm:space-y-8 lg:space-y-10">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-700 via-emerald-500 to-teal-600 shadow-xl text-white sm:rounded-3xl">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-12 -right-8 h-40 w-40 rounded-full bg-white/20 blur-2xl sm:-top-24 sm:-right-16 sm:h-72 sm:w-72 sm:blur-3xl" />
            <div className="absolute top-20 -left-10 h-32 w-32 rounded-full bg-teal-200/30 blur-2xl sm:top-32 sm:-left-20 sm:h-56 sm:w-56 sm:blur-3xl" />
          </div>
          <div className="relative px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 lg:px-14 lg:py-16">
            <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl space-y-3 sm:space-y-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-white/90 backdrop-blur-sm sm:gap-2 sm:px-4 sm:py-1 sm:text-sm">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-lime-300 sm:h-2 sm:w-2" />
                  Painel atualizado • {todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1)}
                </span>
                <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl md:text-[2.5rem] lg:text-[2.75rem]">
                  {greeting}, {firstName}! Pronto para acelerar as vendas hoje?
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-white/90">
                  Você tem visão completa do desempenho da equipe, acessos rápidos para gerir o dia a dia e relatórios prontos para compartilhar com o time.
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <Button
                    onClick={() => navigate("/sales")}
                    className="group rounded-full bg-white/90 px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-lg active:scale-95 active:bg-white sm:px-6 sm:py-2 sm:text-sm sm:hover:bg-white"
                  >
                    Registrar nova venda
                    <svg className="ml-1.5 h-3.5 w-3.5 transition-transform group-active:translate-x-1 sm:ml-2 sm:h-4 sm:w-4 sm:group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                  <button
                    onClick={() => navigate("/statistics")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/60 px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95 active:bg-white/10 sm:gap-2 sm:px-5 sm:py-2 sm:text-sm sm:hover:bg-white/10 sm:hover:shadow-lg"
                  >
                    Ver painel analítico
                    <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                    </svg>
                  </button>
                </div>
              </div>

              <SensitiveSection>
                <div className="grid w-full max-w-sm grid-cols-1 gap-4 rounded-2xl bg-white/10 p-4 shadow-lg backdrop-blur-lg sm:grid-cols-2 sm:p-6">
                  <div className="flex items-center justify-end sm:col-span-2">
                    <SensitiveSectionToggleButton className="border-white/40 bg-white/20 text-white/90 hover:bg-white/30" />
                  </div>
                  <div className="rounded-xl border border-white/25 bg-white/12 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/85">Vendas no mês</p>
                  <p className="mt-2 text-xl font-semibold sm:text-2xl">
                    {totalSalesQuery.isLoading ? (
                      <span className="animate-pulse text-white/80">--</span>
                    ) : (
                      <SensitiveValue className="text-inherit font-inherit" containerClassName="w-full justify-start">
                        <AutoResizeText
                          text={formatCurrency(totalSales)}
                          maxSize={32}
                          minSize={20}
                          className="font-semibold text-white"
                          paddingOffset={10}
                        />
                      </SensitiveValue>
                    )}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-white/80">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" />
                      </svg>
                    </span>
                    {monthNames[currentMonth - 1]} em andamento
                  </p>
                  </div>
                  <div className="rounded-xl border border-white/25 bg-white/12 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/85">Equipe ativa</p>
                  <p className="mt-2 text-xl font-semibold sm:text-2xl">
                    {employeesQuery.isLoading ? (
                      <span className="animate-pulse text-white/80">--</span>
                    ) : (
                      <AutoResizeText
                        text={String(activeEmployees)}
                        maxSize={30}
                        minSize={18}
                        className="font-semibold text-white"
                        paddingOffset={10}
                      />
                    )}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-white/80">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </span>
                    Colaboradores com vendas registradas
                  </p>
                  </div>
                  <div className="rounded-xl border border-white/25 bg-white/12 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/85">Últimos 7 dias</p>
                  <p className="mt-2 text-xl font-semibold sm:text-2xl">
                    {recentSalesQuery.isLoading ? (
                      <span className="animate-pulse text-white/80">--</span>
                    ) : (
                      `${recentSalesCount} vendas`
                    )}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-white/80">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                    Ritmo das vendas nessa semana
                  </p>
                  </div>
                  <div className="rounded-xl border border-white/25 bg-white/12 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-white/85">Ticket médio</p>
                  <p className="mt-2 text-xl font-semibold sm:text-2xl">
                    {totalSalesQuery.isLoading || employeesQuery.isLoading ? (
                      <span className="animate-pulse text-white/80">--</span>
                    ) : (
                      <SensitiveValue className="text-inherit font-inherit" containerClassName="w-full justify-start">
                        <AutoResizeText
                          text={formatCurrency(averageTicketPerEmployee)}
                          maxSize={32}
                          minSize={20}
                          className="font-semibold text-white"
                          paddingOffset={10}
                        />
                      </SensitiveValue>
                    )}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-xs text-white/80">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </span>
                    Valor médio por colaborador
                  </p>
                  </div>
                </div>
              </SensitiveSection>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <SensitiveSection>
              <div className="rounded-2xl border border-emerald-100/80 bg-white/80 p-6 shadow-lg backdrop-blur">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-emerald-700">Radar Operacional</h2>
                    <p className="text-sm text-gray-600">Os principais indicadores do mês em um só lugar.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {monthNames[currentMonth - 1]} / {currentYear}
                    </span>
                    <SensitiveSectionToggleButton className="border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <QuickMetric
                  label="Receita consolidada"
                  value={totalSalesQuery.isLoading ? (
                    <span className="animate-pulse text-slate-400">--</span>
                  ) : (
                    <SensitiveValue className="text-inherit font-inherit" containerClassName="w-fit">
                      <AutoResizeText
                        text={formatCurrency(totalSales)}
                        maxSize={30}
                        minSize={18}
                        className="font-semibold text-slate-900"
                        paddingOffset={10}
                      />
                    </SensitiveValue>
                  )}
                  helper="Atualizado em tempo real"
                  accent="emerald"
                  icon={
                    <svg className="h-4 w-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                />
                <QuickMetric
                  label="Equipe com vendas"
                  value={employeesQuery.isLoading ? (
                    <span className="animate-pulse text-slate-400">--</span>
                  ) : (
                    <AutoResizeText
                      text={`${activeEmployees}`}
                      maxSize={26}
                      minSize={16}
                      className="font-semibold text-slate-900"
                      paddingOffset={10}
                    />
                  )}
                  helper="Colaboradores registrados no mês"
                  accent="teal"
                  icon={
                    <svg className="h-4 w-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                />
                <QuickMetric
                  label="Ritmo semanal"
                  value={recentSalesQuery.isLoading ? (
                    <span className="animate-pulse text-slate-400">--</span>
                  ) : (
                    <AutoResizeText
                      text={`${recentSalesCount} vendas`}
                      maxSize={23}
                      minSize={14}
                      className="font-semibold text-slate-900"
                      paddingOffset={8}
                    />
                  )}
                  helper="Últimos sete dias registrados"
                  accent="sky"
                  icon={
                    <svg className="h-4 w-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h3l3 10 4-18 3 8h4" />
                    </svg>
                  }
                />
                <QuickMetric
                  label="Ticket médio"
                  value={totalSalesQuery.isLoading || employeesQuery.isLoading ? (
                    <span className="animate-pulse text-slate-400">--</span>
                  ) : (
                    <SensitiveValue className="text-inherit font-inherit" containerClassName="w-fit">
                      <AutoResizeText
                        text={formatCurrency(averageTicketPerEmployee)}
                        maxSize={30}
                        minSize={18}
                        className="font-semibold text-slate-900"
                        paddingOffset={8}
                      />
                    </SensitiveValue>
                  )}
                  helper="Desempenho médio por pessoa"
                  accent="amber"
                  icon={
                    <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4" />
                    </svg>
                  }
                />
                </div>
              </div>
            </SensitiveSection>

            <div className="rounded-2xl border border-slate-200/60 bg-white/80 p-6 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-800">Atalhos operacionais</h2>
                  <p className="text-sm text-slate-500">Os caminhos mais usados do time sempre à mão.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  Disponível para toda a equipe
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <QuickActionCard
                  title="Funcionários"
                  description="Cadastre, edite e acompanhe o desempenho da sua equipe."
                  accent="emerald"
                  onClick={() => navigate("/employees")}
                  icon={
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  }
                  hotspotLabel="Equipe"
                />
                <QuickActionCard
                  title="Registrar vendas"
                  description="Lance novas vendas e mantenha tudo atualizado em segundos."
                  accent="teal"
                  onClick={() => navigate("/sales")}
                  icon={
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  hotspotLabel="Vendas"
                />
                <QuickActionCard
                  title="Estatísticas"
                  description="Explore visualizações, rankings e acompanhe metas."
                  accent="sky"
                  onClick={() => navigate("/statistics")}
                  icon={
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                  hotspotLabel="Analytics"
                />
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <SensitiveSection>
              <div className="rounded-2xl border border-white/40 bg-gradient-to-b from-white/80 to-white/60 p-6 shadow-lg backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-800">Resumo rápido</h2>
                    <p className="mt-2 text-sm text-slate-500">Uma visão rápida para entrar em reunião informado.</p>
                  </div>
                  <SensitiveSectionToggleButton className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100" />
                </div>

                <ul className="mt-5 space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-3 rounded-xl border border-slate-200/60 bg-white/70 p-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-teal-500" />
                  <span className="flex-1 leading-relaxed">Há <strong>{employeesQuery.isLoading ? "--" : activeEmployees}</strong> pessoas com pelo menos uma venda no período.</span>
                </li>
                <li className="flex items-start gap-3 rounded-xl border border-slate-200/60 bg-white/70 p-3">
                  <span className="mt-1 inline-flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-cyan-500" />
                  <span className="flex-1 leading-relaxed">Nos últimos 7 dias, registramos <strong>{recentSalesQuery.isLoading ? "--" : `${recentSalesCount} vendas`}</strong>.</span>
                </li>
                </ul>
              </div>
            </SensitiveSection>

            {user.role === "admin" && (
              <div className="relative overflow-hidden rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-500 via-purple-600 to-fuchsia-600 p-6 text-white shadow-xl">
                <div className="absolute inset-0 opacity-40">
                  <div className="absolute -top-10 right-0 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
                  <div className="absolute bottom-0 left-0 h-20 w-20 rounded-full bg-purple-300/30 blur-2xl" />
                </div>
                <div className="relative space-y-4">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Controle avançado
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Painel de administração</h3>
                    <p className="mt-2 text-sm text-purple-100/90">Configure acessos, libere convites e mantenha a equipe alinhada com as políticas da organização.</p>
                  </div>
                  <Button
                    onClick={() => navigate("/admin/access-codes")}
                    className="group w-full justify-center rounded-xl border border-white/40 bg-white/90 px-4 py-2 text-sm font-semibold text-purple-700 shadow-lg hover:bg-white"
                  >
                    Acessar painel
                    <svg className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Button>
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

type MetricAccent = "emerald" | "teal" | "sky" | "amber";
type ActionAccent = "emerald" | "teal" | "sky";

const METRIC_ACCENT_STYLES: Record<MetricAccent, { iconBg: string; iconText: string; haloBg: string }> = {
  emerald: {
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-600",
    haloBg: "bg-emerald-400/10",
  },
  teal: {
    iconBg: "bg-teal-500/15",
    iconText: "text-teal-600",
    haloBg: "bg-teal-400/10",
  },
  sky: {
    iconBg: "bg-sky-500/15",
    iconText: "text-sky-600",
    haloBg: "bg-sky-400/10",
  },
  amber: {
    iconBg: "bg-amber-500/15",
    iconText: "text-amber-600",
    haloBg: "bg-amber-400/10",
  },
};

const ACTION_ACCENT_STYLES: Record<ActionAccent, { iconBg: string; iconText: string; chipBg: string; chipText: string; dotBg: string; ctaText: string; ctaHover: string }> = {
  emerald: {
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-600",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-600",
    dotBg: "bg-emerald-400",
    ctaText: "text-emerald-600",
    ctaHover: "group-hover:text-emerald-700",
  },
  teal: {
    iconBg: "bg-teal-500/15",
    iconText: "text-teal-600",
    chipBg: "bg-teal-50",
    chipText: "text-teal-600",
    dotBg: "bg-teal-400",
    ctaText: "text-teal-600",
    ctaHover: "group-hover:text-teal-700",
  },
  sky: {
    iconBg: "bg-sky-500/15",
    iconText: "text-sky-600",
    chipBg: "bg-sky-50",
    chipText: "text-sky-600",
    dotBg: "bg-sky-400",
    ctaText: "text-sky-600",
    ctaHover: "group-hover:text-sky-700",
  },
};

interface QuickMetricProps {
  label: string;
  value: ReactNode;
  helper: string;
  icon: ReactNode;
  accent: MetricAccent;
}

function QuickMetric({ label, value, helper, icon, accent }: QuickMetricProps) {
  const accentStyles = METRIC_ACCENT_STYLES[accent];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white/95 p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className={`absolute -right-6 -top-6 h-16 w-16 rounded-full ${accentStyles.haloBg}`} />
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentStyles.iconBg} ${accentStyles.iconText} shadow-inner`}>{icon}</div>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  hotspotLabel: string;
  accent: ActionAccent;
  onClick: () => void;
}

function QuickActionCard({ title, description, icon, hotspotLabel, accent, onClick }: QuickActionCardProps) {
  const accentStyles = ACTION_ACCENT_STYLES[accent];

  return (
    <button
      onClick={onClick}
      className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white/95 p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
      type="button"
    >
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${accentStyles.iconBg} ${accentStyles.iconText} shadow-inner transition-transform group-hover:scale-105`}>
          {icon}
        </div>
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${accentStyles.chipBg} ${accentStyles.chipText}`}>
            <span className={`inline-flex h-2 w-2 rounded-full ${accentStyles.dotBg}`} />
            {hotspotLabel}
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-800 group-hover:text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <span className={`mt-6 inline-flex items-center gap-1 text-sm font-semibold ${accentStyles.ctaText} transition-all ${accentStyles.ctaHover}`}>
        Abrir agora
        <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </button>
  );
}
