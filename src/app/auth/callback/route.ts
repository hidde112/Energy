import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL("/onboarding", request.url);

  if (code) {
    const client = await createServerSupabaseClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) {
      destination.searchParams.set("error", "auth_callback_failed");
    }
  }

  return NextResponse.redirect(destination);
}
