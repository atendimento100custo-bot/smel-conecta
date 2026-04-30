import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://pgkyvgmlfmgptxyhovqk.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBna3l2Z21sZm1ncHR4eWhvdnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTkzNzk4MiwiZXhwIjoyMDkxNTEzOTgyfQ.IORqMIovCDV0LvheICTQH-46dAaphVZz7AD0ldpXLKg')
const { data, error } = await sb.from('polos').update({ tipo: 'Quadras' }).ilike('tipo', '%kart%').select()
console.log('Updated:', data, error)
