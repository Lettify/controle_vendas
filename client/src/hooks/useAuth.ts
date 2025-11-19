import { trpc } from "@/lib/trpc";
import { getCsrfToken } from "@/lib/csrf";

export function useAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();
  return {
    user,
    loading: isLoading,
    error,
    isAuthenticated: !!user,
    logout: async () => {
      // Chama logout via fetch manual, garantindo header CSRF
      const token = await getCsrfToken();
      const apiUrl =
        import.meta.env.VITE_API_URL
          ? `${import.meta.env.VITE_API_URL}/trpc/auth.logout`
          : `${window.location.origin}/api/trpc/auth.logout`;
      await fetch(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": token,
        },
        credentials: "include",
        body: JSON.stringify({
          id: 0,
          json: null,
          method: "mutation",
          params: [],
        }),
      });
      window.location.href = "/login";
    },
  };
}
