let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch("/api/trpc/csrf", { credentials: "include" });
  const data = await res.json();
  csrfToken = data.result?.data?.csrfToken || data.csrfToken || "";
  console.log("[CSRF] Token lido do cookie:", csrfToken);
  if (!csrfToken) throw new Error("CSRF token não encontrado");
  return csrfToken;
}

export function setCsrfToken(token: string) {
  csrfToken = token;
}
