"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  calculateGpa,
  calculateUpdatedCgpa,
  getSubjectCreditPoint,
  parsePreviousCredits,
  Subject,
} from "@/lib/calculations";

interface ExtractedPayload {
  student_name: string | null;
  register_number: string | null;
  semester: string | null;
  programme?: string | null;
  examination?: string | null;
  college_name?: string | null;
  subjects: Subject[];
  total_credit_hours?: number | null;
  total_credit_points?: number | null;
  semester_gpa?: number | null;
  updated_cgpa?: number | null;
  previous_cgpa?: number | null;
  previous_credits?: number | null;
  warnings?: string[];
  meta?: {
    model?: string;
    processing_time_ms?: number;
  };
}

export default function SubmitPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    registerNumber: "",
    previousCgpa: "",
    semester: "6",
  });
  const [result, setResult] = useState<ExtractedPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleFileChange(selectedFile: File | null) {
    if (!selectedFile) {
      setFile(null);
      setPreviewUrl(null);
      return;
    }
    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    setErrorMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setErrorMessage("Please select or drop a result screenshot image.");
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("registerNumber", form.registerNumber.trim());
      fd.append("previousCgpa", form.previousCgpa.trim());
      fd.append("semester", form.semester);

      const res = await fetch("/api/extract", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Failed to extract result from image."
        );
      }

      const extracted: ExtractedPayload = data.data || data;
      setResult(extracted);
    } catch (err: any) {
      setErrorMessage(
        err.message || "An unexpected error occurred during extraction."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell narrow">
      <div className="nav-header">
        <Link href="/" className="back">
          ← Back to Home
        </Link>
        <span className="badge">AI OCR & CALCULATION</span>
      </div>

      <div className="header-block">
        <h1>Student Result Submission</h1>
        <p className="muted">
          Upload a clear screenshot of your examination result. ResultFlow automatically extracts subjects, credit hours, grades, and credit points, then calculates your Semester GPA and Updated CGPA.
        </p>
      </div>

      <form onSubmit={submit} className="card form">
        <div className="form-grid">
          <label>
            <span>Register / Roll Number</span>
            <input
              placeholder="e.g. 21TD0123"
              value={form.registerNumber}
              onChange={(e) =>
                setForm({ ...form, registerNumber: e.target.value })
              }
            />
          </label>

          <label>
            <span>Previous Cumulative CGPA</span>
            <input
              type="number"
              min="0"
              max="10"
              step="0.01"
              placeholder="e.g. 8.45 (leave 0 if Sem 1)"
              value={form.previousCgpa}
              onChange={(e) =>
                setForm({ ...form, previousCgpa: e.target.value })
              }
            />
          </label>

          <label>
            <span>Current Semester</span>
            <select
              value={form.semester}
              onChange={(e) =>
                setForm({ ...form, semester: e.target.value })
              }
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="file-upload-zone">
          <span>Result Screenshot (JPG, PNG, WEBP)</span>
          <input
            required
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={(e) =>
              handleFileChange(e.target.files?.[0] ?? null)
            }
          />
          {previewUrl && (
            <div className="preview-container">
              <img
                src={previewUrl}
                alt="Screenshot Preview"
                className="image-thumbnail"
              />
              <span className="preview-label">
                {file?.name} ({(file ? file.size / 1024 : 0).toFixed(1)} KB)
              </span>
            </div>
          )}
        </label>

        {errorMessage && (
          <div className="error-banner">
            <strong>⚠️ Extraction Error:</strong> {errorMessage}
          </div>
        )}

        <button className="button submit-btn" disabled={busy}>
          {busy ? (
            <span className="spinner-text">
              <span className="spinner"></span> Extracting & Analyzing Results...
            </span>
          ) : (
            "Extract & Calculate Result"
          )}
        </button>
      </form>

      {result && (
        <ResultEditor
          initialData={result}
          previousCgpaInput={form.previousCgpa}
          semesterInput={form.semester}
        />
      )}
    </main>
  );
}

function ResultEditor({
  initialData,
  previousCgpaInput,
  semesterInput,
}: {
  initialData: ExtractedPayload;
  previousCgpaInput: string;
  semesterInput: string;
}) {
  const [data, setData] = useState<ExtractedPayload>(initialData);

  // Allow live editing of subject values
  function updateSubject(
    index: number,
    field: keyof Subject,
    value: string | number | null
  ) {
    const updated = [...(data.subjects || [])];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    // Auto-sync credit_point if credit_hour or grade_point changes
    if (field === "credit_hour" || field === "grade_point") {
      const ch = Number(field === "credit_hour" ? value : updated[index].credit_hour);
      const gp = Number(field === "grade_point" ? value : updated[index].grade_point);
      if (Number.isFinite(ch) && Number.isFinite(gp) && ch > 0) {
        updated[index].credit_point = Number((ch * gp).toFixed(2));
      }
    }

    setData({ ...data, subjects: updated });
  }

  function addSubjectRow() {
    const updated = [
      ...(data.subjects || []),
      {
        subject_code: "",
        subject_name: "New Subject",
        credit_hour: 3,
        marks: null,
        grade_point: 8,
        credit_point: 24,
        grade: "B+",
      },
    ];
    setData({ ...data, subjects: updated });
  }

  function removeSubjectRow(index: number) {
    const updated = (data.subjects || []).filter((_, i) => i !== index);
    setData({ ...data, subjects: updated });
  }

  // Dynamic calculations
  const totalCreditHours = useMemo(() => {
    return (data.subjects || []).reduce(
      (acc, s) => acc + (Number(s.credit_hour) || 0),
      0
    );
  }, [data.subjects]);

  const totalCreditPoints = useMemo(() => {
    return Number(
      (data.subjects || [])
        .reduce((acc, s) => acc + getSubjectCreditPoint(s), 0)
        .toFixed(2)
    );
  }, [data.subjects]);

  const semesterGpa = useMemo(() => {
    return calculateGpa(data.subjects || []);
  }, [data.subjects]);

  const previousCgpaVal = useMemo(() => {
    if (data.previous_cgpa != null) return Number(data.previous_cgpa);
    if (previousCgpaInput) return Number(previousCgpaInput);
    return null;
  }, [data.previous_cgpa, previousCgpaInput]);

  const previousCredits = useMemo(() => {
    if (data.previous_credits != null) return Number(data.previous_credits);
    const sem = Number(data.semester || semesterInput || 1);
    return sem > 1 ? (sem - 1) * 20 : 0;
  }, [data.previous_credits, data.semester, semesterInput]);

  const updatedCgpa = useMemo(() => {
    return calculateUpdatedCgpa(
      previousCgpaVal,
      previousCredits,
      data.subjects || []
    );
  }, [previousCgpaVal, previousCredits, data.subjects]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleConfirmSubmit() {
    if (!data.register_number) {
      alert("Please enter a valid register number before submitting.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_name: data.student_name,
          register_number: data.register_number,
          semester: data.semester || semesterInput,
          programme: data.programme || data.college_name,
          previous_cgpa: previousCgpaVal,
          previous_credits: previousCredits,
          subjects: data.subjects,
          semester_gpa: semesterGpa,
          updated_cgpa: updatedCgpa,
          warnings: data.warnings,
        }),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Failed to save submission.");
      }

      setSubmitSuccess(
        `Results for ${data.student_name || "Student"} (${data.register_number}) have been successfully submitted and saved! Your Class Advisor can now review and verify your score.`
      );
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit result to database.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="card result-section">
      <div className="result-header">
        <div>
          <h2>Academic Extraction Summary</h2>
          <p className="student-identity">
            <strong>{data.student_name || "Student Name not detected"}</strong>
            {data.register_number && (
              <span className="reg-pill">{data.register_number}</span>
            )}
            <span className="sem-pill">
              Semester {data.semester || semesterInput}
            </span>
          </p>
          {(data.programme || data.college_name) && (
            <p className="muted small-text">
              {[data.programme, data.college_name].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Credit Hours</span>
          <strong className="stat-value">{totalCreditHours}</strong>
        </div>
        <div className="stat-card highlight">
          <span className="stat-label">Semester GPA</span>
          <strong className="stat-value primary-color">
            {semesterGpa != null ? semesterGpa.toFixed(2) : "—"}
          </strong>
        </div>
        <div className="stat-card highlight-green">
          <span className="stat-label">Updated Cumulative CGPA</span>
          <strong className="stat-value green-color">
            {updatedCgpa != null ? updatedCgpa.toFixed(2) : "Needs Verification"}
          </strong>
          {previousCgpaVal != null && (
            <span className="stat-sub">
              (Prev CGPA: {previousCgpaVal.toFixed(2)} across {previousCredits} cr)
            </span>
          )}
        </div>
      </div>

      <div className="table-header-flex">
        <h3>Extracted Subjects ({data.subjects?.length || 0})</h3>
        <button
          type="button"
          className="button secondary small-btn"
          onClick={addSubjectRow}
        >
          + Add Subject Row
        </button>
      </div>

      <div className="tableWrap">
        <table className="interactive-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Code</th>
              <th>Subject Name</th>
              <th>Credits (C)</th>
              <th>Marks</th>
              <th>Grade</th>
              <th>Grade Pt (GP)</th>
              <th>Credit Pt (CP)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(data.subjects || []).map((s, idx) => (
              <tr key={idx}>
                <td className="muted">{idx + 1}</td>
                <td>
                  <input
                    className="cell-input code-input"
                    value={s.subject_code || ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateSubject(idx, "subject_code", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input name-input"
                    value={s.subject_name || ""}
                    onChange={(e) =>
                      updateSubject(idx, "subject_name", e.target.value)
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="10"
                    className="cell-input num-input"
                    value={s.credit_hour ?? ""}
                    onChange={(e) =>
                      updateSubject(
                        idx,
                        "credit_hour",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="cell-input num-input"
                    value={s.marks ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateSubject(
                        idx,
                        "marks",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    className="cell-input grade-input"
                    value={s.grade || ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateSubject(idx, "grade", e.target.value.toUpperCase())
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    className="cell-input num-input"
                    value={s.grade_point ?? ""}
                    placeholder="—"
                    onChange={(e) =>
                      updateSubject(
                        idx,
                        "grade_point",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </td>
                <td>
                  <input
                    type="number"
                    step="0.5"
                    className="cell-input num-input"
                    value={s.credit_point ?? ""}
                    onChange={(e) =>
                      updateSubject(
                        idx,
                        "credit_point",
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="delete-row-btn"
                    title="Remove subject"
                    onClick={() => removeSubjectRow(idx)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.warnings && data.warnings.length > 0 && (
        <div className="warning">
          <strong>⚠️ Extraction Notices:</strong>
          <ul>
            {data.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div className="error-banner" style={{ marginTop: "16px" }}>
          <strong>⚠️ Submission Failed:</strong> {submitError}
        </div>
      )}

      {submitSuccess && (
        <div className="success-banner" style={{ marginTop: "16px" }}>
          <strong>✅ Success!</strong> {submitSuccess}
        </div>
      )}

      <div className="result-actions">
        <button
          type="button"
          className="button"
          disabled={isSubmitting || !!submitSuccess}
          onClick={handleConfirmSubmit}
        >
          {isSubmitting ? (
            <span className="spinner-text">
              <span className="spinner"></span> Saving to Database...
            </span>
          ) : submitSuccess ? (
            "✓ Submission Confirmed"
          ) : (
            "Confirm & Submit Result to Class Advisor"
          )}
        </button>
      </div>
    </section>
  );

}