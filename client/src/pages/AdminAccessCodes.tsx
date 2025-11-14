import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { cn } from "@/lib/utils";

const COMPANY_ID = "default-company";

export default function AdminAccessCodes() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { setTitle, setShowUserInfo } = usePageHeader();
  
  useEffect(() => {
    setTitle("Gerenciamento de Códigos de Acesso");
    setShowUserInfo(true);
  }, [setShowUserInfo, setTitle]);

  // Form state
  const [customCode, setCustomCode] = useState("");
  const [description, setDescription] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [isReusable, setIsReusable] = useState(false);

  // UI State
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "reusable" | "single">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const codesQuery = trpc.accessCodes.list.useQuery({ companyId: COMPANY_ID });

  const createMutation = trpc.accessCodes.create.useMutation({
    onSuccess: () => {
      resetForm();
      codesQuery.refetch();
    },
  });

  const deactivateMutation = trpc.accessCodes.deactivate.useMutation({
    onSuccess: () => codesQuery.refetch(),
  });

  const deleteMutation = trpc.accessCodes.delete.useMutation({
    onSuccess: () => codesQuery.refetch(),
  });

  const formIsValid = useMemo(() => {
    const codeOk = customCode.length === 0 || (customCode.length >= 3 && customCode.length <= 20);
    const emailOk = userEmail.length === 0 || /.+@.+\..+/.test(userEmail);
    return codeOk && emailOk;
  }, [customCode.length, userEmail]);

  const resetForm = () => {
    setCustomCode("");
    setDescription("");
    setUserName("");
    setUserEmail("");
    setUserPhone("");
    setIsReusable(false);
  };

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIsValid) return;
    createMutation.mutate({
      companyId: COMPANY_ID,
      code: customCode || undefined,
      description: description || undefined,
      userName: userName || undefined,
      userEmail: userEmail || undefined,
      userPhone: userPhone || undefined,
      isReusable: isReusable,
    });
  };

  const filteredCodes = useMemo(() => {
    const allCodes = codesQuery.data || [];
    return allCodes.filter((c) => {
        const term = search.trim().toLowerCase();
        const text = [c.code, c.description, c.userName, c.userEmail, c.userPhone]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const searchOk = term.length === 0 || text.includes(term);
        const statusOk = statusFilter === "all" || (statusFilter === "active" ? c.isActive : !c.isActive);
        const typeOk = typeFilter === "all" || (typeFilter === "reusable" ? c.isReusable : !c.isReusable);
        return searchOk && statusOk && typeOk;
      }).sort((a, b) => {
        if (sortBy === "newest") return (new Date(b.createdAt || 0).getTime()) - (new Date(a.createdAt || 0).getTime());
        if (sortBy === "oldest") return (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime());
        return 0;
      });
  }, [codesQuery.data, search, statusFilter, typeFilter, sortBy]);

  const metrics = useMemo(() => {
    const allCodes = codesQuery.data || [];
    return {
      total: allCodes.length,
      active: allCodes.filter(c => c.isActive).length,
      used: allCodes.filter(c => c.usedAt !== null).length,
    };
  }, [codesQuery.data]);

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8 lg:py-10 space-y-6 sm:space-y-8 lg:space-y-10">
        
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-700 via-fuchsia-600 to-purple-700 shadow-xl text-white sm:rounded-3xl">
          <div className="absolute inset-0 opacity-30">
            <div className="absolute -top-12 -right-8 h-40 w-40 rounded-full bg-white/20 blur-2xl sm:-top-24 sm:-right-16 sm:h-72 sm:w-72 sm:blur-3xl" />
            <div className="absolute top-20 -left-10 h-32 w-32 rounded-full bg-fuchsia-200/30 blur-2xl sm:top-32 sm:-left-20 sm:h-56 sm:w-56 sm:blur-3xl" />
          </div>
          <div className="relative px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10 lg:px-14 lg:py-16">
            <div className="flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl space-y-3 sm:space-y-4">
                <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl md:text-[2.5rem] lg:text-[2.75rem]">
                  Gerenciamento de Códigos de Acesso
                </h1>
                <p className="text-xs sm:text-sm md:text-base text-white/90">
                  Crie, monitore e administre códigos de acesso para novos funcionários e integrações de forma segura e centralizada.
                </p>
              </div>
              <div className="grid w-full max-w-sm grid-cols-1 gap-4 rounded-2xl bg-white/10 p-4 shadow-lg backdrop-blur-lg sm:grid-cols-3 sm:p-6">
                <MetricCard label="Total de Códigos" value={metrics.total} />
                <MetricCard label="Códigos Ativos" value={metrics.active} />
                <MetricCard label="Códigos Utilizados" value={metrics.used} />
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Create Code Form */}
          <div className="lg:col-span-1">
            <Card className="rounded-3xl border-purple-200/60 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader className="border-b border-purple-100/80">
                <CardTitle className="text-purple-900 flex items-center gap-3 text-lg font-semibold">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <svg className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  Gerar Novo Código
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateCode} className="space-y-6">
                  <div>
                    <label htmlFor="customCode" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Código customizado <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <Input
                      id="customCode"
                      placeholder="Ex: VENDEDOR01"
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                      className="border-purple-200 focus:border-purple-400 focus:ring-purple-400 font-mono"
                      maxLength={20}
                    />
                     <p className="text-xs text-gray-500 mt-1">Deixe vazio para gerar um código aleatório.</p>
                  </div>
                  <div>
                    <label htmlFor="description" className="text-sm font-semibold text-gray-700 mb-2 block">
                      Descrição <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <Input
                      id="description"
                      placeholder="Ex: Código para novo colaborador"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                  <fieldset>
                    <legend className="text-sm font-semibold text-gray-700 mb-2">Tipo de código</legend>
                    <div className="grid grid-cols-2 gap-2 rounded-lg bg-purple-100 p-1">
                      <button type="button" onClick={() => setIsReusable(false)} className={cn("rounded-md px-3 py-2 text-sm font-semibold", !isReusable ? 'bg-white text-purple-700 shadow' : 'text-purple-600 hover:bg-white/50')}>Uso Único</button>
                      <button type="button" onClick={() => setIsReusable(true)} className={cn("rounded-md px-3 py-2 text-sm font-semibold", isReusable ? 'bg-white text-purple-700 shadow' : 'text-purple-600 hover:bg-white/50')}>Reutilizável</button>
                    </div>
                  </fieldset>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-700">Informações do usuário <span className="text-gray-400 font-normal">(opcional)</span></h3>
                    <Input id="userName" placeholder="Nome completo" value={userName} onChange={e => setUserName(e.target.value)} className="border-purple-200 focus:border-purple-400 focus:ring-purple-400" />
                    <Input id="userEmail" type="email" placeholder="E-mail" value={userEmail} onChange={e => setUserEmail(e.target.value)} className="border-purple-200 focus:border-purple-400 focus:ring-purple-400" />
                    <Input id="userPhone" placeholder="Telefone" value={userPhone} onChange={e => setUserPhone(e.target.value)} className="border-purple-200 focus:border-purple-400 focus:ring-purple-400" />
                  </div>

                  <div className="flex gap-3">
                    <Button type="submit" disabled={createMutation.isPending || !formIsValid} className="flex-1 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700">
                      {createMutation.isPending ? "Gerando..." : "Gerar Código"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>Limpar</Button>
                  </div>
                   {createMutation.isError && (
                    <p className="text-sm text-red-600">{createMutation.error.message}</p>
                  )}
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Code List */}
          <div className="lg:col-span-2">
            <Card className="rounded-3xl border-purple-200/60 shadow-lg bg-white/90 backdrop-blur-sm">
              <CardHeader className="border-b border-purple-100/80">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-purple-900 text-lg font-semibold">Lista de Códigos</CardTitle>
                    <span className="text-sm font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">{filteredCodes.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                    <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="w-full sm:w-auto" />
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="all">Status</option>
                      <option value="active">Ativos</option>
                      <option value="inactive">Inativos</option>
                    </select>
                     <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="all">Tipo</option>
                      <option value="single">Uso Único</option>
                      <option value="reusable">Reutilizável</option>
                    </select>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="newest">Mais recentes</option>
                      <option value="oldest">Mais antigos</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {codesQuery.isLoading && <p>Carregando...</p>}
                {codesQuery.isSuccess && filteredCodes.length === 0 && (
                  <div className="text-center py-12">
                    <p className="font-semibold text-gray-700">Nenhum código encontrado.</p>
                    <p className="text-sm text-gray-500">Ajuste os filtros ou crie um novo código.</p>
                  </div>
                )}
                <div className="space-y-4">
                  {filteredCodes.map(code => (
                    <div key={code.id} className="group relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-xl font-bold font-mono text-purple-800 tracking-wider">{code.code}</p>
                            <div className="flex items-center gap-2">
                              <StatusBadge isActive={code.isActive} />
                              <TypeBadge isReusable={code.isReusable} />
                            </div>
                          </div>
                          {code.description && <p className="text-sm text-gray-600 mt-1">{code.description}</p>}
                          {(code.userName || code.userEmail) && (
                            <div className="text-xs text-gray-500 mt-2">
                              {code.userName && <span>{code.userName}</span>}
                              {code.userName && code.userEmail && <span> &bull; </span>}
                              {code.userEmail && <span>{code.userEmail}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                           <Button
                              variant="ghost" size="sm"
                              onClick={async () => {
                                await navigator.clipboard.writeText(code.code);
                                setCopiedId(code.id);
                                setTimeout(() => setCopiedId(prev => prev === code.id ? null : prev), 1500);
                              }}
                            >
                              {copiedId === code.id ? 'Copiado!' : 'Copiar'}
                            </Button>
                          {code.isActive && (
                            <Button variant="outline" size="sm" onClick={() => deactivateMutation.mutate({ id: code.id })}>Desativar</Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteId(code.id)}>Remover</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

         {/* Confirm Delete Modal */}
         {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDeleteId(null)}>
            <div role="dialog" aria-modal="true" className="relative z-10 w-full max-w-md rounded-xl border bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold">Remover código?</h3>
              <p className="mt-2 text-sm text-gray-600">Esta ação é permanente e não pode ser desfeita.</p>
              <div className="mt-6 flex justify-end gap-3">
                <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
                <Button variant="destructive" onClick={() => { deleteMutation.mutate({ id: confirmDeleteId }); setConfirmDeleteId(null); }}>Remover</Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const MetricCard = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="rounded-xl border border-white/25 bg-white/12 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-white/85">{label}</p>
    <p className="mt-2 text-xl font-semibold sm:text-2xl">{value}</p>
  </div>
);

const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span className={cn(
    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
    isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
  )}>
    <span className={cn("h-1.5 w-1.5 rounded-full", isActive ? "bg-green-500" : "bg-gray-400")} />
    {isActive ? "Ativo" : "Inativo"}
  </span>
);

const TypeBadge = ({ isReusable }: { isReusable: boolean }) => (
   <span className={cn(
    "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold",
    isReusable ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"
  )}>
    {isReusable ? "Reutilizável" : "Uso Único"}
  </span>
);
