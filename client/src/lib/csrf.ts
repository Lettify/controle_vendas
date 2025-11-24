let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  // Tenta ler o cookie diretamente
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  csrfToken = match ? decodeURIComponent(match[1]) : "";
  console.log("[CSRF] Token lido do cookie:", csrfToken);
  if (!csrfToken) throw new Error("CSRF token não encontrado");
  return csrfToken;
}

export function setCsrfToken(token: string) {
  csrfToken = token;
}
