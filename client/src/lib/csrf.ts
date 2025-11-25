let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;

  // Tenta ler o cookie diretamente
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  const tokenFromCookie = match ? decodeURIComponent(match[1]) : "";

  if (tokenFromCookie) {
    console.log("[CSRF] Token lido do cookie:", tokenFromCookie);
    csrfToken = tokenFromCookie;
    return csrfToken;
  }

  // Se não encontrou no cookie, busca do servidor
  console.log("[CSRF] Token não encontrado no cookie, buscando do servidor...");
  try {
    const apiUrl =
      import.meta.env.VITE_API_URL
        ? `${import.meta.env.VITE_API_URL}/trpc/csrf`
        : `${window.location.origin}/api/trpc/csrf`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    // O servidor deve ter setado o cookie na resposta
    // Mas também retornamos o token no corpo para garantir
    const token = data?.result?.data?.csrfToken;

    if (!token) {
      throw new Error("Token não retornado pelo servidor");
    }

    console.log("[CSRF] Token obtido do servidor:", token);
    csrfToken = token;
    return token;
  } catch (error) {
    console.error("[CSRF] Erro ao buscar token do servidor:", error);
    throw new Error("Falha ao obter token CSRF");
  }
}

export function setCsrfToken(token: string) {
  csrfToken = token;
}
