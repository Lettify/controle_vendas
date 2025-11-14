export type EmployeeRecord = {
  id: string;
  companyId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  commissionRate?: string | null;
  isActive: boolean;
};

export type DailySaleRecord = {
  id: string;
  employeeId: string;
  companyId: string;
  date: string;
  amount: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
