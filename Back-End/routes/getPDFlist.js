const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const authenticateJWT = require('../middleware/authenticateJWT');

// GET /api/pdf/all - Renvoie tous les PDF groupés par formulaire
router.get('/all', authenticateJWT, async (req, res) => {
    const basePdfDir = path.join(__dirname, '..', 'public', 'pdf');

    try {
        const formDirs = fs.readdirSync(basePdfDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        const result = [];

        for (const formId of formDirs) {
            const formPath = path.join(basePdfDir, formId);
            const files = fs.readdirSync(formPath)
                .filter(file => file.endsWith('.pdf'));

            result.push({
                id_formulaire: formId,
                pdfs: files
            });
        }

        res.json(result);
    } catch (err) {
        console.error('Erreur lecture PDF :', err);
        res.status(500).json({ error: 'Impossible de lire les PDF' });
    }
});

module.exports = router;
