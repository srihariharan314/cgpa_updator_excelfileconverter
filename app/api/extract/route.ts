import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import {
  calculateGpa,
  calculateUpdatedCgpa,
  getSubjectCreditPoint,
  parsePreviousCredits,
  Subject,
} from "@/lib/calculations";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const EXTRACTION_PROMPT = `
You are an OCR system specialized in reading examination result screenshots, transcripts, and mark sheets (specifically Pondicherry University and affiliated engineering colleges).

Read the uploaded image carefully and extract all visible academic information.

DO NOT GUESS.
DO NOT INVENT VALUES.
DO NOT DERIVE VALUES IF NOT VISIBLE.
READ VALUES DIRECTLY FROM THE IMAGE.

==================================================
STUDENT INFORMATION
==================================================

Extract:
- student_name (Student full name)
- register_number (Registration/Roll/Enrollment number)
- semester (Semester number, e.g., "6" or 6)
- programme (Degree/Branch/Programme name, e.g., "B.Tech Computer Science & Engineering")
- examination (Examination session/date, e.g., "MAY / JUNE 2024")
- college_name (Institution or College name)

==================================================
SUBJECT TABLE
==================================================

The result table contains rows of subjects with columns such as:
- S.No
- Subject Code / Course Code
- Subject Name / Course Title
- Credit Hours / Credits / C
- Marks (Internal / External / Total Marks, if present)
- Grade Point / GP
- Credit Point / CP / Weighted Points
- Grade / Letter Grade (e.g., O, A+, A, B+, B, C, P, F, FA)

For every subject visible in the screenshot, extract:
- subject_code (null if not shown)
- subject_name (full subject name, do not truncate)
- credit_hour (numeric credit hours, e.g. 3, 4, 2, 1)
- marks (numeric total marks if visible, null if not present)
- grade_point (numeric grade point, e.g. 10.00, 9.00, 8.00)
- credit_point (numeric credit points from the Credit Point column, e.g. 30.00, 24.00)
- grade (letter grade string, e.g. "A+", "B+", "A", "O", "F")

==================================================
IMPORTANT EXTRACTION RULES
==================================================
1. Credit Hour: read directly from the "Credit Hours" / "Credits" column.
2. Grade Point: read directly from the "Grade Point" column (e.g., 8.00 -> 8).
3. Credit Point: read directly from the "Credit Point" column. Every subject has its own credit point.
4. Marks: read from the marks column if present in the image; otherwise null.
5. Grade: read letter grade directly from the Grade column.
6. Unclear values: return null if a value is illegible and add an entry in "warnings".

==================================================
OUTPUT FORMAT
==================================================

Return ONLY valid JSON matching this exact structure:
{
  "student_name": null,
  "register_number": null,
  "semester": null,
  "programme": null,
  "examination": null,
  "college_name": null,
  "subjects": [
    {
      "subject_code": null,
      "subject_name": "",
      "credit_hour": null,
      "marks": null,
      "grade_point": null,
      "credit_point": null,
      "grade": null
    }
  ],
  "warnings": []
}
`;

function cleanJson(text: string): string {
  let cleaned = text.trim();

  // Remove markdown code fences if present
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value).replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function normalizeResult(data: any) {
  const rawSubjects = Array.isArray(data?.subjects) ? data.subjects : [];
  const warnings = Array.isArray(data?.warnings) ? data.warnings : [];

  const subjects: Subject[] = rawSubjects.map((subject: any) => {
    const credit_hour = toNumber(subject?.credit_hour);
    const grade_point = toNumber(subject?.grade_point);
    let credit_point = toNumber(subject?.credit_point);

    // If credit_point wasn't in the image but credit_hour and grade_point exist
    if (credit_point == null && credit_hour != null && grade_point != null) {
      credit_point = Number((credit_hour * grade_point).toFixed(2));
    }

    return {
      subject_code:
        subject?.subject_code != null &&
        String(subject.subject_code).trim() !== ""
          ? String(subject.subject_code).trim()
          : null,
      subject_name:
        subject?.subject_name != null
          ? String(subject.subject_name).trim()
          : "Subject",
      credit_hour,
      marks: toNumber(subject?.marks),
      grade_point,
      credit_point,
      grade:
        subject?.grade != null && String(subject.grade).trim() !== ""
          ? String(subject.grade).trim()
          : null,
    };
  });

  return {
    student_name:
      data?.student_name != null
        ? String(data.student_name).trim()
        : null,
    register_number:
      data?.register_number != null
        ? String(data.register_number).trim()
        : null,
    semester:
      data?.semester != null
        ? String(data.semester).trim()
        : null,
    programme:
      data?.programme != null
        ? String(data.programme).trim()
        : null,
    examination:
      data?.examination != null
        ? String(data.examination).trim()
        : null,
    college_name:
      data?.college_name != null
        ? String(data.college_name).trim()
        : null,
    subjects,
    warnings: warnings.map((warning: unknown) => String(warning)),
  };
}

const CANDIDATE_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-pro-preview",
];

async function callGeminiWithFallback(
  ai: GoogleGenAI,
  base64Image: string
): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    for (const model of CANDIDATE_MODELS) {
      try {
        console.log(`[EXTRACT] (Attempt ${attempt}) Trying model: ${model}...`);
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: EXTRACTION_PROMPT,
            },
          ],
          config: {
            responseMimeType: "application/json",
          },
        });

        const outputText = response.text?.trim() || "";
        if (outputText) {
          console.log(`[EXTRACT] Successfully extracted using ${model}`);
          return { text: outputText, modelUsed: model };
        }
      } catch (err: any) {
        console.warn(`[EXTRACT] Model ${model} failed:`, err?.message || err);
        lastError = err;
        // Brief pause between model attempts
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
    // Brief pause between retry passes
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw (
    lastError ||
    new Error("All candidate Gemini models failed to process the image.")
  );
}


export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: "GEMINI_API_KEY is missing in .env.local",
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const formRegNo = formData.get("registerNumber")?.toString().trim();
    const formPrevCgpa = formData.get("previousCgpa")?.toString().trim();
    const formSemester = formData.get("semester")?.toString().trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "No result screenshot was uploaded.",
        },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Please upload a JPG, PNG or WEBP image screenshot.",
        },
        { status: 400 }
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: "Image is too large. Please upload an image below 15 MB.",
        },
        { status: 400 }
      );
    }

    console.log(
      `[EXTRACT] Processing image: ${(file.size / 1024 / 1024).toFixed(2)} MB`
    );

    const originalBuffer = Buffer.from(await file.arrayBuffer());
    const imageStart = Date.now();

    const optimizedBuffer = await sharp(originalBuffer)
      .rotate()
      .resize({
        width: 1920,
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85,
      })
      .toBuffer();

    const imageTime = Date.now() - imageStart;
    const base64Image = optimizedBuffer.toString("base64");

    const ai = new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
    });

    const geminiStart = Date.now();
    const { text: outputText, modelUsed } = await callGeminiWithFallback(
      ai,
      base64Image
    );
    const geminiTime = Date.now() - geminiStart;

    let parsedData: any;
    try {
      const cleaned = cleanJson(outputText);
      parsedData = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[EXTRACT] JSON parsing failed:", parseErr, outputText);
      return NextResponse.json(
        {
          success: false,
          error: "Gemini returned unparseable JSON. Please retry.",
        },
        { status: 502 }
      );
    }

    const result = normalizeResult(parsedData);

    // Apply fallbacks from form inputs if missing from OCR
    if (!result.register_number && formRegNo) {
      result.register_number = formRegNo;
    }
    if (!result.semester && formSemester) {
      result.semester = formSemester;
    }

    if (result.subjects.length === 0) {
      result.warnings.push("No subjects were detected in the screenshot.");
    }

    // Calculations
    const previousCreditsMap = parsePreviousCredits(
      process.env.PREVIOUS_CREDITS_BY_SEMESTER
    );
    const activeSemester = result.semester || formSemester || "1";
    const previousCredits =
      previousCreditsMap[activeSemester] ??
      (Number(activeSemester) > 1 ? (Number(activeSemester) - 1) * 20 : 0);

    const previousCgpaVal = formPrevCgpa ? Number(formPrevCgpa) : null;
    const semesterGpa = calculateGpa(result.subjects);
    const updatedCgpa = calculateUpdatedCgpa(
      previousCgpaVal,
      previousCredits,
      result.subjects
    );

    const totalCreditHours = result.subjects.reduce(
      (sum, s) => sum + (Number(s.credit_hour) || 0),
      0
    );
    const totalCreditPoints = Number(
      result.subjects
        .reduce((sum, s) => sum + getSubjectCreditPoint(s), 0)
        .toFixed(2)
    );

    const totalTime = Date.now() - startTime;

    const payload = {
      student_name: result.student_name,
      register_number: result.register_number || formRegNo || null,
      semester: activeSemester,
      programme: result.programme,
      examination: result.examination,
      college_name: result.college_name,
      subjects: result.subjects,
      total_credit_hours: totalCreditHours,
      total_credit_points: totalCreditPoints,
      semester_gpa: semesterGpa,
      updated_cgpa: updatedCgpa,
      previous_cgpa: previousCgpaVal,
      previous_credits: previousCredits,
      warnings: result.warnings,
    };

    return NextResponse.json({
      success: true,
      data: payload,
      ...payload,
      meta: {
        model: modelUsed,
        processing_time_ms: totalTime,
        image_processing_ms: imageTime,
        gemini_processing_ms: geminiTime,
        original_image_size_bytes: file.size,
        optimized_image_size_bytes: optimizedBuffer.length,
        subject_count: result.subjects.length,
      },
    });
  } catch (error: any) {
    console.error("[EXTRACT] ERROR:", error);
    const message =
      error?.message || "Unable to process the result screenshot.";

    if (
      message.includes("503") ||
      message.toLowerCase().includes("service unavailable") ||
      message.toLowerCase().includes("high demand")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini AI is temporarily under high demand. Please retry in a few seconds.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}