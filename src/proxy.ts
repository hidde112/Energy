import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { parsePublicEnv } from "@/lib/env/public";
import { toProblemDetails } from "@/lib/errors/problem-details";
import type { Database } from "@/lib/supabase/database.types";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.ENERGYDEX_E2E === "1"
  ) {
    const cookieName = "energydex-e2e-user";
    if (!request.cookies.get(cookieName)?.value) {
      const userId = crypto.randomUUID();
      request.cookies.set(cookieName, userId);
      response.cookies.set(cookieName, userId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return response;
  }
  let configuration: ReturnType<typeof parsePublicEnv>;
  try {
    configuration = parsePublicEnv(process.env);
  } catch (error) {
    if (request.nextUrl.pathname === "/setup") return response;
    if (request.nextUrl.pathname.startsWith("/api/")) {
      const problem = toProblemDetails(error, crypto.randomUUID());
      return NextResponse.json(problem, { status: problem.status });
    }
    return NextResponse.redirect(new URL("/setup", request.url));
  }
  const client = createServerClient<Database>(
    configuration.NEXT_PUBLIC_SUPABASE_URL,
    configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data } = await client.auth.getUser();
  if (!data.user) {
    await client.auth.signInAnonymously();
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
