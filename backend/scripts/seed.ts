/**
 * db:seed — Populates the database with realistic test data.
 * Usage: pnpm run db:seed
 *
 * Seeds:
 *  - 3 officers (officer1@saathi.in, officer2@saathi.in, officer3@saathi.in)
 *  - 1 dssdo (dssdo@saathi.in)
 *  - 1 admin (admin@saathi.in)
 *  - 20 learners across 3 districts
 *  - 5 jobs
 *  - Some applications + 2 placements
 *  Default password for all seeded users: SaathiTest@123
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY!;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = 'SaathiTest@123';

const DISTRICTS = ['Ranchi', 'Dhanbad', 'Bokaro'];
const TRADES = ['Electrician', 'Plumber', 'Welder', 'Carpenter', 'Fitter', 'Mechanic'];

async function createUser(
  email: string,
  role: string,
  fullName: string,
  district?: string
) {
  // Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError && authError.code !== 'email_exists' && !authError.message.includes('already')) {
    console.error(`Failed to create auth user ${email}:`, authError.message);
    return null;
  }

  let userId = authData?.user?.id;
  if (!userId) {
    // User might already exist — try to find it
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const existing = users.find((u) => u.email === email);
    if (!existing) return null;
    userId = existing.id;
  }

  // Upsert profile
  await supabase.from('users').upsert({
    id: userId,
    email,
    role,
    full_name: fullName,
    district: district ?? null,
    is_active: true,
  });

  return userId;
}

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Staff users ────────────────────────────────────────────────────────────
  const adminId = await createUser('admin@saathi.in', 'admin', 'SaathiAI Admin');
  console.log(`✅ Admin: admin@saathi.in (id: ${adminId})`);

  const dssdoId = await createUser('dssdo@saathi.in', 'dssdo', 'Priya Singh', 'Jharkhand');
  console.log(`✅ DSSDO: dssdo@saathi.in (id: ${dssdoId})`);

  const officerIds: string[] = [];
  for (let i = 0; i < DISTRICTS.length; i++) {
    const email = `officer${i + 1}@saathi.in`;
    const id = await createUser(email, 'officer', `Officer ${DISTRICTS[i]}`, DISTRICTS[i]);
    if (id) officerIds.push(id);
    console.log(`✅ Officer: ${email} → ${DISTRICTS[i]} (id: ${id})`);
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const jobPayloads = [
    { title: 'Electrician Trainee', company: 'Tata Steel', location: 'Jamshedpur', trade: 'Electrician', salary_range: '₹15,000–₹20,000/mo', is_active: true },
    { title: 'Junior Welder', company: 'SAIL', location: 'Bokaro', trade: 'Welder', salary_range: '₹18,000–₹22,000/mo', is_active: true },
    { title: 'Plumbing Technician', company: 'L&T', location: 'Ranchi', trade: 'Plumber', salary_range: '₹14,000–₹18,000/mo', is_active: true },
    { title: 'Carpenter — Furniture', company: 'GodrejInterio', location: 'Dhanbad', trade: 'Carpenter', salary_range: '₹12,000–₹16,000/mo', is_active: true },
    { title: 'Auto Mechanic', company: 'Maruti Suzuki', location: 'Ranchi', trade: 'Mechanic', salary_range: '₹16,000–₹21,000/mo', is_active: false },
  ];

  const { data: jobs } = await supabase.from('jobs').insert(jobPayloads).select('id');
  console.log(`\n✅ Inserted ${jobs?.length ?? 0} jobs`);

  // ── Cohorts ───────────────────────────────────────────────────────────────
  const cohortIds: string[] = [];
  if (officerIds.length > 0) {
    const cohortPayloads = officerIds.map((officerId, i) => ({
      name: `Batch 2024-Q${(i % 4) + 1} - ${DISTRICTS[i % DISTRICTS.length]}`,
      officer_id: officerId,
    }));
    const { data: cohorts } = await supabase.from('cohorts').insert(cohortPayloads).select('id');
    if (cohorts) {
      cohortIds.push(...cohorts.map(c => c.id));
      console.log(`✅ Inserted ${cohorts.length} cohorts`);
    }
  }

  // ── Learners ──────────────────────────────────────────────────────────────
  const learnerPayloads = Array.from({ length: 20 }, (_, i) => ({
    phone: `9${String(8000000000 + i).slice(1)}`,
    full_name: `Learner ${i + 1}`,
    trade: TRADES[i % TRADES.length],
    district: DISTRICTS[i % DISTRICTS.length],
    state: 'Jharkhand',
    cohort_id: cohortIds[i % cohortIds.length] ?? null,
    status: (['active', 'active', 'active', 'at_risk', 'placed', 'dropped'] as const)[i % 6],
    risk_score: Math.floor(Math.random() * 80),
    officer_id: officerIds[i % officerIds.length] ?? null,
  }));

  const { data: learners, error: learnersErr } = await supabase
    .from('learners')
    .insert(learnerPayloads)
    .select('id');

  if (learnersErr) {
    console.error('Learner insert error:', learnersErr.message);
  } else {
    console.log(`✅ Inserted ${learners?.length ?? 0} learners`);
  }

  // ── Applications ───────────────────────────────────────────────────────────
  if (learners && jobs && learners.length >= 4 && jobs.length >= 3) {
    const apps = [
      { learner_id: learners[0].id, job_id: jobs[0].id, status: 'shortlisted' },
      { learner_id: learners[1].id, job_id: jobs[1].id, status: 'applied' },
      { learner_id: learners[2].id, job_id: jobs[2].id, status: 'hired' },
      { learner_id: learners[3].id, job_id: jobs[0].id, status: 'applied' },
    ];
    await supabase.from('applications').insert(apps);
    console.log(`✅ Inserted ${apps.length} applications`);

    // ── Placements ────────────────────────────────────────────────────────────
    if (officerIds[0] && learners[2] && jobs[2]) {
      await supabase.from('placements').insert([
        {
          learner_id: learners[2].id,
          job_id: jobs[2].id,
          confirmed_by: officerIds[0],
          placement_date: '2024-11-15',
          salary: 15000,
          notes: 'Seed placement record',
        },
      ]);
      console.log('✅ Inserted 1 placement');
    }
  }

  console.log('\n🎉 Seeding complete!');
  console.log('──────────────────────────────────────────');
  console.log('Default password for all users: SaathiTest@123');
  console.log('Admin:   admin@saathi.in');
  console.log('DSSDO:   dssdo@saathi.in');
  console.log('Officer: officer1@saathi.in / officer2@saathi.in / officer3@saathi.in');
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
