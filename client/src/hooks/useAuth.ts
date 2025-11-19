import { trpc } from "@/lib/trpc";
import { useContext } from "react";
import { TRPCContext } from "@trpc/react-query";
import { getCsrfToken } from "@/lib/csrf";

export function useAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();
  const trpcContext = useContext(TRPCContext);

  return {
    user,
    loading: isLoading,
    error,
    isAuthenticated: !!user,
    logout: async () => {
      // Chama logout via client tRPC diretamente, garantindo header CSRF
      const token = await getCsrfToken();
      await trpcContext.client.mutation(["auth.logout"], undefined, {
        headers: { "x-csrf-token": token },
      });
      window.location.href = "/login";
    },
  };
}
