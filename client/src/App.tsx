import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpLink } from "@trpc/client";
import type { ReactElement } from "react";
import { Suspense, lazy, useEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import { trpc } from "./lib/trpc";
import { useAuth } from "./hooks/useAuth";
import Navbar from "./components/Navbar";
import { PageHeaderProvider } from "./contexts/PageHeaderContext";
import { getCsrfToken } from "./lib/csrf";

const Login = lazy(() => import("./pages/Login"));
const Home = lazy(() => import("./pages/Home"));
const Employees = lazy(() => import("./pages/Employees"));
const EmployeeDetails = lazy(() => import("./pages/EmployeeDetails"));
const Sales = lazy(() => import("./pages/Sales"));
const Statistics = lazy(() => import("./pages/Statistics"));
const AdminAccessCodes = lazy(() => import("./pages/AdminAccessCodes"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm font-semibold text-slate-600">
      Carregando painel...
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return <RouteFallback />;
  }

  if (!user) {
    return null;
  }

  return children;
}

function ProtectedAppShell() {
  return (
    <ProtectedRoute>
      <>
        <Navbar />
        <Suspense fallback={<RouteFallback />}>
          <Switch>
            <Route path="/employees/:id" component={EmployeeDetails} />
            <Route path="/employees" component={Employees} />
            <Route path="/sales" component={Sales} />
            <Route path="/statistics" component={Statistics} />
            <Route path="/admin/access-codes" component={AdminAccessCodes} />
            <Route path="/" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </Suspense>
      </>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route
        path="/login"
        component={() => (
          <Suspense fallback={<RouteFallback />}>
            <Login />
          </Suspense>
        )}
      />
      <Route component={ProtectedAppShell} />
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
  const [trpcClient] = useState(() => {
    // Detectar URL da API baseado no ambiente
    const getApiUrl = () => {
      // Se VITE_API_URL está definido, usar ele
      if (import.meta.env.VITE_API_URL) {
        return `${import.meta.env.VITE_API_URL}/trpc`;
      }
      
      // Em produção, usar o próprio domínio
      if (import.meta.env.PROD) {
        return `${window.location.origin}/api/trpc`;
      }
      
      // Em desenvolvimento, usar proxy do Vite para manter mesma origem
      return "/trpc";
    };

    return trpc.createClient({
      links: [
        httpLink({
          url: getApiUrl(),
          async fetch(url, options) {
            // Adiciona o token CSRF em mutações
            const isMutation = options?.body && JSON.parse(options.body as string)?.method === "mutation";
            let headers = options?.headers || {};
            if (isMutation) {
              const token = await getCsrfToken();
              headers = { ...headers, "x-csrf-token": token };
            }
            return fetch(url, {
              ...options,
              credentials: 'include',
              headers,
            });
          },
        }),
      ],
    });
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PageHeaderProvider>
          <Router />
        </PageHeaderProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
