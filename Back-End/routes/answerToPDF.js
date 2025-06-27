const express = require('express');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { supabase } = require('../supabaseClient');
const sanitize = require('sanitize-filename');
const router = express.Router();
const { BASE_URL } = process.env;

// Helpers pour charger le HTML template
function renderTemplate(template, data) {
    return template.replace(/\{\{(.*?)\}\}/g, (_, key) => data[key.trim()] || '');
}

router.post('/answers-pdf', async (req, res) => {
    const { formId, answers, nameFile } = req.body;
    console.log(req.body)
    try {
        // 1. Récupérer le formulaire
        const { data: form } = await supabase
            .from('formulaire')
            .select('titre')
            .eq('identifiant_formulaire', formId)
            .single();
        if (!form) return res.status(404).json({ error: 'Formulaire introuvable' });

        const safeFolder = sanitize(form.titre) || `formulaire_${formId}`;

        // 2. Récupérer les questions
        const { data: questions } = await supabase
            .from('question')
            .select('id_question, intitule, type')
            .eq('identifiant_formulaire', formId);

        // 3. Récupérer toutes les réponses possibles
        const { data: allReponses } = await supabase
            .from('reponse')
            .select('id_reponse, id_question, intitule, url_image');

        console.log('Reponses reçues :', answers);
        // 4. Préparer les questions avec les réponses sélectionnées
        const questionsFormatted = questions.map(q => {
            const rep = answers.find(a => a.question_id === q.id_question);
            const possibleAnswers = allReponses.filter(r => r.id_question === q.id_question);
            const userRep = rep?.answer;

            if (q.type === 0) {
                return {
                    intitule: q.intitule,
                    isText: true,
                    texte: userRep || ''
                };
            }

            const isMultiple = q.type === 2;
            const selected = Array.isArray(userRep) ? userRep : [userRep];
            if (q.type === 3 || q.type === 4) {
                
                console.log("rep:", rep)
                console.log(possibleAnswers)
                console.log(userRep)
                const lignes = Array.isArray(userRep) ? userRep : []; // chaque ligne encodée comme "Activité|Statut|Commentaire"
                console.log(lignes)
                const rows = lignes.map(ligne => ligne.split('_'));
                console.log(rows)
                return {
                    type: q.type === 3 ? 'activite' : 'accompagnement',
                    intitule: q.intitule,
                    rows
                };
            }
            return {
                intitule: q.intitule,
                isRadio: q.type === 1,
                isCheckbox: q.type === 2,
                choix: possibleAnswers.map(p => ({
                    intitule: p.intitule,
                    image: p.url_image || null,
                    selected: selected.includes(p.intitule)
                }))
            };
        });

        // 5. Générer le HTML
        const html = generateHTML(form.titre, questionsFormatted);

        // 6. Générer le PDF avec Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const folderPath = path.join(__dirname, '../public/pdf', safeFolder);
        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }
        const pdfName = `${nameFile || `formulaire_${formId}`}.pdf`;
        const pdfPath = path.join(folderPath, pdfName);

        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });

        await browser.close();

        res.json({ message: 'PDF généré avec succès', url: `/pdf/${pdfName}` });

    } catch (err) {
        console.error('Erreur génération PDF :', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

function generateHTML(title, questions) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Reponses</title>
  <style>
    body { font-family: Arial; padding: 30px; }
    h1 { text-align: center; margin-bottom: 40px; }
    .question { margin-bottom: 25px; border-bottom: 1px solid #ccc; padding-bottom: 15px; }
    .question h3 { margin: 0 0 10px; }
    .answer { margin-left: 15px; }
    .checkbox, .radio { display: flex; align-items: center; margin: 5px 0; }
    .checkbox span, .radio span { margin-left: 8px; }
    img { max-width: 120px; margin: 10px 0; }
    input[type="radio"].radio {
  display: none;
}
input[type="radio"][disabled].radio {
  display: none;
}

input[type="radio"][disabled].radio + label {
  position: relative;
  padding-left: 1.5rem;
  cursor: default;
}

input[type="radio"][disabled].radio + label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.2rem;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid #ccc;
  background-color: #f0f0f0;
}

input[type="radio"][disabled].radio:checked + label::after {
  content: '';
  position: absolute;
  left: 0.3rem;
  top: 0.5rem;
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background-color: #ff5722; /* Flashy couleur sélectionnée */
}

input[type="radio"][disabled].radio:checked + label::before {
  border-color: #ff5722; /* Bordure aussi colorée si sélectionné */
  background-color: #ffece6;
}
input[type="checkbox"][disabled].checkbox {
  display: none;
}

input[type="checkbox"][disabled].checkbox + label {
  position: relative;
  padding-left: 1.6rem;
  cursor: default;
  display: inline-block;
  line-height: 1.2rem;
}

input[type="checkbox"][disabled].checkbox + label::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.1rem;
  width: 1rem;
  height: 1rem;
  border: 2px solid #ccc;
  background-color: #f0f0f0;
  border-radius: 3px;
}

input[type="checkbox"][disabled].checkbox:checked + label::before {
  background-color: #4CAF50; /* couleur de fond cochée */
  border-color: #4CAF50;
}

input[type="checkbox"][disabled].checkbox:checked + label::after {
  content: '\\2713';
  position: absolute;
  left: 0.2rem;
  top: 0;
  color: white;
  font-size: 0.9rem;
  font-weight: bold;
}
  </style>
</head>
<body>
  <h1>Reponses au formulaire : ${title}</h1>

  ${questions.map((q, i) => `
    <div class="question">
      <h3>Q${i + 1} - ${q.intitule}</h3>
      ${q.isText ? `<div class="answer">Reponse : ${q.texte || '(vide)'}</div>` : ''}
      ${q.choix ? q.choix.map(c => `
        <div class="${q.isCheckbox ? 'checkbox' : 'radio'}" style="display:inline">
          <input 
            type="${q.isCheckbox ? 'checkbox' : 'radio'}" 
            disabled 
            class="${q.isCheckbox ? 'checkbox' : 'radio'}" 
            ${c.selected ? 'checked' : ''}
            id="q${i}-c${c.intitule.replace(/\s+/g, '')}">
          <label for="q${i}-c${c.intitule.replace(/\s+/g, '')}">
            ${c.intitule} ${c.image ? `<img src="${BASE_URL}${c.image}" alt="image">` : ''}
          </label>
        </div>
      `).join('') : ''}
      ${q.type === 'activite' || q.type === 'accompagnement' ? `
  <table border="1" cellpadding="8" cellspacing="0" style="margin-top: 10px; border-collapse: collapse;">
    <thead>
      <tr>
        <th>${q.type === 'activite' ? 'Activite' : 'Accompagnement'}</th>
        <th>${q.type === 'activite' ? 'Appreciation' : 'Type de soutien'}</th>
        <th>Commentaire</th>
      </tr>
    </thead>
    <tbody>
      ${q.rows.map(row => `
        <tr>
          <td>${row[0] || ''}</td>
          <td>${row[1] || ''}</td>
          <td>${row[2] || ''}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
` : ''}
    </div>
  `).join('')}
</body>
</html>`;
}

module.exports = router;