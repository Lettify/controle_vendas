import { trpc } from "@/lib/trpc";

export function useAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Força um reload da página para limpar o cache
      window.location.href = "/login";
    },
  });

  return {
    user,
    loading: isLoading,
    error,
    isAuthenticated: !!user,
    logout: async () => {
      // Garante que o token CSRF está atualizado antes do mutate
      await import("@/lib/csrf").then(mod => mod.getCsrfToken());
      logoutMutation.mutate();
    },
  };
}
