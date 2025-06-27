const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabase } = require('../supabaseClient');
const requireAdmin = require('../middleware/requireAdmin');

// GET /api/role - Liste tous les roles et leurs formulaires
router.get('/', requireAdmin, async (req, res) => {
    const { data, error } = await supabase
        .from('role')
        .select(`
    id,
    nom,
    role_formulaire (
      formulaire (
        identifiant_formulaire,
        titre
      )
    )
  `);
    if (error) return res.status(500).json({ error: error.message });

    // Regrouper par role
    const grouped = {};
    data.forEach(role => {
        const { id, nom, role_formulaire } = role;
        if (!grouped[id]) {
            grouped[id] = { id, name: nom, forms: [] };
        }

        // Ajouter les formulaires lies s'ils existent
        if (Array.isArray(role_formulaire)) {
            role_formulaire.forEach(rf => {
                if (rf.formulaire) {
                    grouped[id].forms.push(rf.formulaire);
                }
            });
        }
    });

    res.json(Object.values(grouped));
});

// POST /api/role - Cree un role et le lie a un ou plusieurs formulaires
router.post('/', requireAdmin, async (req, res) => {
    const { role, formIds } = req.body;

    if (!role || !formIds || !Array.isArray(formIds)) {
        return res.status(400).json({ error: 'role et formIds requis et doivent être valides' });
    }

    // Verifie si le role existe deja
    const { data: existingRole } = await supabase
        .from('role')
        .select('*')
        .eq('nom', role)
        .single();

    let roleId;
    if (existingRole) {
        roleId = existingRole.id;
    } else {
        const { data: newRole, error: roleErr } = await supabase
            .from('role')
            .insert({ nom: role })
            .select()
            .single();
        if (roleErr) return res.status(500).json({ error: roleErr.message });
        roleId = newRole.id;
    }

    // Recupère les liaisons deja existantes
    const { data: existingLinks, error: fetchErr } = await supabase
        .from('role_formulaire')
        .select('id_formulaire')
        .eq('id_role', roleId);

    if (fetchErr) return res.status(500).json({ error: fetchErr.message });

    const existingFormIds = existingLinks.map(link => link.form_id);
    const newFormIds = formIds.filter(id => !existingFormIds.includes(id));

    if (newFormIds.length === 0) {
        return res.json({ message: 'Aucune nouvelle liaison a ajouter (liens deja existants).' });
    }

    const roleFormLinks = newFormIds.map(formId => ({
        id_role: roleId,
        id_formulaire: formId
    }));

    const { error: insertErr } = await supabase
        .from('role_formulaire')
        .insert(roleFormLinks);

    console.log(insertErr)
    if (insertErr) return res.status(500).json({ error: insertErr.message });


    res.json({ message: 'Role cree et lie avec succes', roleId });
});

// PUT /api/role/:id - Modifie les formulaires associes
router.put('/:id', requireAdmin, async (req, res) => {
    const roleId = req.params.id;
    const { formIds } = req.body;

    if (!roleId || !Array.isArray(formIds)) {
        return res.status(400).json({ error: 'id du role et tableau formIds requis' });
    }

    // Verifie si le role existe
    const { data: roleExists, error: roleErr } = await supabase
        .from('role')
        .select('id')
        .eq('id', roleId)
        .single();

    if (roleErr || !roleExists) {
        return res.status(404).json({ error: 'Role introuvable' });
    }

    // Supprime les associations existantes
    const { error: deleteErr } = await supabase
        .from('role_formulaire')
        .delete()
        .eq('id_role', roleId);

    if (deleteErr) {
        return res.status(500).json({ error: 'Erreur lors de la suppression des anciennes associations' });
    }

    // Prepare les nouvelles associations
    const links = formIds.map(formId => ({
        id_role: roleId,
        id_formulaire: formId
    }));

    // Insere les nouvelles associations
    const { error: insertErr } = await supabase
        .from('role_formulaire')
        .insert(links);

    if (insertErr) {
        return res.status(500).json({ error: 'Erreur lors de la creation des nouvelles associations' });
    }

    res.json({ message: 'Associations mises a jour avec succès' });
});

// DELETE /api/role/:id - Supprime un role et ses liens
router.delete('/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('role')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: 'Role supprime.' });
});

module.exports = router;