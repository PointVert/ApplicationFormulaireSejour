const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const crypto = require('crypto');
const sendResetEmail = require('../sendEmail');
const bcrypt = require('bcrypt');
const { BASE_URL } = process.env;

// POST /api/reset-request
router.post('/reset-request', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email requis.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 1000 * 60 * 60);

    await supabase.from('reset_tokens').insert({ email, token, expires_at: expires });

    const resetLink = `${BASE_URL}/reset-password?token=${token}`;

    const result = await sendResetEmail(email, resetLink);
    if (!result.success) {
        return res.status(500).json({ error: 'Erreur envoi mail.' });
    }

    res.json({ message: 'Email envoye si l’utilisateur existe.' });
});

// POST /api/reset-password
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;

    const { data, error } = await supabase
        .from('reset_tokens')
        .select('*')
        .eq('token', token)
        .single();

    if (error || !data || new Date(data.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Token invalide ou expire.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const { error: updateErr } = await supabase
        .from('user')
        .update({ password: hashedPassword })
        .eq('identifiant', data.email);

    if (updateErr) return res.status(500).json({ error: updateErr.message });

    // Supprimer le token apres usage
    await supabase.from('reset_tokens').delete().eq('token', token);

    res.json({ message: 'Mot de passe mis a jour.' });
});
module.exports = router;