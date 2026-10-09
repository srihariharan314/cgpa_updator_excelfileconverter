export type Subject = {
  subject_code?: string | null;
  subject_name: string;
  credit_hour: number | null;
  marks?: number | null;
  grade_point?: number | null;
  credit_point?: number | null;
  grade?: string | null;
};

export function getSubjectCreditPoint(s: Subject): number {
  if (s.credit_point != null && Number.isFinite(Number(s.credit_point))) {
    return Number(s.credit_point);
  }
  if (
    s.credit_hour != null &&
    s.grade_point != null &&
    Number.isFinite(Number(s.credit_hour)) &&
    Number.isFinite(Number(s.grade_point))
  ) {
    return Number(s.credit_hour) * Number(s.grade_point);
  }
  return 0;
}

export function calculateGpa(subjects: Subject[]): number | null {
  const validSubjects = subjects.filter(
    (s) => s.credit_hour != null && Number(s.credit_hour) > 0
  );
  const totalHours = validSubjects.reduce(
    (acc, s) => acc + Number(s.credit_hour || 0),
    0
  );
  if (totalHours === 0) return null;

  const totalPoints = validSubjects.reduce(
    (acc, s) => acc + getSubjectCreditPoint(s),
    0
  );
  return Number((totalPoints / totalHours).toFixed(2));
}

export function calculateUpdatedCgpa(
  previousCgpa: number | null | undefined,
  previousCredits: number | null | undefined,
  subjects: Subject[]
): number | null {
  const validSubjects = subjects.filter(
    (s) => s.credit_hour != null && Number(s.credit_hour) > 0
  );
  const currentCredits = validSubjects.reduce(
    (acc, s) => acc + Number(s.credit_hour || 0),
    0
  );
  const currentPoints = validSubjects.reduce(
    (acc, s) => acc + getSubjectCreditPoint(s),
    0
  );

  if (currentCredits === 0) return null;

  const prevCgpaNum = previousCgpa != null ? Number(previousCgpa) : 0;
  const prevCreditsNum = previousCredits != null ? Number(previousCredits) : 0;

  if (
    !Number.isFinite(prevCreditsNum) ||
    prevCreditsNum <= 0 ||
    !Number.isFinite(prevCgpaNum) ||
    prevCgpaNum <= 0
  ) {
    return Number((currentPoints / currentCredits).toFixed(2));
  }

  const totalPoints = prevCgpaNum * prevCreditsNum + currentPoints;
  const totalCredits = prevCreditsNum + currentCredits;

  return Number((totalPoints / totalCredits).toFixed(2));
}

export function parsePreviousCredits(raw?: string): Record<string, number> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}