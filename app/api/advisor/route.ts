import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

function isAuthorized(req: Request | NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  const key = auth.replace(/^Bearer\s+/i, "").trim();
  const advisorKey = process.env.ADVISOR_API_KEY?.trim();
  return Boolean(advisorKey && key === advisorKey);
}

// GET: Fetch all student submissions with their results & subjects
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getAdminSupabase();
    const { data: students, error } = await supabase
      .from("students")
      .select(
        `
        *,
        semester_results(*),
        result_subjects(*)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ADVISOR_GET] Supabase query error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch student submissions." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: students || [],
    });
  } catch (err: any) {
    console.error("[ADVISOR_GET] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH: Update student verification status
export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { student_id, verification_status } = body;

    if (!student_id || !verification_status) {
      return NextResponse.json(
        { error: "student_id and verification_status are required." },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();

    const { error: studentErr } = await supabase
      .from("students")
      .update({ verification_status })
      .eq("id", student_id);

    if (studentErr) {
      return NextResponse.json({ error: studentErr.message }, { status: 500 });
    }

    // Also update verified_at on semester_results if verified
    if (verification_status === "verified") {
      await supabase
        .from("semester_results")
        .update({
          verified_by: "Class Advisor",
          verified_at: new Date().toISOString(),
        })
        .eq("student_id", student_id);
    }

    return NextResponse.json({
      ok: true,
      message: `Status updated to ${verification_status}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a student submission
export async function DELETE(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const student_id = searchParams.get("student_id");

    if (!student_id) {
      return NextResponse.json(
        { error: "student_id is required." },
        { status: 400 }
      );
    }

    const supabase = getAdminSupabase();
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", student_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Submission deleted." });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}