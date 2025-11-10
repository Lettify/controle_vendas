import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export function useAuth() {
  const [, navigate] = useLocation();
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
    logout: () => logoutMutation.mutate(),
  };
}
