import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, ssl: 'require' });

console.time('auth.users query');
try {
  const rows = await sql`SELECT id, email, raw_user_meta_data->>'firstName' as first_name FROM auth.users LIMIT 5`;
  console.timeEnd('auth.users query');
  console.log(`Found ${rows.length} users:`);
  rows.forEach(r => console.log(`  ${r.email} (${r.first_name})`));
} catch (err) {
  console.timeEnd('auth.users query');
  console.error('FAILED:', err);
}
await sql.end();
