const express = require('express');
const router = express.Router();
const { supabase } = require('../supabaseClient');
const authenticateJWT = require('../middleware/authenticateJWT');
const isAdmin = require('../utils/isAdmin');

// GET /api/progress/:progressionId - récupérer les réponses d'une progression pour un rôle
router.get('/:progressionId', authenticateJWT, async (req, res) => {
    const { progressionId } = req.params;

    const { data, error } = await supabase
        .from('reponse_en_cours')
        .select('*')
        .eq('progression_id', progressionId)

    if (error) return res.status(500).json({ error: error.message });
    console.log(data)
    res.json(data);
});

// POST /api/progress - sauvegarder une réponse en cours
router.post('/', authenticateJWT, async (req, res) => {
    const { nameFile, formId, answers } = req.body;
    const id_role = req.user.role?.id;
    console.log(answers)
    if (!nameFile || !formId || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'Données de requête invalides.' });
    }

    const inserts = [];

    for (const { question_id, answer } of answers) {
        if (question_id == -1)
            continue

        const isActivityOrSupportTable = Array.isArray(answer) && (typeof answer[0] === 'string');

        if (isActivityOrSupportTable) {
            console.log("Tableau accompagne/activite")
            const lines = Array.isArray(answer) ? answer : [answer];
            for (const line of lines) {
                inserts.push({
                    progression_id: nameFile,
                    identifiant_formulaire: formId,
                    id_question: question_id,
                    id_role,
                    id_reponse: null,
                    reponse_texte: line,
                    date_modification: new Date()
                });
            }
            continue;
        }

        const isMultiple = Array.isArray(answer);
        if (isMultiple) {
            console.log("Checkbox")
            for (const repId of answer) {
                inserts.push({
                    progression_id: nameFile,
                    identifiant_formulaire: formId,
                    id_question: question_id,
                    id_role,
                    id_reponse: repId,
                    reponse_texte: null,
                    date_modification: new Date()
                });
            }
        } else {
            console.log("Text/radio")
            const isId = typeof answer === 'string' && answer.startsWith('reponse_'); // Ajustez selon vos IDs
            inserts.push({
                progression_id: nameFile,
                identifiant_formulaire: formId,
                id_question: question_id,
                id_role,
                id_reponse: isId ? answer : null,
                reponse_texte: !isId ? answer : null,
                date_modification: new Date()
            });
        }
    }

    // Nettoie d'abord les anciennes réponses pour ce rôle et cette progression + question
    const { error: deleteErr } = await supabase
        .from('reponse_en_cours')
        .delete()
        .eq('progression_id', nameFile)
        .eq('id_role', id_role);

    if (deleteErr) return res.status(500).json({ error: deleteErr.message });

    const { error: insertErr } = await supabase
        .from('reponse_en_cours')
        .insert(inserts);

    console.log(inserts)
    console.log(insertErr)
    if (insertErr) return res.status(500).json({ error: insertErr.message });

    res.json({ message: 'Réponses sauvegardées avec succès.' });
});

// GET /api/progress/formulaires/groupes - lister les groupes de progression disponibles pour le rôle
router.get('/formulaires/groupes', authenticateJWT, async (req, res) => {
    const userRoleId = req.user.role?.id;
    console.log("get list reponses")
    try {
        // Récupération des formulaires accessibles
        let formulaireIds = [];

        if (await isAdmin(userRoleId)) {
            const { data: allForms, error } = await supabase
                .from('formulaire')
                .select('identifiant_formulaire');
            if (error) throw error;
            formulaireIds = allForms.map(f => f.identifiant_formulaire);
        } else {
            const { data: linkedForms, error } = await supabase
                .from('role_formulaire')
                .select('id_formulaire')
                .eq('id_role', userRoleId);
            if (error) throw error;
            formulaireIds = linkedForms.map(lf => lf.id_formulaire);
        }

        // Progressions pour ce rôle
        const { data: progressions, error: progErr } = await supabase
            .from('reponse_en_cours')
            .select('identifiant_formulaire, progression_id')
            .eq('id_role', userRoleId)
            .in('identifiant_formulaire', formulaireIds);

        console.log(progErr)
        if (progErr) return res.status(500).json({ error: progErr.message });

        const grouped = {};
        for (const { identifiant_formulaire, progression_id } of progressions) {
            if (!grouped[identifiant_formulaire]) {
                grouped[identifiant_formulaire] = new Set();
            }
            grouped[identifiant_formulaire].add(progression_id);
        }

        const result = Object.entries(grouped).map(([formId, progSet]) => ({
            identifiant_formulaire: formId,
            progressions: Array.from(progSet)
        }));

        console.log(result)
        res.json(result);
    } catch (err) {
        console.error('Erreur /api/progress/formulaires/groupes :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
