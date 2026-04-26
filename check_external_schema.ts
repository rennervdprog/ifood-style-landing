import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const url = Deno.env.get('EXTERNAL_SUPABASE_URL')
const key = Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY')

if (!url || !key) {
  console.error('Missing external Supabase credentials')
  Deno.exit(1)
}

const supabase = createClient(url, key)

async function checkSchema() {
  const tables = ['stores', 'orders', 'addon_groups']
  
  for (const table of tables) {
    console.log(\`Checking table: \${table}\`)
    const { data, error } = await supabase.rpc('get_table_info', { t_name: table })
    
    if (error) {
      // If RPC fails, try information_schema query via raw SQL if possible, 
      // but through JS we are limited unless we have a custom RPC.
      // Let's try to just select 1 row to see if it works and check columns if error occurs.
      const { error: selectError } = await supabase.from(table).select('*').limit(1)
      if (selectError) {
        console.log(\`Error on \${table}: \${selectError.message}\`)
      } else {
        console.log(\`Table \${table} exists and is accessible.\`)
      }
    } else {
      console.log(data)
    }
  }
}

// Since I can't easily run arbitrary SQL on the external DB without an RPC,
// I will instead try to fetch the local schema and compare it with the errors the user provided.
// The user already provided the errors which are very specific.
checkSchema()
