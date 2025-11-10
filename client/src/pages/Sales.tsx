import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import EmployeeLink from "@/components/EmployeeLink";

const COMPANY_ID = "default-company";

export default function Sales() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [amount, setAmount] = useState("");
  const [dayInput, setDayInput] = useState(new Date().getDate().toString());
  const [showCalendar, setShowCalendar] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [selectedEmployeeSales, setSelectedEmployeeSales] = useState<any>(null);

  // Toggle expansão de vendas de um funcionário
  const toggleEmployeeExpanded = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  // Abrir modal com vendas do funcionário
  const openSalesModal = (item: any) => {
    setSelectedEmployeeSales(item);
    setSalesModalOpen(true);
  };

  // Sincronizar dayInput com selectedDate quando o componente montar ou selectedDate mudar
  useEffect(() => {
    const [, , day] = selectedDate.split('-');
    setDayInput(parseInt(day).toString());
  }, [selectedDate]);

  // Atualizar selectedDate quando dayInput mudar
  const handleDayChange = (day: string) => {
    setDayInput(day);
    const dayNum = parseInt(day);
    if (dayNum >= 1 && dayNum <= 31) {
      // Parse da data atual adicionando T00:00:00 para evitar problemas de timezone
      const [year, month] = selectedDate.split('-').map(Number);
      const newDate = new Date(year, month - 1, dayNum);
      
      // Validar se a data é válida para o mês atual
      if (newDate.getMonth() === month - 1) {
        const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
        setSelectedDate(formattedDate);
      }
    }
  };

  // Mudar mês
  const changeMonth = (delta: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const newDate = new Date(year, month - 1 + delta, day);
    const formattedDate = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    setSelectedDate(formattedDate);
    setDayInput(newDate.getDate().toString());
  };

  // Mudar ano
  const changeYear = (delta: number) => {
    const [year, month, day] = selectedDate.split('-').map(Number);
    const newDate = new Date(year + delta, month - 1, day);
    const formattedDate = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}-${String(newDate.getDate()).padStart(2, '0')}`;
    setSelectedDate(formattedDate);
    setDayInput(newDate.getDate().toString());
  };

  // Gerar dias do calendário
  const generateCalendarDays = () => {
    const [year, month] = selectedDate.split('-').map(Number);
    
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Dias vazios antes do primeiro dia
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }
    
    return days;
  };

  const calendarDays = generateCalendarDays();
  const [year, month, day] = selectedDate.split('-').map(Number);
  const selectedDay = day;
  const currentDate = new Date(year, month - 1, day);
  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const employeesQuery = trpc.employees.listActive.useQuery({ companyId: COMPANY_ID });
  const salesQuery = trpc.sales.getByCompany.useQuery({
    companyId: COMPANY_ID,
    startDate: selectedDate,
    endDate: selectedDate,
  });

  // Refetch quando a data mudar
  useEffect(() => {
    salesQuery.refetch();
  }, [selectedDate]);

  const createSaleMutation = trpc.sales.create.useMutation({
    onSuccess: () => {
      setAmount("");
      // Não limpar selectedEmployee para manter o funcionário selecionado
      salesQuery.refetch();
    },
  });

  const deleteSaleMutation = trpc.sales.delete.useMutation({
    onSuccess: () => {
      salesQuery.refetch();
    },
  });

  const handleDeleteSale = (saleId: string) => {
    if (confirm('Tem certeza que deseja remover esta venda?')) {
      deleteSaleMutation.mutate({ id: saleId });
    }
  };

  const handleAddSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !amount) return;

    createSaleMutation.mutate({
      employeeId: selectedEmployee,
      companyId: COMPANY_ID,
      date: selectedDate,
      amount: parseFloat(amount),
    });
  };

  // Agrupar vendas por funcionário e calcular totais
  const employeeRanking = useMemo(() => {
    if (!salesQuery.data || !employeesQuery.data) return [];

    const salesByEmployee = salesQuery.data.reduce((acc, sale) => {
      const employeeId = sale.employeeId;
      if (!acc[employeeId]) {
        acc[employeeId] = {
          employeeId,
          sales: [],
          total: 0,
        };
      }
      acc[employeeId].sales.push(sale);
      acc[employeeId].total += parseFloat(sale.amount as any);
      return acc;
    }, {} as Record<string, { employeeId: string; sales: any[]; total: number }>);

    // Criar ranking com informações do funcionário
    const ranking = Object.values(salesByEmployee).map((item) => {
      const employee = employeesQuery.data.find((emp) => emp.id === item.employeeId);
      return {
        ...item,
        employee,
      };
    });

    // Ordenar por total (maior para menor)
    return ranking.sort((a, b) => b.total - a.total);
  }, [salesQuery.data, employeesQuery.data]);

  // Timeline de vendas recentes (ordenadas por horário de criação)
  const recentSales = useMemo(() => {
    if (!salesQuery.data || !employeesQuery.data) return [];
    
    return [...salesQuery.data]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(sale => ({
        ...sale,
        employee: employeesQuery.data.find(emp => emp.id === sale.employeeId)
      }));
  }, [salesQuery.data, employeesQuery.data]);

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      <Navbar title="Registrar Vendas" />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Seções de Operação - Nova Venda e Últimas Vendas */}
        <div className="flex justify-center mb-4">
          <div className="grid grid-cols-1 lg:grid-cols-[450px_480px] gap-4">
          {/* Formulário de Nova Venda */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-t-xl relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
              
              <CardTitle className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-lg font-bold">Nova Venda</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 pb-4 px-4">
              {/* Seleção de Data */}
              <div className="mb-3">
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Data das Vendas
                </label>
                
                {/* Input de dia + Botão de calendário + Data completa */}
                <div className="flex gap-2 mb-2">
                  <div className="w-28 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-600 font-semibold text-[10px] uppercase tracking-wide pointer-events-none z-10">Dia</span>
                    <Input
                      type="number"
                      min="1"
                      max="31"
                      value={dayInput}
                      onChange={(e) => handleDayChange(e.target.value)}
                      className="w-full text-center text-2xl font-black h-12 px-4 pl-10 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 rounded-xl bg-gradient-to-br from-white to-gray-50 shadow-sm hover:shadow-md transition-all"
                      placeholder="00"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(!showCalendar)}
                    className={`w-12 h-12 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center flex-shrink-0 ${
                      showCalendar 
                        ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white scale-105' 
                        : 'bg-white text-teal-600 hover:bg-gradient-to-br hover:from-teal-50 hover:to-cyan-50 border-2 border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                  <div className="flex-1 bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-xl px-3 flex items-center">
                    <p className="text-sm font-semibold text-teal-800 capitalize">
                      {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>

                {/* Calendário */}
                {showCalendar && (
                  <div className="bg-white border-2 border-teal-200 rounded-lg p-4 shadow-lg">
                    {/* Controles de navegação de ano */}
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => changeYear(-1)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Ano anterior"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </button>
                      <span className="text-sm font-bold text-gray-700">{currentDate.getFullYear()}</span>
                      <button
                        type="button"
                        onClick={() => changeYear(1)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                        title="Próximo ano"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* Controles de navegação de mês */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        type="button"
                        onClick={() => changeMonth(-1)}
                        className="p-2 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Mês anterior"
                      >
                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <h3 className="font-bold text-gray-900 capitalize text-base">
                        {currentDate.toLocaleDateString('pt-BR', { month: 'long' })}
                      </h3>
                      <button
                        type="button"
                        onClick={() => changeMonth(1)}
                        className="p-2 hover:bg-teal-50 rounded-lg transition-colors"
                        title="Próximo mês"
                      >
                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Cabeçalho dos dias da semana */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="text-center text-xs font-semibold text-gray-600 py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Dias do calendário */}
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((day, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (day) {
                              handleDayChange(day.toString());
                              setShowCalendar(false);
                            }
                          }}
                          disabled={!day}
                          className={`aspect-square rounded-lg text-sm font-medium transition-all ${
                            !day 
                              ? 'invisible' 
                              : day === selectedDay
                              ? 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md scale-110 font-bold'
                              : 'bg-gray-50 hover:bg-teal-50 text-gray-700 hover:text-teal-900 hover:border-2 hover:border-teal-300'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Seleção de Funcionário */}
              <div className="mb-3">
                <label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Funcionário Selecionado
                </label>
                
                {selectedEmployee ? (
                  <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl p-3 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 min-w-[3rem] rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-white font-bold text-xl shadow-md">
                          {employeesQuery.data?.find(e => e.id === selectedEmployee)?.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white text-lg">
                            {employeesQuery.data?.find(e => e.id === selectedEmployee)?.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                            <p className="text-xs text-teal-50 font-medium">Pronto para registrar vendas</p>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedEmployee("")}
                        className="text-white hover:bg-white/20 rounded-xl p-2.5 transition-all backdrop-blur-sm border border-white/30"
                        title="Trocar funcionário"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2">
                    {employeesQuery.data?.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedEmployee(emp.id)}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border-2 border-gray-200 hover:border-teal-400 bg-white hover:bg-gradient-to-br hover:from-teal-50 hover:to-cyan-50 transition-all group shadow-sm hover:shadow-md"
                      >
                        <div className="w-10 h-10 min-w-[2.5rem] rounded-full bg-gradient-to-br from-gray-200 to-gray-300 group-hover:from-teal-500 group-hover:to-emerald-600 flex items-center justify-center text-gray-600 group-hover:text-white font-bold text-lg transition-all shadow-sm group-hover:shadow-md group-hover:scale-110">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-bold text-gray-900 group-hover:text-teal-900 text-base">{emp.name}</p>
                          {emp.position && (
                            <p className="text-xs text-gray-500 group-hover:text-teal-600 font-medium mt-0.5">{emp.position}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-teal-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">Selecionar</span>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-teal-600 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulário de Valor */}
              {selectedEmployee && (
                <form onSubmit={handleAddSale} className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Valor da Venda
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-600 font-black text-xl">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full text-xl font-black pl-14 pr-4 py-4 border-2 border-gray-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 rounded-xl bg-gradient-to-br from-white to-gray-50 shadow-md hover:shadow-lg transition-all"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={createSaleMutation.isPending || !amount} 
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold py-3 text-base shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl"
                  >
                    {createSaleMutation.isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Registrando...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Registrar Venda
                      </span>
                    )}
                  </Button>
                </form>
              )}

              {!selectedEmployee && (
                <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-blue-800">
                      Selecione um funcionário para começar
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline de Vendas Recentes */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-t-xl relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
              
              <CardTitle className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg border border-white/30">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-lg font-bold">Últimas Vendas</span>
                </div>
                {recentSales.length > 0 && (
                  <span className="text-sm font-semibold bg-white/20 backdrop-blur-sm border border-white/30 px-3 py-1 rounded-lg">
                    {recentSales.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 pb-4 px-4">
              {recentSales.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {recentSales.map((sale, idx) => (
                    <div 
                      key={sale.id}
                      className="group bg-gradient-to-br from-white to-gray-50 rounded-xl p-3 shadow-md border-2 border-gray-100 hover:border-cyan-400 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 min-w-[2.5rem] rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0 group-hover:scale-110 transition-transform">
                          {sale.employee?.name.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Info - Layout vertical */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            {sale.employee && (
                              <EmployeeLink
                                employeeId={sale.employeeId}
                                employeeName={sale.employee.name}
                                className="font-bold text-gray-900 text-base hover:text-cyan-600"
                              />
                            )}
                            <button
                              onClick={() => handleDeleteSale(sale.id)}
                              disabled={deleteSaleMutation.isPending}
                              className="text-red-500 hover:text-white hover:bg-red-500 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 shadow-sm hover:shadow-md"
                              title="Remover venda"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5 bg-gray-100 px-2.5 py-1.5 rounded-lg">
                              <svg className="w-3.5 h-3.5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <p className="text-xs font-semibold text-gray-700">
                                {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { 
                                  hour: '2-digit', 
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <span className="text-emerald-600 font-black text-lg whitespace-nowrap bg-emerald-50 px-3 py-1 rounded-lg">
                              R$ {parseFloat(sale.amount as any).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-semibold mb-1">Nenhuma venda registrada</p>
                  <p className="text-gray-400 text-sm">As vendas aparecerão aqui em tempo real</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>

        {/* Seção de Ranking - Largura Total Centralizada */}
        <div className="flex justify-center">
          <div className="w-full max-w-[930px]">
          {/* Ranking de Vendas por Funcionário */}
          <Card className="border-0 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-t-xl relative overflow-hidden py-3 px-4">
              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white opacity-5 rounded-full -ml-12 -mb-12"></div>
              
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {/* Icon container with glassmorphism effect */}
                  <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-lg border border-white/30">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  
                  {/* Title and subtitle */}
                  <div>
                    <CardTitle className="text-white text-base font-bold mb-0.5">
                      Ranking do Dia
                    </CardTitle>
                    <div className="flex items-center gap-1.5 text-emerald-50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-medium">{currentDate.toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
                
                {/* Total amount card */}
                <div className="bg-white/15 backdrop-blur-md px-4 py-2 rounded-lg border border-white/30 shadow-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-emerald-100 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap">Total do Dia</p>
                      <p className="text-xl font-black text-white whitespace-nowrap">
                        R$ {employeeRanking.reduce((sum, item) => sum + item.total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2.5 pb-3 px-3">
              {employeeRanking.length > 0 ? (
                <div className="space-y-2">
                  {employeeRanking.map((item, index) => {
                    return (
                      <div 
                        key={item.employeeId} 
                        className={`relative overflow-hidden rounded-lg transition-all hover:shadow-md ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200' :
                          index === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200' :
                          index === 2 ? 'bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200' :
                          'bg-white border border-gray-200'
                        }`}
                      >
                        <div className="p-2.5">
                          <div className="flex items-center gap-2.5">
                            {/* Position Badge - Minimalista */}
                            <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center font-bold text-base ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-400 text-gray-900' :
                              index === 2 ? 'bg-orange-400 text-orange-900' :
                              'bg-emerald-500 text-white'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                            </div>
                            
                            {/* Employee Info - Compacto */}
                            <div className="flex-1 min-w-0">
                              {item.employee && (
                                <EmployeeLink
                                  employeeId={item.employeeId}
                                  employeeName={item.employee.name}
                                  className="text-base font-bold text-gray-900 truncate block mb-0.5"
                                />
                              )}
                              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                                <span className="font-medium">{item.sales.length} {item.sales.length === 1 ? 'venda' : 'vendas'}</span>
                                <span className="text-gray-400">•</span>
                                <span>Média: R$ {(item.total / item.sales.length).toFixed(2)}</span>
                              </div>
                            </div>
                            
                            {/* Total e Botão Ver Vendas */}
                            <div className="flex items-center gap-2.5">
                              <div className="text-right">
                                <p className="text-xl font-black text-emerald-600">
                                  R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                              </div>
                              
                              {/* Botão para ver vendas */}
                              <button
                                onClick={() => openSalesModal(item)}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm hover:shadow-md"
                                title="Ver todas as vendas"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Ver
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-600 font-medium">Nenhuma venda registrada para esta data</p>
                  <p className="text-gray-500 text-sm mt-1">Adicione vendas usando o formulário ao lado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>

        {/* Modal de Vendas */}
        {salesModalOpen && selectedEmployeeSales && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSalesModalOpen(false)}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header do Modal */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{selectedEmployeeSales.employee.name}</h3>
                      <p className="text-indigo-100 text-sm">
                        {selectedEmployeeSales.sales.length} {selectedEmployeeSales.sales.length === 1 ? 'venda registrada' : 'vendas registradas'}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setSalesModalOpen(false)}
                    className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Stats rápidas */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                    <p className="text-indigo-100 text-xs font-medium mb-1">Total</p>
                    <p className="text-2xl font-black">
                      R$ {selectedEmployeeSales.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg p-3">
                    <p className="text-indigo-100 text-xs font-medium mb-1">Média por venda</p>
                    <p className="text-2xl font-black">
                      R$ {(selectedEmployeeSales.total / selectedEmployeeSales.sales.length).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Conteúdo do Modal - Lista de Vendas */}
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-250px)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selectedEmployeeSales.sales
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .map((sale, index) => (
                      <div
                        key={sale.id}
                        className="group relative bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 border-2 border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all"
                      >
                        {/* Badge de número */}
                        <div className="absolute -top-2 -left-2 w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white font-bold text-xs">{index + 1}</span>
                        </div>
                        
                        {/* Valor da venda */}
                        <div className="mb-3 pt-2">
                          <p className="text-xs text-gray-500 font-medium mb-1">Valor</p>
                          <p className="text-2xl font-black text-emerald-600">
                            R$ {parseFloat(sale.amount as any).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        {/* Horário */}
                        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {new Date(sale.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        
                        {/* Botão remover */}
                        <button
                          onClick={() => {
                            handleDeleteSale(sale.id);
                            // Se for a última venda, fecha o modal
                            if (selectedEmployeeSales.sales.length === 1) {
                              setSalesModalOpen(false);
                            }
                          }}
                          disabled={deleteSaleMutation.isPending}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-md"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Remover venda
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
