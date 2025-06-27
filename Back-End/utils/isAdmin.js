
const { supabase } = require('../supabaseClient');

async function isAdmin(roleId) {
    const { data, error } = await supabase
        .from('role')
        .select('nom')
        .eq('id', roleId)
        .single();

    return data?.nom?.toLowerCase() === 'admin';
}
module.exports = isAdmin;