import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers.js";
import { createContext } from "../../server/_core/context.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export default async function handler(req: any, res: any) {
  try {
    // Converter request do Vercel para Fetch API Request
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const url = `${protocol}://${host}${req.url}`;

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.status(200).setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      return res.end();
    }

    // Criar Headers compatível com Fetch API
    const headers = new Headers();
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value) headers.set(key, Array.isArray(value) ? value[0] : value as string);
    });

    // Criar Request compatível com Fetch API
    const fetchRequest = new Request(url, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: fetchRequest,
      router: appRouter,
      createContext: async (opts) => {
        try {
          // Adaptar contexto para Vercel (compatível com Express)
          const cookieHeader = opts.req.headers.get("cookie") || "";
          const cookies: Record<string, string> = {};

          console.log('[API] Received cookie header:', cookieHeader || '(empty)');

          cookieHeader.split(";").forEach((cookie) => {
            const [key, value] = cookie.trim().split("=");
            if (key && value) {
              cookies[key] = decodeURIComponent(value);
            }
          });

          // Extrair informações da URL para mock do request
          const reqUrl = new URL(opts.req.url);

          // Mock de req/res compatível com Express
          const mockReq = {
            cookies,
            headers: Object.fromEntries(opts.req.headers),
            method: opts.req.method,
            url: opts.req.url,
            protocol: reqUrl.protocol.replace(":", ""),
            hostname: reqUrl.hostname,
          } as any;

          const mockRes = {
            setHeader: (name: string, value: string) => {
              opts.resHeaders.set(name, value);
            },
            cookie: (name: string, value: string, options?: any) => {
              let cookieStr = `${name}=${value}`;
              if (options?.httpOnly) cookieStr += "; HttpOnly";
              if (options?.secure) cookieStr += "; Secure";
              // Capitalizar SameSite conforme especificação (Lax, Strict, None)
              if (options?.sameSite) {
                const sameSite = String(options.sameSite);
                const capitalized = sameSite.charAt(0).toUpperCase() + sameSite.slice(1).toLowerCase();
                cookieStr += `; SameSite=${capitalized}`;
              }
              // Express usa maxAge em ms, mas Set-Cookie header usa segundos
              if (options?.maxAge) cookieStr += `; Max-Age=${Math.floor(options.maxAge / 1000)}`;
              if (options?.path) cookieStr += `; Path=${options.path}`;

              console.log('[API] Setting cookie:', cookieStr.substring(0, 100) + '...');
              opts.resHeaders.append("Set-Cookie", cookieStr);
            },
            clearCookie: (name: string, options?: any) => {
              let cookieStr = `${name}=; Max-Age=-1`;
              if (options?.path) cookieStr += `; Path=${options.path}`;
              if (options?.domain) cookieStr += `; Domain=${options.domain}`;
              opts.resHeaders.append("Set-Cookie", cookieStr);
            },
          } as any;

          return createContext({
            req: mockReq,
            res: mockRes,
          });
        } catch (error) {
          console.error("[API] Context creation error:", error);
          throw error;
        }
      },
      onError: ({ error, path }) => {
        console.error(`[API] Error in ${path}:`, error);
      },
    });

    // Aplicar headers CORS
    res.setHeader("Access-Control-Allow-Credentials", "true");
    const origin = req.headers.origin;
    // Se houver origin, reflete ele. Caso contrário, não envia *, pois credentials=true não permite *
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Copiar headers da resposta do tRPC
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    // Enviar resposta
    res.status(response.status);
    const body = await response.text();
    return res.send(body);
  } catch (error) {
    console.error("[API] Handler error:", error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : "Internal server error",
        stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
      },
    });
  }
}
