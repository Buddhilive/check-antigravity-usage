import { fetchAntigravityQuota } from "@/lib/antigravity";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Extract token from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized: Missing or invalid Authorization header" }, { status: 401 });
  }

  const accessToken = authHeader.split("Bearer ")[1];

  try {
    const data = await fetchAntigravityQuota(accessToken);
    return NextResponse.json(data);
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch quota" }, { status: 500 });
  }
}
