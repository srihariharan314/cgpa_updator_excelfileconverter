import Link from "next/link";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <span className="badge">RESULTFLOW v2</span>
        <h1>Student Result Collection & CGPA Automation</h1>
        <p>
          Students upload their result screenshot. ResultFlow extracts subjects,
          Credit Hours, Credit Points, grades and marks, calculates semester GPA,
          and prepares a verified Excel report for the advisor.
        </p>
        <div className="actions">
          <Link className="button" href="/submit">Student Submission</Link>
          <Link className="button secondary" href="/advisor">Advisor Dashboard</Link>
        </div>
      </section>
      <section className="grid">
        <div className="card"><h3>1. Upload</h3><p>Register number, previous CGPA, semester and result screenshot.</p></div>
        <div className="card"><h3>2. Extract</h3><p>AI reads Credit Hour and student-specific Credit Point values from the screenshot.</p></div>
        <div className="card"><h3>3. Verify</h3><p>Advisor checks extracted records before they become official output.</p></div>
        <div className="card"><h3>4. Export</h3><p>Generate a structured Excel workbook for the class.</p></div>
      </section>
    </main>
  );
}