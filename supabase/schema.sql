create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  register_number text not null unique,
  name text,
  department text,
  semester int,
  previous_cgpa numeric(4,2),
  previous_credits numeric(8,2),
  screenshot_url text,
  extraction_status text default 'pending',
  verification_status text default 'pending',
  created_at timestamptz default now()
);

create table if not exists result_subjects (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  subject_code text,
  subject_name text not null,
  credit_hour numeric(6,2) not null,
  marks numeric(6,2),
  grade text,
  credit_point numeric(6,2) not null,
  created_at timestamptz default now()
);

create table if not exists semester_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  semester int not null,
  semester_gpa numeric(5,2),
  updated_cgpa numeric(5,2),
  result_status text,
  warnings jsonb default '[]'::jsonb,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists result_subjects_student_idx on result_subjects(student_id);
create index if not exists semester_results_student_idx on semester_results(student_id);

-- Create a Storage bucket named "result-screenshots" in Supabase Storage.
-- Do not expose service-role keys in browser code.
