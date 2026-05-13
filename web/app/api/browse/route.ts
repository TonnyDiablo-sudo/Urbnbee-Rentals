import { NextResponse } from "next/server";
import { getMergedHomeSections } from "@/lib/browse-merge";

export async function GET() {
  const sections = getMergedHomeSections();
  return NextResponse.json(sections);
}
