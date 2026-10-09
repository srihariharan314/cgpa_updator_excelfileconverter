import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

function escapeCsv(val: any): string {
  if (val == null) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: NextRequest) {
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
      .order("register_number", { ascending: true });

    if (error || !students) {
      return NextResponse.json(
        { error: error?.message || "Failed to fetch student data." },
        { status: 500 }
      );
    }

    // Determine max subjects for column headers
    let maxSubjects = 0;
    students.forEach((st) => {
      const count = st.result_subjects?.length || 0;
      if (count > maxSubjects) maxSubjects = count;
    });

    const headers = [
      "S.No",
      "Register Number",
      "Student Name",
      "Department",
      "Semester",
      "Previous CGPA",
      "Previous Credits",
      "Semester GPA",
      "Updated CGPA",
      "Verification Status",
      "Result Status",
      "Submission Date",
    ];

    for (let i = 1; i <= Math.max(maxSubjects, 1); i++) {
      headers.push(`Subject ${i} Code`);
      headers.push(`Subject ${i} Name`);
      headers.push(`Subject ${i} Credits`);
      headers.push(`Subject ${i} Marks`);
      headers.push(`Subject ${i} Grade`);
      headers.push(`Subject ${i} Points`);
    }

    const rows: string[] = [headers.map(escapeCsv).join(",")];

    students.forEach((student, index) => {
      const semResult = student.semester_results?.[0] || {};
      const subjects = student.result_subjects || [];

      const row = [
        index + 1,
        student.register_number || "",
        student.name || "",
        student.department || "",
        student.semester || "",
        student.previous_cgpa != null ? student.previous_cgpa : "",
        student.previous_credits != null ? student.previous_credits : "",
        semResult.semester_gpa != null ? semResult.semester_gpa : "",
        semResult.updated_cgpa != null ? semResult.updated_cgpa : "",
        student.verification_status || "pending",
        semResult.result_status || "",
        student.created_at ? new Date(student.created_at).toLocaleDateString() : "",
      ];

      for (let i = 0; i < maxSubjects; i++) {
        const s = subjects[i];
        if (s) {
          row.push(s.subject_code || "");
          row.push(s.subject_name || "");
          row.push(s.credit_hour != null ? s.credit_hour : "");
          row.push(s.marks != null ? s.marks : "");
          row.push(s.grade || "");
          row.push(s.credit_point != null ? s.credit_point : "");
        } else {
          row.push("", "", "", "", "", "");
        }
      }

      rows.push(row.map(escapeCsv).join(","));
    });

    const csvContent = "\uFEFF" + rows.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="resultflow_class_report_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("[EXPORT] Error generating CSV:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate report." },
      { status: 500 }
    );
  }
}