import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://rnlyksbzoowbuiimfvof.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubHlrc2J6b293YnVpaW1mdm9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MDM5MTUsImV4cCI6MjA5NTM3OTkxNX0.r9d2NQGwB-EJfrKQ-YgNx3_COTPFyr6TrFH1TGLe31Q'
)