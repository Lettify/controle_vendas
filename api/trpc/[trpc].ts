import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

export const config = {
  runtime: "nodejs",
  maxDuration: 10,
};

export default async function handler(req: Request) {
  return fetchRequestHandler({
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

      // Mock de req/res compatível com Express
      const mockReq = {
        cookies,
        headers: Object.fromEntries(opts.req.headers),
        method: opts.req.method,
        url: opts.req.url,
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
}
