import { createClient } from '@supabase/supabase-js';

// Supabase URL i javni API ključ (pronađite ih na Supabase Dashboard > Settings > API)
const supabaseUrl = 'https://vyhxpbndpwokyybzmugb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5aHhwYm5kcHdva3l5YnptdWdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwMjkyMjksImV4cCI6MjA1MTYwNTIyOX0.z00dgXfozx-ya9zFQbSL-zz2VCMS7tXzhPbeUzUZleg';

export const supabase = createClient(supabaseUrl, supabaseKey);
