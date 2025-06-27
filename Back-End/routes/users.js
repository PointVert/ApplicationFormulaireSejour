const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const requireAdmin = require('../middleware/requireAdmin');

// GET /api/users - liste des utilisateurs
router.get('/', requireAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('user')
        .select('id, identifiant, role_id');

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.json(data);
});

// PUT /api/users/:id - mettre à jour le rôle et/ou mot de passe
router.put('/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    const { roleId, password } = req.body;

    if (!roleId) {
        return res.status(400).json({ error: 'roleId requis' });
    }

    let updateFields = { role_id: roleId };

    if (password && password.trim() !== '') {
        const hashed = await bcrypt.hash(password, 10);
        updateFields.password = hashed;
    }

    const { error } = await supabase
        .from('user')
        .update(updateFields)
        .eq('id', userId);

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Utilisateur mis à jour' });
});

router.delete('/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;

    // Optionnel : empêcher un admin de se supprimer lui-même
    if (req.admin && req.admin.id === userId) {
        return res.status(403).json({ error: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    const { error } = await supabase
        .from('user')
        .delete()
        .eq('id', userId);

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Utilisateur supprimé avec succès.' });
});

module.exports = router;