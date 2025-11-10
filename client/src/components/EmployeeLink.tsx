import { useLocation } from "wouter";

interface EmployeeLinkProps {
  employeeId: string;
  employeeName: string;
  className?: string;
}

export default function EmployeeLink({ employeeId, employeeName, className = "" }: EmployeeLinkProps) {
  const [, navigate] = useLocation();

  return (
    <button
      onClick={() => navigate(`/employees/${employeeId}`)}
      className={`text-left hover:text-indigo-600 hover:underline transition-colors cursor-pointer ${className}`}
      title={`Ver detalhes de ${employeeName}`}
    >
      {employeeName}
    </button>
  );
}
