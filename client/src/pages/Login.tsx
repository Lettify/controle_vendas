import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, APP_LOGO, DEVICE_STORAGE_KEY } from "@/const";

async function computeDeviceFingerprint(): Promise<string> {
  if (typeof window === "undefined") {
    return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }

  const navigatorRef = window.navigator;
  const screenRef = window.screen;
  const timezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    } catch {
      return "";
    }
  })();

  const rawFingerprint = [
    navigatorRef?.userAgent ?? "",
    navigatorRef?.language ?? "",
    navigatorRef?.platform ?? "",
    screenRef ? `${screenRef.width}x${screenRef.height}x${screenRef.colorDepth}` : "",
    timezone,
  ]
    .filter(Boolean)
    .join("||");

  const cryptoRef = window.crypto;
  if (cryptoRef?.subtle && rawFingerprint) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(rawFingerprint);
      const digest = await cryptoRef.subtle.digest("SHA-256", data);
      const bytes = Array.from(new Uint8Array(digest));
      return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      // Ignorar e cair no fallback
    }
  }

  if (rawFingerprint) {
    try {
      return btoa(rawFingerprint).replace(/[^a-z0-9]/gi, "").slice(0, 64).toLowerCase();
    } catch {
      // Ignorar e usar o fallback aleatório
    }
  }

  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let cancelled = false;

    const initDeviceId = async () => {
      let resolvedId: string | null = null;

      try {
        const stored = window.localStorage.getItem(DEVICE_STORAGE_KEY);
        if (stored) {
          resolvedId = stored.toLowerCase();
        } else {
          const fingerprint = await computeDeviceFingerprint();
          resolvedId = fingerprint.toLowerCase();
          window.localStorage.setItem(DEVICE_STORAGE_KEY, resolvedId);
        }
      } catch (storageError) {
        console.error("[Login] Falha ao inicializar deviceId", storageError);
        const fingerprint = await computeDeviceFingerprint();
        resolvedId = fingerprint.toLowerCase();
      }

      if (!cancelled) {
        setDeviceId(resolvedId);
        window.sessionStorage.setItem(DEVICE_STORAGE_KEY, resolvedId);
      }
    };

    initDeviceId();

    if (typeof navigator !== "undefined") {
      const platform = navigator.platform || "";
      const userAgent = navigator.userAgent || "";
      const label = [platform, userAgent].filter(Boolean).join(" - ").slice(0, 250);
      setDeviceLabel(label || null);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const loginMutation = trpc.auth.loginWithCode.useMutation({
    onSuccess: async () => {
      // Pequeno delay para garantir que o navegador processou o cookie
      await new Promise(resolve => setTimeout(resolve, 100));
      // Invalidar a query do auth.me para recarregar o usuário
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: (err) => {
      setError(err.message || "Erro ao fazer login");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("Digite o código de acesso");
      return;
    }
    const effectiveDeviceId =
      deviceId ||
      (typeof window !== "undefined"
        ? window.sessionStorage.getItem(DEVICE_STORAGE_KEY) ||
        window.localStorage.getItem(DEVICE_STORAGE_KEY)
        : null);

    if (!effectiveDeviceId) {
      setError("Não foi possível identificar o dispositivo. Atualize a página e tente novamente.");
      return;
    }
    setError("");
    loginMutation.mutate({
      code: code.toUpperCase(),
      deviceId: effectiveDeviceId,
      deviceLabel: deviceLabel || undefined,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background animado com gradiente */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-100"></div>

      {/* Círculos decorativos de fundo */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-emerald-400/20 to-teal-500/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
      <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-br from-teal-300/10 to-emerald-400/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2"></div>

      {/* Card de login */}
      <div className="relative z-10 w-full max-w-md px-4">
        <Card className="border-0 shadow-2xl backdrop-blur-sm bg-white/95">
          <CardHeader className="text-center space-y-4 pb-8 pt-8">
            {/* Logo com efeito */}
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
              {APP_LOGO ? (
                <img src={APP_LOGO} alt="Logo" className="h-12 w-12" />
              ) : (
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              )}
            </div>

            <div className="space-y-2">
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {APP_TITLE}
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                Entre com seu código de acesso para continuar
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="code" className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Código de Acesso
                </label>
                <div className="relative">
                  <Input
                    id="code"
                    type="text"
                    placeholder="Digite seu código"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={loginMutation.isPending}
                    autoFocus
                    className="text-center text-xl font-bold tracking-[0.3em] h-14 border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 rounded-xl bg-gradient-to-br from-white to-gray-50 shadow-sm transition-all"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3 animate-fadeIn">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={loginMutation.isPending || !deviceId}
                className="w-full h-14 text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] rounded-xl"
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Autenticando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    Entrar
                  </span>
                )}
              </Button>
            </form>

            {/* Informações adicionais */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="text-center space-y-2">
                <p className="text-xs text-gray-500">
                  Não possui um código de acesso?
                </p>
                <p className="text-xs text-gray-600 font-medium">
                  Entre em contato com o administrador do sistema
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Informação de segurança */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-xs font-medium text-gray-700">Conexão segura e criptografada</span>
          </div>
        </div>
      </div>
    </div>
  );
}
