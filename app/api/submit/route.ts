import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase";
import { Subject } from "@/lib/calculations";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      student_name,
      register_number,
      semester,
      programme,
      previous_cgpa,
      previous_credits,
      subjects,
      semester_gpa,
      updated_cgpa,
      warnings,
    } = body;

    if (!register_number || String(register_number).trim() === "") {
      return NextResponse.json(
        { success: false, error: "Register number is required." },
        { status: 400 }
      );
    }

    const cleanRegNo = String(register_number).trim();
    const cleanSemester = semester ? parseInt(String(semester), 10) : 1;
    const cleanPrevCgpa = previous_cgpa != null ? Number(previous_cgpa) : null;
    const cleanPrevCredits =
      previous_credits != null ? Number(previous_credits) : null;

    const supabase = getAdminSupabase();

    // 1. Upsert student record
    const { data: student, error: studentError } = await supabase
      .from("students")
      .upsert(
        {
          register_number: cleanRegNo,
          name: student_name ? String(student_name).trim() : "Student",
          department: programme ? String(programme).trim() : "Engineering",
          semester: cleanSemester,
          previous_cgpa: cleanPrevCgpa,
          previous_credits: cleanPrevCredits,
          extraction_status: "completed",
          verification_status: "pending",
        },
        { onConflict: "register_number" }
      )
      .select()
      .single();

    if (studentError || !student) {
      console.error("[SUBMIT] Student upsert error:", studentError);
      return NextResponse.json(
        {
          success: false,
          error:
            studentError?.message ||
            "Failed to save student record to database.",
        },
        { status: 500 }
      );
    }

    const studentId = student.id;

    // 2. Clean previous subjects & semester results for this student
    await supabase.from("result_subjects").delete().eq("student_id", studentId);
    await supabase
      .from("semester_results")
      .delete()
      .eq("student_id", studentId);

    // 3. Insert subjects
    if (Array.isArray(subjects) && subjects.length > 0) {
      const subjectRows = subjects.map((s: Subject) => ({
        student_id: studentId,
        subject_code: s.subject_code ? String(s.subject_code).trim() : null,
        subject_name: s.subject_name
          ? String(s.subject_name).trim()
          : "Subject",
        credit_hour: Number(s.credit_hour) || 0,
        marks: s.marks != null ? Number(s.marks) : null,
        grade: s.grade ? String(s.grade).trim() : null,
        credit_point: Number(s.credit_point) || 0,
      }));

      const { error: subjError } = await supabase
        .from("result_subjects")
        .insert(subjectRows);

      if (subjError) {
        console.error("[SUBMIT] Subject insert error:", subjError);
      }
    }

    // 4. Insert semester result
    const { error: resultError } = await supabase
      .from("semester_results")
      .insert({
        student_id: studentId,
        semester: cleanSemester,
        semester_gpa: semester_gpa != null ? Number(semester_gpa) : null,
        updated_cgpa: updated_cgpa != null ? Number(updated_cgpa) : null,
        result_status:
          semester_gpa != null && semester_gpa >= 5.0 ? "Pass" : "Review",
        warnings: Array.isArray(warnings) ? warnings : [],
      });

    if (resultError) {
      console.error("[SUBMIT] Semester result insert error:", resultError);
    }

    return NextResponse.json({
      success: true,
      message: "Result submitted and stored successfully!",
      student_id: studentId,
      register_number: cleanRegNo,
    });
  } catch (err: any) {
    console.error("[SUBMIT] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to submit result." },
      { status: 500 }
    );
  }
}
