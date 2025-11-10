import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";

const COMPANY_ID = "default-company";

// Função para formatar data sem problemas de timezone
function formatDateWithoutTimezone(dateString: string): string {
  const [year, month, day] = dateString.split('T')[0].split('-');
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString('pt-BR');
}

export default function AdminAccessCodes() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [customCode, setCustomCode] = useState("");
  const [description, setDescription] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [isReusable, setIsReusable] = useState(false);

  const codesQuery = trpc.accessCodes.list.useQuery({ companyId: COMPANY_ID });

  const createMutation = trpc.accessCodes.create.useMutation({
    onSuccess: () => {
      setCustomCode("");
      setDescription("");
      setUserName("");
      setUserEmail("");
      setUserPhone("");
      setIsReusable(false);
      codesQuery.refetch();
    },
  });

  const deactivateMutation = trpc.accessCodes.deactivate.useMutation({
    onSuccess: () => codesQuery.refetch(),
  });

  const deleteMutation = trpc.accessCodes.delete.useMutation({
    onSuccess: () => codesQuery.refetch(),
  });

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
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

  if (!user || user.role !== "admin") {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <Navbar title="Códigos de Acesso" showUserInfo={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Card de Gerar Novo Código */}
        <Card className="mb-8 border-purple-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle className="text-purple-900 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Gerar Novo Código
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateCode} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Código Customizado (opcional)
                </label>
                <Input
                  placeholder="Ex: VENDEDOR01 (deixe vazio para gerar automaticamente)"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                  className="border-purple-200 focus:border-purple-400 focus:ring-purple-400 font-mono"
                  maxLength={20}
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo 3 caracteres, máximo 20</p>
              </div>

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-2 block">
                  Descrição (opcional)
                </label>
                <Input
                  placeholder="Ex: Código para novo colaborador"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                />
              </div>

              {/* Tipo de Código */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <label className="text-sm font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Tipo de Código
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="codeType"
                      checked={!isReusable}
                      onChange={() => setIsReusable(false)}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-medium text-gray-700 group-hover:text-purple-700">Uso único</div>
                      <div className="text-xs text-gray-500">O código só pode ser usado uma vez</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="radio"
                      name="codeType"
                      checked={isReusable}
                      onChange={() => setIsReusable(true)}
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                    />
                    <div>
                      <div className="font-medium text-gray-700 group-hover:text-purple-700">Reutilizável</div>
                      <div className="text-xs text-gray-500">O código pode ser usado múltiplas vezes</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Informações do Usuário (opcional)
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Nome</label>
                    <Input
                      placeholder="Nome completo do usuário"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">E-mail</label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Telefone</label>
                    <Input
                      placeholder="(00) 00000-0000"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="border-purple-200 focus:border-purple-400 focus:ring-purple-400"
                    />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 w-full"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                {createMutation.isPending ? "Gerando..." : "Gerar Código"}
              </Button>

              {createMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {createMutation.error.message}
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Card de Códigos Ativos */}
        <Card className="border-purple-100 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <div className="flex items-center justify-between">
              <CardTitle className="text-purple-900 flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Códigos Cadastrados
              </CardTitle>
              <span className="text-sm font-medium text-purple-600 bg-purple-100 px-3 py-1 rounded-full">
                {codesQuery.data?.length || 0} {codesQuery.data?.length === 1 ? 'código' : 'códigos'}
              </span>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {codesQuery.data && codesQuery.data.length > 0 ? (
              <div className="space-y-4">
                {codesQuery.data?.map((code) => (
                  <div 
                    key={code.id} 
                    className="group relative overflow-hidden border-2 border-purple-100 rounded-xl p-5 hover:border-purple-300 hover:shadow-lg transition-all bg-white"
                  >
                    {/* Badge de status */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2 items-end">
                      {code.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          </svg>
                          Inativo
                        </span>
                      )}
                      {code.isReusable ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reutilizável
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-semibold">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Uso único
                        </span>
                      )}
                    </div>

                    <div className="pr-24">
                      {/* Código */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md">
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-mono font-bold text-2xl text-purple-700 tracking-wider">{code.code}</p>
                          <p className="text-xs text-gray-500 font-medium">Código de Acesso</p>
                        </div>
                      </div>

                      {/* Descrição */}
                      {code.description && (
                        <div className="mb-3 flex items-start gap-2">
                          <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                          </svg>
                          <p className="text-sm text-gray-700">{code.description}</p>
                        </div>
                      )}

                      {/* Informações do Usuário */}
                      {(code.userName || code.userEmail || code.userPhone) && (
                        <div className="mb-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                          <h4 className="text-xs font-semibold text-purple-700 mb-2 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Informações do Usuário
                          </h4>
                          <div className="space-y-1">
                            {code.userName && (
                              <p className="text-xs text-gray-700 flex items-center gap-2">
                                <span className="font-medium">Nome:</span>
                                <span>{code.userName}</span>
                              </p>
                            )}
                            {code.userEmail && (
                              <p className="text-xs text-gray-700 flex items-center gap-2">
                                <span className="font-medium">E-mail:</span>
                                <span>{code.userEmail}</span>
                              </p>
                            )}
                            {code.userPhone && (
                              <p className="text-xs text-gray-700 flex items-center gap-2">
                                <span className="font-medium">Telefone:</span>
                                <span>{code.userPhone}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Informações de datas */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Criado: {formatDateWithoutTimezone(code.createdAt!)}</span>
                        </div>
                        {code.usedAt && (
                          <div className="flex items-center gap-1 text-green-600">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Usado: {formatDateWithoutTimezone(code.usedAt)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                      {code.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deactivateMutation.mutate({ id: code.id })}
                          disabled={deactivateMutation.isPending}
                          className="border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Desativar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja remover este código permanentemente?')) {
                            deleteMutation.mutate({ id: code.id });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium mb-1">Nenhum código cadastrado</p>
                <p className="text-gray-400 text-sm">Gere um novo código acima para começar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
