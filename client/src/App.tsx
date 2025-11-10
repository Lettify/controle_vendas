import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import { useState } from "react";
import { Route, Switch } from "wouter";
import { trpc } from "./lib/trpc";
import Login from "./pages/Login";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Employees from "./pages/Employees";
import EmployeeDetails from "./pages/EmployeeDetails";
import Sales from "./pages/Sales";
import Statistics from "./pages/Statistics";
import AdminAccessCodes from "./pages/AdminAccessCodes";
import { useAuth } from "./hooks/useAuth";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Home} />} />
      <Route path="/employees" component={() => <ProtectedRoute component={Employees} />} />
      <Route path="/employees/:id" component={() => <ProtectedRoute component={EmployeeDetails} />} />
      <Route path="/sales" component={() => <ProtectedRoute component={Sales} />} />
      <Route path="/statistics" component={() => <ProtectedRoute component={Statistics} />} />
      <Route path="/admin/access-codes" component={() => <ProtectedRoute component={AdminAccessCodes} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }));
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpLink({
          url: `${import.meta.env.VITE_API_URL || "http://localhost:3000"}/trpc`,
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            });
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
