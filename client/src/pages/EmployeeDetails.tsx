import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation, useRoute } from "wouter";
import Navbar from "@/components/Navbar";

// Função para formatar data sem timezone
function formatDateWithoutTimezone(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// Tipos de visualização
type ViewMode = 'list' | 'grid' | 'compact';
type SortMode = 'date-desc' | 'date-asc' | 'value-desc' | 'value-asc';

export default function EmployeeDetails() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [, params] = useRoute("/employees/:id");
  const employeeId = params?.id || "";

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  // Estados para personalização do histórico
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortMode, setSortMode] = useState<SortMode>('date-desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [minValue, setMinValue] = useState<string>('');
  const [maxValue, setMaxValue] = useState<string>('');

  // Buscar dados do funcionário
  const employeeQuery = trpc.employees.get.useQuery(
    { id: employeeId },
    { 
      enabled: !!employeeId,
      refetchOnMount: true,
      refetchOnWindowFocus: false,
    }
  );

  // Buscar total de vendas do mês selecionado
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
    }
  );

  // Buscar vendas do período (mês ou dia específico)
  const startDate = selectedDate || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
  // Calcular o último dia do mês corretamente
  const lastDayOfMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const endDate = selectedDate || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
  
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
      staleTime: 0, // Força sempre buscar dados frescos
    }
  );

  // Calcular dados (TODOS os useMemo DEVEM estar antes dos returns)
  const salesList = salesQuery.data || [];
  
  const totalSales = useMemo(() => {
    if (selectedDate) {
      return salesList.reduce((sum, sale) => sum + parseFloat(sale?.amount || '0'), 0);
    } else {
      if (monthSalesQuery.data !== undefined && monthSalesQuery.data !== null) {
        return monthSalesQuery.data;
      }
      return salesList.reduce((sum, sale) => sum + parseFloat(sale?.amount || '0'), 0);
    }
  }, [selectedDate, salesList, monthSalesQuery.data]);

  const salesByDay = useMemo(() => {
    if (!salesList || salesList.length === 0) return {};
    return salesList.reduce((acc, sale) => {
      if (!sale || !sale.date) return acc;
      const date = sale.date.split('T')[0];
      if (!acc[date]) {
        acc[date] = { count: 0, total: 0, sales: [] };
      }
      acc[date].count++;
      acc[date].total += parseFloat(sale.amount || '0');
      acc[date].sales.push(sale);
      return acc;
    }, {} as Record<string, { count: number; total: number; sales: any[] }>);
  }, [salesList]);

  const bestDay = useMemo(() => {
    const entries = Object.entries(salesByDay);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b[1].total - a[1].total)[0];
  }, [salesByDay]);

  // Filtrar e ordenar vendas
  const filteredAndSortedSales = useMemo(() => {
    let filtered = [...salesList];
    
    // Filtro por data (busca)
    if (searchTerm) {
      filtered = filtered.filter(sale => {
        const dateFormatted = formatDateWithoutTimezone(sale.date.split('T')[0]);
        return dateFormatted.includes(searchTerm);
      });
    }
    
    // Filtro por valor mínimo
    if (minValue && minValue !== '') {
      const min = parseFloat(minValue);
      if (!isNaN(min)) {
        filtered = filtered.filter(sale => parseFloat(sale.amount) >= min);
      }
    }
    
    // Filtro por valor máximo
    if (maxValue && maxValue !== '') {
      const max = parseFloat(maxValue);
      if (!isNaN(max)) {
        filtered = filtered.filter(sale => parseFloat(sale.amount) <= max);
      }
    }
    
    // Ordenação
    filtered.sort((a, b) => {
      switch (sortMode) {
        case 'date-asc':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'date-desc':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'value-asc':
          return parseFloat(a.amount) - parseFloat(b.amount);
        case 'value-desc':
          return parseFloat(b.amount) - parseFloat(a.amount);
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [salesList, searchTerm, minValue, maxValue, sortMode]);

  // Verificações após TODOS os hooks
  if (!user) {
    navigate("/login");
    return null;
  }

  if (!employeeId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Navbar title="Erro" showUserInfo={true} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="border-red-200">
            <CardContent className="py-12 text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">ID do funcionário não fornecido</h3>
              <p className="text-gray-600 mb-4">Não foi possível identificar o funcionário.</p>
              <Button onClick={() => navigate("/employees")}>
                Voltar para Funcionários
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (employeeQuery.isLoading || salesQuery.isLoading || monthSalesQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Navbar title="Carregando..." showUserInfo={true} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Carregando informações...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!employeeQuery.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <Navbar title="Não Encontrado" showUserInfo={true} />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="border-red-200">
            <CardContent className="py-12 text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">Funcionário não encontrado</h3>
              <p className="text-gray-600 mb-4">O funcionário solicitado não existe.</p>
              <Button onClick={() => navigate("/employees")}>
                Voltar para Funcionários
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const employee = employeeQuery.data;
  const salesCount = salesList.length;
  const avgSale = salesCount > 0 ? totalSales / salesCount : 0;
  const daysWithSales = Object.keys(salesByDay).length;

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ').filter(n => n.length > 0);
    if (parts.length === 0) return '?';
    return parts.map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Navbar title={employee.name} showUserInfo={true} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Botão Voltar */}
        <Button
          variant="outline"
          onClick={() => navigate("/employees")}
          className="mb-6 border-indigo-200 hover:bg-indigo-50"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Voltar para Equipe
        </Button>

        {/* Header profissional com info do funcionário */}
        <Card className="mb-8 border-0 shadow-lg overflow-hidden bg-white">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              {/* Badge com iniciais e status */}
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-2xl tracking-tight">{getInitials(employee.name)}</span>
                  </div>
                  {employee.isActive && (
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1.5 border-2 border-white shadow-md">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Nome e status */}
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">{employee.name}</h1>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                      employee.isActive 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                        : 'bg-gray-100 text-gray-600 border border-gray-200'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${employee.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
                      {employee.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    
                    {employee.position && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {employee.position}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Informações de contato */}
              <div className="flex-1 md:ml-auto">
                <div className="flex flex-col sm:flex-row gap-3">
                  {employee.email && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-medium">Email</p>
                        <p className="text-sm font-semibold text-gray-700 truncate">{employee.email}</p>
                      </div>
                    </div>
                  )}
                  {employee.phone && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 font-medium">Telefone</p>
                        <p className="text-sm font-semibold text-gray-700 truncate">{employee.phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtro de período */}
        <Card className="mb-8 border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Filtrar Período</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block uppercase tracking-wide">
                  Mês
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value));
                    setSelectedDate("");
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-semibold text-gray-700 shadow-sm"
                >
                  {monthNames.map((month, index) => (
                    <option key={index} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block uppercase tracking-wide">
                  Ano
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setSelectedDate("");
                  }}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-semibold text-gray-700 shadow-sm"
                >
                  {[2023, 2024, 2025, 2026].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-2 block uppercase tracking-wide">
                  Dia Específico (opcional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white font-semibold text-gray-700 shadow-sm"
                  />
                  {selectedDate && (
                    <Button
                      variant="outline"
                      onClick={() => setSelectedDate("")}
                      className="border-2 border-gray-300 hover:bg-gray-100 rounded-xl"
                      title="Limpar filtro de dia"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {selectedDate && (
              <div className="mt-4 p-3 bg-indigo-50 border-2 border-indigo-200 rounded-xl">
                <p className="text-sm font-semibold text-indigo-700">
                  📅 Exibindo vendas do dia: {formatDateWithoutTimezone(selectedDate)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          {/* Total de vendas */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-emerald-400 to-teal-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-emerald-50 text-sm font-bold mb-1 uppercase tracking-wide">Total em Vendas</p>
              <p className="text-3xl font-black mb-2">
                R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-emerald-50 text-xs font-semibold">
                <div className="flex items-center gap-2">
                  {selectedDate ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
                      </svg>
                      Dia selecionado
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
                      </svg>
                      {`${monthNames[selectedMonth - 1]}/${selectedYear}`}
                    </>
                  )}
                </div>
              </p>
            </CardContent>
          </Card>

          {/* Quantidade de vendas */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-blue-400 to-indigo-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
              </div>
              <p className="text-blue-50 text-sm font-bold mb-1 uppercase tracking-wide">Quantidade</p>
              <p className="text-3xl font-black mb-2">{salesCount}</p>
              <p className="text-blue-50 text-xs font-semibold">
                {salesCount === 0 ? 'Nenhuma venda' : salesCount === 1 ? (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    1 venda registrada
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                    {`${salesCount} vendas registradas`}
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          {/* Ticket médio */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-purple-400 to-pink-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-purple-50 text-sm font-bold mb-1 uppercase tracking-wide">Ticket Médio</p>
              <p className="text-3xl font-black mb-2">
                R$ {avgSale.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-purple-50 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  {salesCount > 0 ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
                      </svg>
                      Média por venda
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
                      </svg>
                      Sem vendas
                    </>
                  )}
                </div>
              </p>
            </CardContent>
          </Card>

          {/* Melhor dia ou dias ativos */}
          <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br from-orange-400 to-amber-500 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-14 h-14 bg-white/25 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
              </div>
              <p className="text-orange-50 text-sm font-bold mb-1 uppercase tracking-wide">
                {selectedDate ? 'Desempenho' : 'Melhor Dia'}
              </p>
              {bestDay ? (
                <>
                  <p className="text-3xl font-black mb-2">
                    R$ {bestDay[1].total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-orange-50 text-xs font-semibold">
                    ⭐ {formatDateWithoutTimezone(bestDay[0])} ({bestDay[1].count} {bestDay[1].count === 1 ? 'venda' : 'vendas'})
                  </p>
                </>
              ) : (
                <>
                  <p className="text-3xl font-black mb-2">{daysWithSales}</p>
                  <p className="text-orange-50 text-xs font-semibold">
                    {daysWithSales === 0 ? '📭 Nenhum dia ativo' : daysWithSales === 1 ? '📅 1 dia com vendas' : `📅 ${daysWithSales} dias com vendas`}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lista de vendas modernizada */}
        <Card className="border-0 shadow-lg bg-white overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-b-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <span className="text-xl font-bold block">Histórico de Vendas</span>
                  <span className="text-xs text-indigo-100 font-medium">
                    {selectedDate 
                      ? formatDateWithoutTimezone(selectedDate)
                      : `${monthNames[selectedMonth - 1]}/${selectedYear}`}
                  </span>
                </div>
              </CardTitle>
              
              {salesList.length > 0 && (
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-xs font-medium text-white/80">Total</p>
                    <p className="text-sm font-bold">
                      R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-6">
            {/* Barra de controles de personalização */}
            <div className="mb-6 space-y-4">
              {/* Linha 1: Busca e Filtros */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Busca por data */}
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Buscar por data</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: 10/11 ou 2024"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 pl-9 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                {/* Filtro valor mínimo */}
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor mín.</label>
                  <input
                    type="number"
                    placeholder="R$ 0.00"
                    value={minValue}
                    onChange={(e) => setMinValue(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Filtro valor máximo */}
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Valor máx.</label>
                  <input
                    type="number"
                    placeholder="R$ 9999.99"
                    value={maxValue}
                    onChange={(e) => setMaxValue(e.target.value)}
                    step="0.01"
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>

                {/* Botão limpar filtros */}
                {(searchTerm || minValue || maxValue) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setMinValue('');
                      setMaxValue('');
                    }}
                    className="mt-5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Linha 2: Ordenação e Visualização */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                {/* Ordenação */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">Ordenar:</label>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => setSortMode('date-desc')}
                      className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-md transition-all ${
                        sortMode === 'date-desc'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Mais recentes primeiro"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSortMode('date-asc')}
                      className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-md transition-all ${
                        sortMode === 'date-asc'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Mais antigas primeiro"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSortMode('value-desc')}
                      className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-md transition-all ${
                        sortMode === 'value-desc'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Maior valor primeiro"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setSortMode('value-asc')}
                      className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium rounded-md transition-all ${
                        sortMode === 'value-asc'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Menor valor primeiro"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Modo de visualização */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600">Visualização:</label>
                  <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-md transition-all ${
                        viewMode === 'list'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Visualização em lista"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-md transition-all ${
                        viewMode === 'grid'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Visualização em grade"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode('compact')}
                      className={`p-2 rounded-md transition-all ${
                        viewMode === 'compact'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                      title="Visualização compacta"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Indicador de filtros ativos */}
              {filteredAndSortedSales.length !== salesList.length && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-amber-800">
                    <strong>{filteredAndSortedSales.length}</strong> de <strong>{salesList.length}</strong> vendas sendo exibidas
                  </p>
                </div>
              )}
            </div>

            {filteredAndSortedSales.length > 0 ? (
              <>
                {/* Resumo compacto */}
                <div className="mb-6 flex items-center justify-between p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-lg">{filteredAndSortedSales.length}</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {filteredAndSortedSales.length === 1 ? 'Venda encontrada' : 'Vendas encontradas'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {salesList.length > 0 && filteredAndSortedSales.length !== salesList.length 
                          ? `${filteredAndSortedSales.length} de ${salesList.length} vendas`
                          : `${daysWithSales} ${daysWithSales === 1 ? 'dia' : 'dias'} com atividade`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-xs text-gray-500 font-medium">Ticket médio</p>
                    <p className="text-lg font-bold text-indigo-600">
                      R$ {(filteredAndSortedSales.reduce((sum, s) => sum + parseFloat(s.amount), 0) / filteredAndSortedSales.length).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                
                {/* Lista de vendas com diferentes visualizações */}
                {viewMode === 'list' && (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                    {filteredAndSortedSales.map((sale, index) => (
                      <div 
                        key={sale.id}
                        className="group relative flex items-center gap-4 p-4 bg-gradient-to-br from-white to-gray-50/50 border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all duration-200"
                      >
                        {/* Indicador de posição */}
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                          <span className="text-white font-bold text-xs">{index + 1}</span>
                        </div>
                        
                        {/* Ícone de dinheiro */}
                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ml-4">
                          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        
                        {/* Informações da venda */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 text-lg mb-0.5">
                            R$ {parseFloat(sale.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">{formatDateWithoutTimezone(sale.date.split('T')[0])}</span>
                          </div>
                        </div>
                        
                        {/* Badge de status */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-bold">Confirmada</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visualização em grade */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto pr-2">
                    {filteredAndSortedSales.map((sale, index) => (
                      <div 
                        key={sale.id}
                        className="group relative p-5 bg-gradient-to-br from-white to-indigo-50/30 border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-lg transition-all duration-200"
                      >
                        {/* Badge de posição */}
                        <div className="absolute top-3 right-3 w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-xs">{index + 1}</span>
                        </div>
                        
                        {/* Ícone grande */}
                        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        
                        {/* Valor */}
                        <p className="text-center font-black text-gray-900 text-2xl mb-3">
                          R$ {parseFloat(sale.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        
                        {/* Data */}
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-3">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-medium">{formatDateWithoutTimezone(sale.date.split('T')[0])}</span>
                        </div>
                        
                        {/* Status */}
                        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs font-bold">Confirmada</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visualização compacta */}
                {viewMode === 'compact' && (
                  <div className="max-h-[500px] overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">#</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Data</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">Valor</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAndSortedSales.map((sale, index) => (
                          <tr key={sale.id} className="hover:bg-indigo-50/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
                                <span className="text-white font-bold text-xs">{index + 1}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {formatDateWithoutTimezone(sale.date.split('T')[0])}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <span className="text-lg font-bold text-gray-900">
                                R$ {parseFloat(sale.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="text-xs font-bold">OK</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma venda encontrada</h3>
                <p className="text-gray-600 mb-4">
                  {searchTerm || minValue || maxValue 
                    ? 'Nenhuma venda corresponde aos filtros aplicados.'
                    : 'Não há vendas registradas neste período.'}
                </p>
                {(searchTerm || minValue || maxValue) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setMinValue('');
                      setMaxValue('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
