# ResultFlow v2 implementation notes

The important v2 change is per-student subject extraction.

Each subject record:
- credit_hour: extracted from screenshot
- credit_point: extracted from screenshot, varies by student
- marks: extracted when present
- grade: extracted when present

Semester GPA:
SUM(credit_hour * credit_point) / SUM(credit_hour)

Updated CGPA:
(previous_cgpa * previous_completed_credits + current_weighted_points)
/
(previous_completed_credits + current_credit_hours)

The current `/api/export` is intentionally a safe placeholder until the Supabase persistence/verification workflow is connected. Do not treat it as a finished official Excel exporter yet.
