import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jwkylhokwemewmrugjws.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3a3lsaG9rd2VtZXdtcnVnandzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNTg5ODQsImV4cCI6MjA3OTgzNDk4NH0.vBWqxaMM0IAuYt_vNWriDMxk14qNvVp3m7lkwYCYADY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);