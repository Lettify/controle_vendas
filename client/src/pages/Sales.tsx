import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import type { DailySaleRecord, EmployeeRecord } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import EmployeeLink from "@/components/EmployeeLink";
import { formatCurrency } from "@/lib/utils-commission";
import {
  SensitiveSection,
  SensitiveSectionToggleButton,
  SensitiveValue,
} from "@/components/SensitiveValue";

const COMPANY_ID = "default-company";

type StepState = "idle" | "active" | "done";

type ComposerStep = {
  id: number;
  label: string;
  description: string;
  state: StepState;
};

type EmployeeSalesSnapshot = {
  total: number;
  count: number;
};

type EmployeeEntity = EmployeeRecord;
type CompanySale = DailySaleRecord;
type CompanySales = CompanySale[];

function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getCalendarDays(year: number, monthIndex: number): (number | null)[] {
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const totalDays = getDaysInMonth(year, monthIndex);
  const days: (number | null)[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    days.push(day);
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
}

function capitalizeFirst(text: string) {
  if (!text) {
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function Sales() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [currentDate, setCurrentDate] = useState(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  });

  const [selectedDay, setSelectedDay] = useState(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base.getDate();
  });

  const [dayInput, setDayInput] = useState(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return String(base.getDate()).padStart(2, "0");
  });

  const [isEditingDay, setIsEditingDay] = useState(false);

  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [amount, setAmount] = useState("");

  const employeesQuery = trpc.employees.listActive.useQuery({ companyId: COMPANY_ID });

  const salesQuery = trpc.sales.getByCompany.useQuery(
    {
      companyId: COMPANY_ID,
      startDate: selectedDate,
      endDate: selectedDate,
    },
    { enabled: !!selectedDate },
  );

  const createSaleMutation = trpc.sales.create.useMutation({
    onSuccess: () => {
      setAmount("");
      salesQuery.refetch();
    },
  });

  const deleteSaleMutation = trpc.sales.delete.useMutation({
    onSuccess: () => {
      salesQuery.refetch();
    },
  });

  const employees: EmployeeEntity[] = (employeesQuery.data as EmployeeEntity[] | undefined) ?? [];

  const sales: CompanySales = (salesQuery.data as CompanySales | undefined) ?? [];

  const employeesById = useMemo(
    () => new Map<string, EmployeeEntity>(employees.map((employee) => [employee.id, employee])),
    [employees],
  );

  const calendarDays = useMemo(
    () => getCalendarDays(currentDate.getFullYear(), currentDate.getMonth()),
    [currentDate],
  );

  const clampDay = (value: number) => {
    const normalized = Math.floor(value);
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    return Math.min(Math.max(normalized, 1), daysInMonth);
  };

  const handleDayChange = (value: string) => {
    setIsEditingDay(true);

    const digitsOnly = value.replace(/\D/g, "");
    const trimmed = digitsOnly.slice(0, 2);

    setDayInput(trimmed);

    if (trimmed.length === 0) {
      return;
    }

    const numeric = Number(trimmed);
    if (!Number.isFinite(numeric) || numeric === 0) {
      return;
    }

    const normalized = clampDay(numeric);
    setSelectedDay(normalized);

    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), normalized);
    setSelectedDate(getLocalDateString(nextDate));

    if (trimmed.length === 2 || normalized !== numeric) {
      setDayInput(String(normalized).padStart(2, "0"));
    }
  };

  const handleDayBlur = () => {
    setIsEditingDay(false);

    if (dayInput.length === 0) {
      setDayInput(String(selectedDay).padStart(2, "0"));
      return;
    }

    const numeric = Number(dayInput);
    if (!Number.isFinite(numeric) || numeric === 0) {
      setDayInput(String(selectedDay).padStart(2, "0"));
      return;
    }

    const normalized = clampDay(numeric);
    if (normalized !== selectedDay) {
      setSelectedDay(normalized);
      const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), normalized);
      setSelectedDate(getLocalDateString(nextDate));
    }

    setDayInput(String(normalized).padStart(2, "0"));
  };

  const changeMonth = (offset: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + offset);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const changeYear = (offset: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setFullYear(prev.getFullYear() + offset);
      next.setHours(0, 0, 0, 0);
      return next;
    });
  };

  const handleCalendarDayClick = (day: number) => {
    setSelectedDay(day);
    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(getLocalDateString(nextDate));
    setShowCalendar(false);
    setIsEditingDay(false);
    setDayInput(String(day).padStart(2, "0"));
  };

  const handleAddSale = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEmployee || !amount) {
      return;
    }

    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return;
    }

    createSaleMutation.mutate({
      employeeId: selectedEmployee,
      companyId: COMPANY_ID,
      date: selectedDate,
      amount: parsed,
    });
  };

  const handleDeleteSale = (saleId: string) => {
    if (!saleId) {
      return;
    }

    if (typeof window !== "undefined") {
      const confirmRemoval = window.confirm("Tem certeza que deseja remover esta venda?");
      if (!confirmRemoval) {
        return;
      }
    }

    deleteSaleMutation.mutate({ id: saleId });
  };

  const salesByEmployee = useMemo(() => {
    const grouped = new Map<string, EmployeeSalesSnapshot>();

    for (const sale of sales) {
      const amountValue =
        typeof sale.amount === "number" ? sale.amount : parseFloat(String(sale.amount));
      if (Number.isNaN(amountValue)) {
        continue;
      }

      const snapshot = grouped.get(sale.employeeId);
      if (snapshot) {
        snapshot.total += amountValue;
        snapshot.count += 1;
      } else {
        grouped.set(sale.employeeId, { total: amountValue, count: 1 });
      }
    }
    return grouped;
  }, [sales]);

  const recentSales = useMemo<Array<CompanySale & { employee?: EmployeeEntity }>>(() => {
    return [...sales]
      .sort((a, b) => {
        const dateA = new Date(a.createdAt ?? `${a.date}T00:00:00`).getTime();
        const dateB = new Date(b.createdAt ?? `${b.date}T00:00:00`).getTime();
        return dateB - dateA;
      })
      .map((sale) => ({
        ...sale,
        employee: employeesById.get(sale.employeeId),
      }));
  }, [employeesById, sales]);

  const parsedAmount = amount ? Number(amount) : null;
  const isTodaySelected = selectedDate === getLocalDateString();
  const todayLabel = capitalizeFirst(
    new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date()),
  );

  const selectedDateLabel = useMemo(() => {
    const reference = new Date(`${selectedDate}T00:00:00`);
    return capitalizeFirst(
      reference.toLocaleDateString("pt-BR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, [selectedDate]);

  const composerSteps = useMemo<ComposerStep[]>(() => {
    const employeeName = employeesById.get(selectedEmployee)?.name ?? "";

    return [
      {
        id: 1,
        label: "Data escolhida",
        description: selectedDateLabel,
        state: "done" as const,
      },
      {
        id: 2,
        label: selectedEmployee ? "Colaborador definido" : "Selecione o colaborador",
        description: selectedEmployee ? employeeName : "Escolha alguém para continuar",
        state: selectedEmployee ? ("done" as const) : ("active" as const),
      },
      {
        id: 3,
        label: selectedEmployee ? "Valor da venda" : "Aguardando colaborador",
        description: selectedEmployee
          ? parsedAmount
            ? formatCurrency(parsedAmount)
            : "Informe o valor para concluir"
          : "Selecione quem vendeu",
        state: selectedEmployee ? (parsedAmount ? "done" : "active") : "idle",
      },
    ];
  }, [employeesById, parsedAmount, selectedDateLabel, selectedEmployee]);

  const selectedEmployeeDetails = selectedEmployee
    ? employeesById.get(selectedEmployee)
    : undefined;

  const selectedEmployeeSnapshot = selectedEmployee
    ? salesByEmployee.get(selectedEmployee)
    : undefined;

  useEffect(() => {
    const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
    let normalizedDay = selectedDay;

    if (selectedDay > daysInMonth) {
      normalizedDay = daysInMonth;
      setSelectedDay(normalizedDay);
    }

    const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), normalizedDay);
    const nextDateString = getLocalDateString(nextDate);

    if (selectedDate !== nextDateString) {
      setSelectedDate(nextDateString);
    }

    if (!isEditingDay) {
      setDayInput(String(normalizedDay).padStart(2, "0"));
    }
  }, [currentDate, selectedDay, selectedDate, isEditingDay]);

  useEffect(() => {
    if (!selectedEmployee) {
      return;
    }

    if (!employeesById.has(selectedEmployee)) {
      setSelectedEmployee("");
    }
  }, [employeesById, selectedEmployee]);

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100">
      <main className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8 lg:px-8 lg:py-12 space-y-6 sm:space-y-8 lg:space-y-10">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-500 to-cyan-500 text-white shadow-xl sm:rounded-3xl lg:rounded-[32px]">
          <div className="absolute inset-0">
            <div className="absolute -top-8 -right-12 h-32 w-32 rounded-full bg-white/15 blur-2xl sm:-top-16 sm:-right-24 sm:h-56 sm:w-56 sm:blur-3xl" />
            <div className="absolute top-1/2 left-4 h-32 w-32 -translate-y-1/2 rounded-full bg-emerald-200/25 blur-2xl sm:left-10 sm:h-48 sm:w-48 sm:blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-40 w-40 translate-y-1/3 rounded-full bg-white/10 blur-2xl sm:h-72 sm:w-72 sm:blur-3xl" />
          </div>
          <div className="relative grid gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8 md:px-10 md:py-10 lg:px-14 lg:py-12 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4 sm:space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm sm:px-5 sm:py-1.5 sm:text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-lime-300 animate-pulse sm:h-2 sm:w-2" />
                Ritual diário • {todayLabel}
              </span>
              <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-3xl lg:text-[2.75rem]">
                Registre cada venda com foco no essencial.
              </h1>
              <p className="text-xs text-white/85 sm:text-sm md:text-base lg:max-w-xl">
                Ajuste a data do dia, escolha quem vendeu e confirme o valor. Só o que importa para registrar rápido.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-xl border border-white/25 bg-white/10 p-4 shadow-lg backdrop-blur-lg sm:rounded-2xl sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75 sm:text-xs sm:tracking-[0.28em]">Dia escolhido</p>
                  <p className="mt-1.5 text-base font-semibold text-white capitalize sm:mt-2 sm:text-lg">{selectedDateLabel}</p>
                  <p className="mt-1.5 text-[11px] text-white/75 sm:mt-2 sm:text-xs">
                    {isTodaySelected ? "Foco nas vendas de hoje." : "Revendo um dia anterior."}
                  </p>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-lg sm:rounded-2xl sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/75 sm:text-xs sm:tracking-[0.28em]">Próximo passo</p>
                  <p className="mt-1.5 text-xs text-white/90 sm:mt-2 sm:text-sm">
                    {selectedEmployee
                      ? amount
                        ? "Valor pronto para registrar."
                        : `Informe o valor da venda de ${selectedEmployeeDetails?.name ?? "quem vendeu"}.`
                      : "Escolha um colaborador para liberar o valor."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 shadow-lg backdrop-blur-lg sm:rounded-[28px] sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/70 sm:text-xs sm:tracking-[0.28em]">Status rápido</p>
              <h2 className="mt-2 text-lg font-semibold text-white sm:mt-3 sm:text-xl">Passos do registro</h2>
              <div className="mt-4 space-y-2 sm:mt-6 sm:space-y-3">
                {composerSteps.map((step) => (
                  <ComposerStepPill key={step.id} step={step} />
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-emerald-100/70 bg-white/85 shadow-lg backdrop-blur-sm sm:rounded-3xl">
              <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-500 sm:text-xs sm:tracking-[0.28em]">Passo 1</p>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-900 sm:mt-1 sm:text-lg">Escolha o dia das vendas</h2>
                </div>
                {isTodaySelected && (
                  <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-medium text-emerald-600 sm:px-3 sm:py-1 sm:text-xs">Hoje</span>
                )}
              </div>
              <div className="px-4 pb-4 pt-3 space-y-3 sm:px-6 sm:pb-6 sm:pt-4 sm:space-y-4">
                <div className="flex flex-col gap-3">
                  <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center">
                    <div className="relative flex-1 lg:max-w-xs">
                      <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-500">
                        Dia
                      </span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={2}
                        value={dayInput}
                        onChange={(e) => handleDayChange(e.target.value)}
                        onFocus={() => setIsEditingDay(true)}
                        onBlur={handleDayBlur}
                        className="w-full rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-white to-emerald-50 py-5 pl-20 pr-5 text-center text-4xl font-black leading-none text-emerald-700 shadow-sm transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        placeholder="00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCalendar((prev) => !prev)}
                      className={`flex h-14 w-full items-center justify-center rounded-2xl border-2 text-sm font-semibold transition lg:w-16 ${
                        showCalendar
                          ? "border-transparent bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg"
                          : "border-emerald-100 bg-white text-emerald-600 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                      }`}
                      title="Abrir calendário"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="lg:hidden">Calendário</span>
                    </button>
                    {showCalendar && (
                      <div className="absolute top-full right-0 z-10 mt-2 w-full rounded-2xl border-2 border-emerald-100 bg-white p-4 shadow-lg lg:w-80">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => changeYear(-1)}
                            className="rounded-full p-1.5 text-emerald-500 transition hover:bg-emerald-50"
                            title="Ano anterior"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                          </button>
                          <p className="text-sm font-semibold text-slate-700">{currentDate.getFullYear()}</p>
                          <button
                            type="button"
                            onClick={() => changeYear(1)}
                            className="rounded-full p-1.5 text-emerald-500 transition hover:bg-emerald-50"
                            title="Próximo ano"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => changeMonth(-1)}
                            className="rounded-xl px-3 py-1 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50"
                            title="Mês anterior"
                          >
                            Anterior
                          </button>
                          <h3 className="text-base font-bold capitalize text-slate-800">
                            {currentDate.toLocaleDateString("pt-BR", { month: "long" })}
                          </h3>
                          <button
                            type="button"
                            onClick={() => changeMonth(1)}
                            className="rounded-xl px-3 py-1 text-sm font-semibold text-emerald-600 transition hover:bg-emerald-50"
                            title="Próximo mês"
                          >
                            Próximo
                          </button>
                        </div>

                        <div className="mt-4 grid grid-cols-7 gap-1">
                          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dayLabel) => (
                            <div
                              key={dayLabel}
                              className="py-1 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-400"
                            >
                              {dayLabel}
                            </div>
                          ))}
                        </div>
                        <div className="mt-1 grid grid-cols-7 gap-1">
                          {calendarDays.map((calendarDay, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                if (calendarDay) {
                                  handleCalendarDayClick(calendarDay);
                                }
                              }}
                              disabled={!calendarDay}
                              className={`aspect-square rounded-xl text-sm font-semibold transition ${
                                !calendarDay
                                  ? "invisible"
                                  : calendarDay === selectedDay
                                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {calendarDay}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-500/80">
                    Ajuste o dia sempre que precisar revisar vendas anteriores sem perder o foco de hoje.
                  </p>
                  <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/70 px-6 py-5 shadow-inner">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">Resumo</p>
                    <p className="mt-3 text-base font-semibold text-emerald-800 capitalize leading-snug">
                      {selectedDateLabel}
                    </p>
                    <p className="mt-3 text-xs text-emerald-600/85 leading-relaxed">
                      {isTodaySelected
                        ? "Você está trabalhando com as vendas de hoje, mantendo o ritmo certo."
                        : "Revise as vendas desse dia com calma e retorne ao presente quando quiser."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-2xl border border-slate-200/60 bg-white/90 shadow-lg backdrop-blur-sm sm:rounded-3xl">
              <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-xs sm:tracking-[0.28em]">Passo 2</p>
                  <h2 className="mt-0.5 text-base font-semibold text-slate-900 sm:mt-1 sm:text-lg">Quem realizou a venda?</h2>
                </div>
                {selectedEmployee && (
                  <button
                    type="button"
                    onClick={() => setSelectedEmployee("")}
                    className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 transition active:scale-95 active:bg-slate-50 sm:px-3 sm:py-1 sm:text-xs sm:hover:border-slate-300 sm:hover:text-slate-700"
                  >
                    Trocar
                  </button>
                )}
              </div>
              <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
                {selectedEmployee ? (
                  <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-500/90 to-teal-600/90 p-5 text-white shadow-xl">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-2xl font-black shadow-lg">
                          {selectedEmployeeDetails?.name?.charAt(0)?.toUpperCase() ?? ""}
                        </div>
                        <div>
                          <p className="text-sm uppercase tracking-wider text-white/70">Colaborador selecionado</p>
                          <p className="text-xl font-semibold">
                            {selectedEmployeeDetails?.name ?? "Colaborador"}
                          </p>
                          <p className="text-xs text-white/75">
                            {selectedEmployeeDetails?.position ?? "Função não informada"}
                          </p>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm">
                        {selectedEmployeeSnapshot ? (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wide text-white/70">Desempenho do dia</p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-semibold text-white">
                                {formatCurrency(selectedEmployeeSnapshot.total)}
                              </span>
                              <span className="text-xs font-medium text-white/70 whitespace-nowrap">
                                ({selectedEmployeeSnapshot.count} {selectedEmployeeSnapshot.count === 1 ? "venda" : "vendas"})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-white/80">Ainda sem vendas neste dia.</span>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mb-4 text-sm text-slate-500">
                    Percorra a lista e escolha quem realizou aquela venda especial. Você pode trocar a qualquer momento, o valor fica guardado.
                  </p>
                )}

                {!selectedEmployee && (
                  <div className="mt-4 max-h-[380px] space-y-2 overflow-y-auto pr-1">
                    {employees.map((emp) => {
                      const snapshot = salesByEmployee.get(emp.id);
                      return (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setSelectedEmployee(emp.id)}
                          className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-base font-bold text-slate-600 shadow-sm transition group-hover:scale-105 group-hover:from-emerald-500 group-hover:to-teal-500 group-hover:text-white">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 group-hover:text-emerald-600">{emp.name}</p>
                              {emp.position && (
                                <p className="text-xs text-slate-500 group-hover:text-emerald-600">{emp.position}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {snapshot ? (
                              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                                {formatCurrency(snapshot.total)}
                              </div>
                            ) : (
                              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                                Sem vendas hoje
                              </div>
                            )}
                            <svg className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <SensitiveSection>
              <form onSubmit={handleAddSale} className="rounded-2xl border border-slate-200/60 bg-white/90 shadow-lg backdrop-blur-sm sm:rounded-3xl">
                <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-xs sm:tracking-[0.28em]">Passo 3</p>
                    <h2 className="mt-0.5 text-base font-semibold text-slate-900 sm:mt-1 sm:text-lg">Confirme o valor</h2>
                  </div>
                  <SensitiveSectionToggleButton className="border-slate-200 bg-slate-50 text-slate-600 active:bg-slate-100 sm:hover:bg-slate-100" />
                </div>
                <div className="px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
                  {selectedEmployee ? (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor da venda</label>
                        <div className="relative mt-2">
                          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-lg font-black text-emerald-600">R$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0,00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 py-4 pl-14 pr-4 text-2xl font-black text-slate-800 shadow-sm transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            required
                            autoFocus
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={createSaleMutation.isPending || !amount}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {createSaleMutation.isPending ? (
                          <>
                            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Registrando…
                          </>
                        ) : (
                          <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Registrar venda
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center text-sm text-slate-500">
                      Selecione um colaborador para liberar o campo de valor.
                    </div>
                  )}
                </div>
              </form>
            </SensitiveSection>
          </div>

          <div className="space-y-6">
            <SensitiveSection>
              <div className="flex flex-col rounded-2xl border border-cyan-100/70 bg-white/85 shadow-lg backdrop-blur-sm sm:rounded-3xl">
                <div className="flex items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-500 sm:text-xs sm:tracking-[0.28em]">Fluxo ao vivo</p>
                    <h2 className="mt-0.5 text-base font-semibold text-slate-900 sm:mt-1 sm:text-lg">Vendas registradas</h2>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {recentSales.length > 0 && (
                      <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-600 sm:px-3 sm:py-1 sm:text-xs">
                        {recentSales.length}
                      </span>
                    )}
                    <SensitiveSectionToggleButton className="border-cyan-200 bg-cyan-50 text-cyan-600 active:bg-cyan-100 sm:hover:bg-cyan-100" />
                  </div>
                </div>
                <div className="flex-1 overflow-hidden px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
                  {recentSales.length > 0 ? (
                    <div className="relative max-h-[400px] space-y-2.5 overflow-y-auto pl-5 pr-1.5 sm:max-h-[500px] sm:space-y-3 sm:pl-6 sm:pr-2">
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-200 via-cyan-100 to-transparent" />
                      {recentSales.map((sale) => {
                        const amountValue =
                          typeof sale.amount === "number"
                            ? sale.amount
                            : parseFloat(String(sale.amount));

                        return (
                          <div
                            key={sale.id}
                            className="relative rounded-xl border border-cyan-100 bg-white/90 px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                          >
                            <span className="absolute -left-[0.65rem] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-white bg-cyan-500 shadow" />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2.5 sm:flex-1">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-xs font-bold text-white shadow-md">
                                  {sale.employee?.name?.charAt(0)?.toUpperCase() ?? ""}
                                </div>
                                <div className="min-w-0 flex-1">
                                  {sale.employee ? (
                                    <EmployeeLink
                                      employeeId={sale.employeeId}
                                      employeeName={sale.employee.name}
                                      className="truncate text-sm font-semibold text-slate-900 hover:text-cyan-600"
                                    />
                                  ) : (
                                    <p className="text-sm font-semibold text-slate-900">Colaborador removido</p>
                                  )}
                                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                                    <svg className="h-3.5 w-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {new Date(sale.createdAt ?? `${sale.date}T00:00:00`).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                              <div className="sm:ml-auto">
                                <div className="flex items-center justify-end gap-2 sm:min-w-[140px]">
                                  <SensitiveValue
                                    className="text-xs font-bold text-emerald-600"
                                    containerClassName="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-1 shadow-sm"
                                  >
                                    {formatCurrency(amountValue)}
                                  </SensitiveValue>
                                  <button
                                    onClick={() => handleDeleteSale(sale.id)}
                                    disabled={deleteSaleMutation.isPending}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-200 bg-white text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                                    title="Remover venda"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-cyan-100 bg-cyan-50/70 px-4 py-10 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-cyan-700">Nenhuma venda registrada</p>
                      <p className="text-xs text-cyan-600">As vendas aparecem aqui instantaneamente após o registro.</p>
                    </div>
                  )}
                </div>
              </div>
            </SensitiveSection>

            <div className="rounded-2xl border border-slate-200/60 bg-white/90 p-4 shadow-lg backdrop-blur-sm sm:rounded-3xl sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 sm:text-xs sm:tracking-[0.28em]">Dica de ritmo</p>
              <h3 className="mt-1.5 text-base font-semibold text-slate-900 sm:mt-2 sm:text-lg">Reserve momentos curtos para registrar</h3>
              <p className="mt-2 text-xs text-slate-600 sm:mt-3 sm:text-sm">
                Anote as vendas logo após cada atendimento para manter o painel sempre atualizado. Use o campo de valor como checklist rápido e ajuste qualquer detalhe quando o dia acalmar.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

type ComposerStepPillProps = {
  step: ComposerStep;
};

function ComposerStepPill({ step }: ComposerStepPillProps) {
  const stateClasses = {
    done: "border-white/30 bg-white/20 text-white",
    active: "border-white/40 bg-white/25 text-white",
    idle: "border-white/20 bg-white/10 text-white/70",
  }[step.state];

  const iconWrapper = {
    done: "border-white/60 bg-emerald-300/90 text-emerald-900",
    active: "border-white/45 bg-white/15 text-white",
    idle: "border-white/25 bg-white/5 text-white/60",
  }[step.state];

  const icon =
    step.state === "done" ? (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ) : step.state === "active" ? (
      <span className="block h-2.5 w-2.5 rounded-full bg-white" />
    ) : (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v.01M12 12v.01M12 18v.01" />
      </svg>
    );

  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 backdrop-blur-sm ${stateClasses}`}>
      <div className={`flex h-9 w-9 items-center justify-center rounded-full border ${iconWrapper}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold">{step.label}</p>
        <p className="mt-1 text-xs text-white/80">{step.description}</p>
      </div>
    </div>
  );
}
