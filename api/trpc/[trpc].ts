import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export default async function handler(req: Request) {
  try {
    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      createContext: async (opts) => {
        try {
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
        } catch (error) {
          console.error("[API] Context creation error:", error);
          throw error;
        }
      },
      onError: ({ error, path }) => {
        console.error(`[API] Error in ${path}:`, error);
      },
    });

    // Adicionar CORS headers na resposta
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Origin", req.headers.get("origin") || "*");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    console.error("[API] Handler error:", error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : "Internal server error",
          stack: process.env.NODE_ENV === "development" ? (error instanceof Error ? error.stack : undefined) : undefined,
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
        },
      }
    );
  }
}
