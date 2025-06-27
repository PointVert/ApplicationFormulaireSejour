// supabaseClient.js
const { createClient } = require('@supabase/supabase-js');

// Remplace avec tes variables d’environnement
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

module.exports = { supabase };