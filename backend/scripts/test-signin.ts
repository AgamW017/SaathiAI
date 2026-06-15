import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'admin@saathi.in',
    password: 'SaathiTest@123'
  });
  console.log("Auth error:", error);
  console.log("Auth user ID:", data?.user?.id);
  
  if (data?.user?.id) {
     const { data: userRow } = await supabase.from('users').select('*').eq('id', data.user.id).single();
     console.log("User row:", userRow);
  }
}

test();
