# ResultFlow v2

A Next.js MVP for collecting student result screenshots, extracting subject-level academic data, calculating semester GPA, updating CGPA, and preparing advisor reports.

## Confirmed result structure

For EACH student:
- Credit Hour comes from the uploaded result.
- Credit Point comes from that student's performance/result and may differ between students.
- Marks and Grade are extracted when present.
- Previous CGPA is supplied by the student.
- Semester GPA is calculated as:

  GPA = SUM(Credit Hour * Credit Point) / SUM(Credit Hour)

- Updated CGPA requires the previous CGPA AND the cumulative credits represented by that previous CGPA.

## Setup

1. Install Node.js 20+.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project.
4. Run `supabase/schema.sql` in Supabase SQL Editor.
5. Create a Storage bucket named `result-screenshots`.
6. Add your Gemini API key.
7. IMPORTANT: replace `PREVIOUS_CREDITS_BY_SEMESTER` with your official curriculum's cumulative credits. The bundled values are placeholders only.
8. Run:

   npm install
   npm run dev

9. Open http://localhost:3000/submit

## Important calculation detail

`PREVIOUS_CREDITS_BY_SEMESTER` does NOT contain student credit points.

It contains the total credits completed BEFORE the selected semester. For example, the value for semester 6 is the credits from semesters 1-5.

Credit Point is extracted separately for each student and each subject from the screenshot.

## Production recommendations

- Replace the simple advisor API-key gate with Supabase Auth + role-based access.
- Add server-side Supabase persistence after extraction.
- Upload original screenshots to a private Storage bucket.
- Add advisor verification/edit controls before Excel generation.
- Implement Excel generation from verified records.
- Add duplicate register-number protection.
- Test extraction against several real result screenshots before accepting records automatically.
