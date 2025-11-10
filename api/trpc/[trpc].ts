import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export default async function handler(req: Request) {
  // Adicionar CORS headers
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async (opts) => {
      // Adaptar contexto para Vercel (compatível com Express)
      const cookieHeader = opts.req.headers.get("cookie") || "";
      const cookies: Record<string, string> = {};
      
      cookieHeader.split(";").forEach((cookie) => {
        const [key, value] = cookie.trim().split("=");
        if (key && value) {
          cookies[key] = decodeURIComponent(value);
        }
      });

      // Extrair informações da URL para mock do request
      const url = new URL(opts.req.url);

      // Mock de req/res compatível com Express
      const mockReq = {
        cookies,
        headers: Object.fromEntries(opts.req.headers),
        method: opts.req.method,
        url: opts.req.url,
        protocol: url.protocol.replace(":", ""),
        hostname: url.hostname,
      } as any;

      const mockRes = {
        setHeader: (name: string, value: string) => {
          opts.resHeaders.set(name, value);
        },
        cookie: (name: string, value: string, options?: any) => {
          let cookieStr = `${name}=${value}`;
          if (options?.httpOnly) cookieStr += "; HttpOnly";
          if (options?.secure) cookieStr += "; Secure";
          if (options?.sameSite) cookieStr += `; SameSite=${options.sameSite}`;
          if (options?.maxAge) cookieStr += `; Max-Age=${options.maxAge}`;
          if (options?.path) cookieStr += `; Path=${options.path}`;
          opts.resHeaders.append("Set-Cookie", cookieStr);
        },
      } as any;

      return createContext({
        req: mockReq,
        res: mockRes,
      });
    },
  });

  // Adicionar CORS headers na resposta
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Access-Control-Allow-Origin", req.headers.get("origin") || "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
