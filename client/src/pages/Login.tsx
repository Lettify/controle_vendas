import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, APP_LOGO } from "@/const";

export default function Login() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  
  const loginMutation = trpc.auth.loginWithCode.useMutation({
    onSuccess: async () => {
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
    setError("");
    loginMutation.mutate({ code: code.toUpperCase() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          {APP_LOGO && (
            <img src={APP_LOGO} alt="Logo" className="h-12 w-12 mx-auto mb-4" />
          )}
          <CardTitle className="text-2xl">{APP_TITLE}</CardTitle>
          <CardDescription>Acesse com seu código de acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Código de Acesso
              </label>
              <Input
                id="code"
                type="text"
                placeholder="Digite seu código"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loginMutation.isPending}
                autoFocus
                className="text-center text-lg tracking-widest"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full"
            >
              {loginMutation.isPending ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
