import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { usePageHeader } from "@/contexts/PageHeaderContext";

export default function NotFound() {
  const [, navigate] = useLocation();
  const { setTitle, setShowUserInfo } = usePageHeader();

  useEffect(() => {
    setTitle("Página não encontrada");
    setShowUserInfo(true);
  }, [setShowUserInfo, setTitle]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-xl text-gray-600 mb-8">Página não encontrada</p>
        <Button onClick={() => navigate("/")} className="px-6">
          Voltar para Home
        </Button>
      </div>
    </div>
  );
}
