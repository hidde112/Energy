import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { SupabaseCatalogRepository } from "@/features/catalog/server/supabase-catalog-repository";
import { AppError } from "@/lib/errors/app-error";
import { toProblemDetails } from "@/lib/errors/problem-details";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");

  try {
    if (query.length < 2) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Search with at least two characters.",
      );
    }

    const repository = new SupabaseCatalogRepository(
      await createServerSupabaseClient(),
    );
    const items = await repository.search(query, {
      page: Number.isSafeInteger(page) ? page : 1,
      pageSize: 20,
    });

    return NextResponse.json({ items, page: Math.max(1, page) });
  } catch (error) {
    const problem = toProblemDetails(error, randomUUID());
    return NextResponse.json(problem, { status: problem.status });
  }
}
