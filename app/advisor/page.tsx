"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface SubjectRow {
  id?: string;
  subject_code?: string | null;
  subject_name: string;
  credit_hour: number;
  marks?: number | null;
  grade?: string | null;
  credit_point: number;
}

interface SemesterResult {
  id?: string;
  semester: number;
  semester_gpa?: number | null;
  updated_cgpa?: number | null;
  result_status?: string | null;
  warnings?: string[];
  verified_by?: string | null;
  verified_at?: string | null;
}

interface StudentSubmission {
  id: string;
  register_number: string;
  name: string | null;
  department: string | null;
  semester: number;
  previous_cgpa: number | null;
  previous_credits: number | null;
  extraction_status: string;
  verification_status: "pending" | "verified" | "rejected" | string;
  created_at: string;
  semester_results?: SemesterResult[];
  result_subjects?: SubjectRow[];
}

export default function AdvisorPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [checking, setChecking] = useState(false);

  // Auto-load saved key if any
  useEffect(() => {
    const saved = sessionStorage.getItem("rf_advisor_key");
    if (saved) {
      setKey(saved);
      verifyKey(saved);
    }
  }, []);

  async function verifyKey(candidateKey: string) {
    if (!candidateKey.trim()) return;
    setChecking(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/advisor", {
        headers: { Authorization: `Bearer ${candidateKey.trim()}` },
      });
      if (res.ok) {
        sessionStorage.setItem("rf_advisor_key", candidateKey.trim());
        setAuthed(true);
      } else {
        setErrorMsg("Invalid advisor API key. Please check your credentials.");
      }
    } catch {
      setErrorMsg("Failed to connect to server.");
    } finally {
      setChecking(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("rf_advisor_key");
    setAuthed(false);
    setKey("");
  }

  return (
    <main className="shell">
      <div className="nav-header">
        <Link href="/" className="back">
          ← Back to Home
        </Link>
        {authed && (
          <button
            type="button"
            className="button secondary small-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        )}
      </div>

      {!authed ? (
        <section className="card form narrow" style={{ margin: "40px auto" }}>
          <div className="header-block">
            <span className="badge">ADVISOR PORTAL</span>
            <h1>Class Advisor Sign In</h1>
            <p className="muted">
              Enter your Class Advisor access key to view, verify, and export student result submissions.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyKey(key);
            }}
            className="form"
            style={{ marginTop: "16px" }}
          >
            <label>
              <span>Advisor Access Key</span>
              <input
                type="password"
                placeholder="Enter Advisor Key"
                value={key}
                required
                onChange={(e) => setKey(e.target.value)}
              />
            </label>

            {errorMsg && (
              <div className="error-banner">
                <strong>⚠️ Access Denied:</strong> {errorMsg}
              </div>
            )}

            <button className="button submit-btn" disabled={checking}>
              {checking ? (
                <span className="spinner-text">
                  <span className="spinner"></span> Verifying...
                </span>
              ) : (
                "Open Advisor Dashboard"
              )}
            </button>
          </form>
        </section>
      ) : (
        <Dashboard keyValue={key} />
      )}
    </main>
  );
}

function Dashboard({ keyValue }: { keyValue: string }) {
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] =
    useState<StudentSubmission | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/advisor", {
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load submissions.");
      }
      setSubmissions(json.data || []);
    } catch (err: any) {
      setError(err.message || "Failed to fetch student data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [keyValue]);

  async function updateStatus(
    studentId: string,
    newStatus: "verified" | "rejected" | "pending"
  ) {
    setActionInProgress(studentId);
    try {
      const res = await fetch("/api/advisor", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyValue}`,
        },
        body: JSON.stringify({
          student_id: studentId,
          verification_status: newStatus,
        }),
      });
      if (res.ok) {
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === studentId ? { ...s, verification_status: newStatus } : s
          )
        );
        if (selectedStudent && selectedStudent.id === studentId) {
          setSelectedStudent({
            ...selectedStudent,
            verification_status: newStatus,
          });
        }
      } else {
        alert("Failed to update status.");
      }
    } catch (err: any) {
      alert(err.message || "Error updating status.");
    } finally {
      setActionInProgress(null);
    }
  }

  async function deleteSubmission(studentId: string, regNo: string) {
    if (
      !confirm(
        `Are you sure you want to delete submission for Register No: ${regNo}?`
      )
    ) {
      return;
    }

    setActionInProgress(studentId);
    try {
      const res = await fetch(`/api/advisor?student_id=${studentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${keyValue}` },
      });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== studentId));
        if (selectedStudent?.id === studentId) {
          setSelectedStudent(null);
        }
      } else {
        alert("Failed to delete record.");
      }
    } catch (err: any) {
      alert(err.message || "Error deleting record.");
    } finally {
      setActionInProgress(null);
    }
  }

  // Filtered submissions
  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const matchSearch =
        (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.register_number || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (s.department || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus =
        statusFilter === "all" || s.verification_status === statusFilter;

      const matchSemester =
        semesterFilter === "all" || String(s.semester) === semesterFilter;

      return matchSearch && matchStatus && matchSemester;
    });
  }, [submissions, searchTerm, statusFilter, semesterFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = submissions.length;
    const verified = submissions.filter(
      (s) => s.verification_status === "verified"
    ).length;
    const pending = submissions.filter(
      (s) => s.verification_status === "pending" || !s.verification_status
    ).length;

    const gpas = submissions
      .map((s) => s.semester_results?.[0]?.semester_gpa)
      .filter((g): g is number => g != null && !isNaN(g));
    const avgGpa =
      gpas.length > 0
        ? (gpas.reduce((a, b) => a + b, 0) / gpas.length).toFixed(2)
        : "—";

    const cgpas = submissions
      .map((s) => s.semester_results?.[0]?.updated_cgpa)
      .filter((c): c is number => c != null && !isNaN(c));
    const avgCgpa =
      cgpas.length > 0
        ? (cgpas.reduce((a, b) => a + b, 0) / cgpas.length).toFixed(2)
        : "—";

    return { total, verified, pending, avgGpa, avgCgpa };
  }, [submissions]);

  return (
    <section>
      <div className="header-block">
        <span className="badge">ADVISOR DASHBOARD</span>
        <h1>Class Academic Performance</h1>
        <p className="muted">
          Review, verify, and export examination results uploaded by students.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid" style={{ margin: "24px 0" }}>
        <div className="stat-card">
          <span className="stat-label">Total Submissions</span>
          <strong className="stat-value">{metrics.total}</strong>
        </div>
        <div className="stat-card highlight-green">
          <span className="stat-label">Verified Records</span>
          <strong className="stat-value green-color">{metrics.verified}</strong>
        </div>
        <div className="stat-card highlight">
          <span className="stat-label">Pending Verification</span>
          <strong className="stat-value primary-color">{metrics.pending}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Class Average GPA</span>
          <strong className="stat-value">{metrics.avgGpa}</strong>
        </div>
        <div className="stat-card">
          <span className="stat-label">Class Average CGPA</span>
          <strong className="stat-value">{metrics.avgCgpa}</strong>
        </div>
      </div>

      {/* Control Bar */}
      <div className="card" style={{ padding: "18px 22px", marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: "10px", flex: "1 1 300px" }}>
            <input
              placeholder="Search by Name or Register No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#fff",
                width: "100%",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#fff",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={semesterFilter}
              onChange={(e) => setSemesterFilter(e.target.value)}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "10px 14px",
                color: "#fff",
              }}
            >
              <option value="all">All Semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Sem {s}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="button secondary small-btn"
              onClick={loadData}
              disabled={loading}
            >
              🔄 Refresh
            </button>

            <a
              className="button small-btn"
              href="/api/export"
              download
              title="Download Class Result Excel/CSV"
            >
              📥 Export Excel/CSV
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: "20px" }}>
          <strong>⚠️ Error:</strong> {error}
        </div>
      )}

      {/* Submissions Table */}
      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "40px" }}>
          <span className="spinner" style={{ display: "inline-block" }}></span>
          <p className="muted" style={{ marginTop: "12px" }}>
            Loading student submissions from Supabase...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
          <h3>No student submissions found</h3>
          <p className="muted" style={{ maxWidth: "500px", margin: "8px auto 20px" }}>
            {submissions.length === 0
              ? "No students have submitted examination results yet. Direct students to the Submission page to upload their scorecards."
              : "No submissions match your active filter criteria."}
          </p>
          <Link href="/submit" className="button small-btn">
            Open Student Submission Page
          </Link>
        </div>
      ) : (
        <div className="tableWrap">
          <table className="interactive-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Register No</th>
                <th>Student Name</th>
                <th>Sem</th>
                <th>Prev CGPA</th>
                <th>Sem GPA</th>
                <th>Updated CGPA</th>
                <th>Subjects</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((st, idx) => {
                const res = st.semester_results?.[0];
                const subjCount = st.result_subjects?.length || 0;
                const status = st.verification_status || "pending";
                const isBusy = actionInProgress === st.id;

                return (
                  <tr key={st.id}>
                    <td className="muted">{idx + 1}</td>
                    <td>
                      <strong style={{ fontFamily: "var(--font-mono)" }}>
                        {st.register_number}
                      </strong>
                    </td>
                    <td>
                      <div>{st.name || "—"}</div>
                      {st.department && (
                        <div
                          className="muted"
                          style={{ fontSize: "11px", marginTop: "2px" }}
                        >
                          {st.department}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="sem-pill">Sem {st.semester}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)" }}>
                      {st.previous_cgpa != null
                        ? Number(st.previous_cgpa).toFixed(2)
                        : "—"}
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          color:
                            res?.semester_gpa != null && res.semester_gpa >= 8
                              ? "var(--primary)"
                              : res?.semester_gpa != null && res.semester_gpa >= 6
                              ? "var(--accent-green)"
                              : "#fca5a5",
                        }}
                      >
                        {res?.semester_gpa != null
                          ? Number(res.semester_gpa).toFixed(2)
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <strong
                        style={{
                          fontFamily: "var(--font-mono)",
                          color: "var(--accent-green)",
                        }}
                      >
                        {res?.updated_cgpa != null
                          ? Number(res.updated_cgpa).toFixed(2)
                          : "—"}
                      </strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button secondary small-btn"
                        style={{ padding: "4px 10px", fontSize: "12px" }}
                        onClick={() => setSelectedStudent(st)}
                      >
                        {subjCount} courses 🔍
                      </button>
                    </td>
                    <td>
                      <span
                        className={`status-badge status-${status}`}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "9999px",
                          fontSize: "12px",
                          fontWeight: 700,
                          textTransform: "capitalize",
                          background:
                            status === "verified"
                              ? "rgba(52, 211, 153, 0.15)"
                              : status === "rejected"
                              ? "rgba(239, 68, 68, 0.15)"
                              : "rgba(251, 191, 36, 0.15)",
                          color:
                            status === "verified"
                              ? "#34d399"
                              : status === "rejected"
                              ? "#f87171"
                              : "#fbbf24",
                          border: `1px solid ${
                            status === "verified"
                              ? "rgba(52, 211, 153, 0.3)"
                              : status === "rejected"
                              ? "rgba(239, 68, 68, 0.3)"
                              : "rgba(251, 191, 36, 0.3)"
                          }`,
                        }}
                      >
                        {status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {status !== "verified" && (
                          <button
                            type="button"
                            className="button small-btn"
                            style={{
                              padding: "4px 8px",
                              fontSize: "11px",
                              background: "var(--accent-green)",
                              color: "#042f2e",
                            }}
                            disabled={isBusy}
                            onClick={() => updateStatus(st.id, "verified")}
                          >
                            ✓ Verify
                          </button>
                        )}
                        {status !== "rejected" && (
                          <button
                            type="button"
                            className="button secondary small-btn"
                            style={{ padding: "4px 8px", fontSize: "11px" }}
                            disabled={isBusy}
                            onClick={() => updateStatus(st.id, "rejected")}
                          >
                            ✕ Reject
                          </button>
                        )}
                        <button
                          type="button"
                          className="delete-row-btn"
                          title="Delete submission"
                          disabled={isBusy}
                          onClick={() =>
                            deleteSubmission(st.id, st.register_number)
                          }
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Details Modal */}
      {selectedStudent && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setSelectedStudent(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: "800px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <div>
                <h2>{selectedStudent.name || "Student Result Breakdown"}</h2>
                <p className="student-identity">
                  <span className="reg-pill">
                    {selectedStudent.register_number}
                  </span>
                  <span className="sem-pill">
                    Semester {selectedStudent.semester}
                  </span>
                  {selectedStudent.department && (
                    <span className="muted" style={{ fontSize: "13px" }}>
                      · {selectedStudent.department}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="delete-row-btn"
                style={{ fontSize: "20px" }}
                onClick={() => setSelectedStudent(null)}
              >
                ✕
              </button>
            </div>

            <div className="stats-grid" style={{ margin: "16px 0" }}>
              <div className="stat-card">
                <span className="stat-label">Previous CGPA</span>
                <strong className="stat-value">
                  {selectedStudent.previous_cgpa != null
                    ? Number(selectedStudent.previous_cgpa).toFixed(2)
                    : "—"}
                </strong>
                <span className="stat-sub">
                  ({selectedStudent.previous_credits ?? 0} prev credits)
                </span>
              </div>
              <div className="stat-card highlight">
                <span className="stat-label">Semester GPA</span>
                <strong className="stat-value primary-color">
                  {selectedStudent.semester_results?.[0]?.semester_gpa != null
                    ? Number(
                        selectedStudent.semester_results[0].semester_gpa
                      ).toFixed(2)
                    : "—"}
                </strong>
              </div>
              <div className="stat-card highlight-green">
                <span className="stat-label">Updated CGPA</span>
                <strong className="stat-value green-color">
                  {selectedStudent.semester_results?.[0]?.updated_cgpa != null
                    ? Number(
                        selectedStudent.semester_results[0].updated_cgpa
                      ).toFixed(2)
                    : "—"}
                </strong>
              </div>
            </div>

            <h3>Course Details ({selectedStudent.result_subjects?.length || 0})</h3>
            <div className="tableWrap" style={{ margin: "12px 0" }}>
              <table className="interactive-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Course Code</th>
                    <th>Course Name</th>
                    <th>Credits (C)</th>
                    <th>Marks</th>
                    <th>Grade</th>
                    <th>Credit Point (CP)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedStudent.result_subjects || []).map((s, idx) => (
                    <tr key={idx}>
                      <td className="muted">{idx + 1}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>
                        {s.subject_code || "—"}
                      </td>
                      <td>
                        <strong>{s.subject_name}</strong>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>
                        {s.credit_hour}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>
                        {s.marks != null ? s.marks : "—"}
                      </td>
                      <td>
                        <span
                          className="grade-input"
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            background: "rgba(45, 212, 191, 0.1)",
                            borderRadius: "4px",
                          }}
                        >
                          {s.grade || "—"}
                        </span>
                      </td>
                      <td
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                        }}
                      >
                        {s.credit_point}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "24px",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  className="button small-btn"
                  style={{ background: "var(--accent-green)", color: "#042f2e" }}
                  onClick={() => {
                    updateStatus(selectedStudent.id, "verified");
                  }}
                >
                  ✓ Mark as Verified
                </button>
                <button
                  type="button"
                  className="button secondary small-btn"
                  onClick={() => {
                    updateStatus(selectedStudent.id, "rejected");
                  }}
                >
                  ✕ Reject Record
                </button>
              </div>
              <button
                type="button"
                className="button secondary small-btn"
                onClick={() => setSelectedStudent(null)}
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}