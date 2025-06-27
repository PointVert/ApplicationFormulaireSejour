require('dotenv').config();
const express = require('express');

const cors = require('cors');

const multer = require('multer');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const fs = require('fs');
const path = require('path');

const PDFDocument = require('pdfkit');
const roleRoutes = require('./routes/role');
const userRoutes = require('./routes/users');
const resetRoutes = require('./routes/resetpassword');
const progressionRoutes = require('./routes/progression');
const answerToPDFRoutes = require('./routes/answerToPDF');
const isAdmin = require('./utils/isAdmin');
const pdfRoutes = require('./routes/getPDFlist');

const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sert les fichiers statiques depuis /public
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static('public/img'));
app.use('/pdf', express.static(path.join(__dirname, 'public/pdf')));

const { supabase } = require('./supabaseClient');

const requireAdmin = require('./middleware/requireAdmin');
const authenticateJWT = require('./middleware/authenticateJWT');

const TypeQuestion = {
    "text": 0,
    "radio": 1,
    "checkbox": 2,
    "tableau_activite": 3,
    "tableau_accompagnement": 4
}

// Storage config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '/public/img'));
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    }
});
const upload = multer({ storage });

// Accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});
// Login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/Login.html'));
});
// Manage Role Page
app.get('/role', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/view/ManageRole.html'));
});

// Manage Role Page
app.get('/reset', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/ResetRequest.html'));
});
app.post('/api/register', async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
        .from('user')
        .insert({ identifiant: email, password: hashedPassword, role: 'client' });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Admin created successfully' });
});

app.post('/api/register_admin', requireAdmin, async (req, res) => {
    console.log('test register')
    const { email, password, roleId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error } = await supabase
        .from('user')
        .insert({ identifiant: email, password: hashedPassword, role_id: roleId });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'Admin created successfully' });
});

// Route de login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
        .from('user')
        .select('*')
        .eq('identifiant', email)
        .single();
    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { data: roleData } = await supabase
        .from('role')
        .select('id, nom')
        .eq('id', user.role_id)
        .single();
    
    const token = jwt.sign({
        id: user.id,
        identifiant: user.identifiant,
        role: {
            id: roleData.id,
            name: roleData.nom
        }
    }, process.env.JWT_SECRET, {
        expiresIn: '2h'
    });

    res.json({ token });
});

// Add form Page
app.get('/add_form', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/view/AddFormPage.html'));
});

app.get('/user', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/view/AddAdminPage.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/ResetPassword.html'));
});

app.get('/pdf', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/downloadPDF.html'));
});


app.get('/api/forms', authenticateJWT, async (req, res) => {
    const { id: role_id } = req.user.role;
    try {
        let forms;
        if (await isAdmin(role_id)) {
            // Rôle admin => renvoie tout
            const { data, error } = await supabase.from('formulaire').select('*');
            if (error) throw error;
            forms = data;
        } else {
            // Rôle non-admin => récupère seulement les formulaires associés à ce rôle
            const { data, error } = await supabase
                .from('role_formulaire')
                .select(`
                    formulaire ( identifiant_formulaire, titre )
                `)
                .eq('id_role', role_id);

            if (error) throw error;

            forms = data.map(entry => entry.formulaire);
        }

        res.json(forms);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur lors du chargement des formulaires' });
    }
});

app.post('/api/forms', requireAdmin, upload.any(), async (req, res) => {
    try {
        const parsed = JSON.parse(req.body.data || '{}');
        const { name, questions } = parsed;

        if (!name || !Array.isArray(questions)) {
            return res.status(400).json({ error: 'Invalid form data' });
        }

        // Create Formulaire
        const { data: form, error: formError } = await supabase
            .from('formulaire')
            .insert([{ titre: name }])
            .select('identifiant_formulaire')
            .single();

        if (formError?.message) {
            return res.status(500).json({ error: formError.message });
        }

        const formId = form.identifiant_formulaire;
        for (const q of questions) {
            const { data: question, error: qError } = await supabase
                .from('question')
                .insert([{
                    intitule: q.label,
                    type: TypeQuestion[q.type], // assume 0=text, 1=radio, 2=checkbox
                    identifiant_formulaire: formId
                }])
                .select('id_question')
                .single();

            if (qError?.message) {
                return res.status(500).json({ error: qError.message });
            }

            const questionId = question.id_question;

            for (const a of q.answers) {
                let imagePath = null;

                if (a.imageFieldName) {
                    const file = req.files.find(f => f.fieldname === a.imageFieldName);
                    if (file) {
                        imagePath = `/img/${file.filename}`;
                    }
                }

                const { error: aError } = await supabase
                    .from('reponse')
                    .insert([{
                        intitule: a.text,
                        url_image: imagePath,
                        id_question: questionId
                    }]);

                if (aError?.message) {
                    return res.status(500).json({ error: aError.message });
                }
            }
        }

        res.status(201).json({ message: 'Form created successfully', formId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error while creating form' });
    }
});

app.put('/api/forms/:id', requireAdmin, upload.any(), async (req, res) => {
    const formId = parseInt(req.params.id);
    let parsed;

    try {
        parsed = JSON.parse(req.body.data || '{}');
    } catch {
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    const { name, questions } = parsed;

    if (!name || !Array.isArray(questions)) {
        return res.status(400).json({ error: 'Invalid form structure' });
    }

    // Update Form Name
    const { error: formError } = await supabase
        .from('formulaire')
        .update({ titre: name })
        .eq('identifiant_formulaire', formId);

    if (formError) return res.status(500).json({ error: formError.message });

    // Fetch existing questions
    const { data: existingQuestions } = await supabase
        .from('question')
        .select('id_question')
        .eq('identifiant_formulaire', formId);

    const existingQIDs = existingQuestions.map(q => q.id_question);

    const updatedQIDs = [];

    // Upsert Questions and Answers
    for (const q of questions) {
        let questionId = q.id;

        // Insert if no ID
        if (!questionId) {
            const { data: newQ, error } = await supabase
                .from('question')
                .insert([{
                    intitule: q.text,
                    type: q.type,
                    identifiant_formulaire: formId
                }])
                .select('id_question')
                .single();

            if (error) return res.status(500).json({ error: error.message });
            questionId = newQ.id_question;
        } else {
            // Update existing
            await supabase
                .from('question')
                .update({ intitule: q.text, type: q.type })
                .eq('id_question', questionId);
        }

        updatedQIDs.push(questionId);

        // Fetch existing answers for this question
        const { data: existingAnswers } = await supabase
            .from('reponse')
            .select('id_reponse')
            .eq('id_question', questionId);

        const existingAIDs = existingAnswers.map(a => a.id_reponse);
        const updatedAIDs = [];

        for (const a of q.answers) {
            let answerId = a.id || crypto.randomUUID();
            let imagePath = null;

            if (a.imageFieldName) {
                const file = req.files.find(f => f.fieldname === a.imageFieldName);
                if (file) {
                    imagePath = `/img/${file.filename}`;
                }
            }

            if (!a.id) {
                // Insert
                const { error } = await supabase
                    .from('reponse')
                    .insert([{
                        id_reponse: answerId,
                        intitule: a.text,
                        url_image: imagePath,
                        id_question: questionId
                    }]);

                if (error) return res.status(500).json({ error: error.message });
            } else {
                // Update
                await supabase
                    .from('reponse')
                    .update({
                        intitule: a.text,
                        ...(imagePath ? { url_image: imagePath } : {})
                    })
                    .eq('id_reponse', answerId);
            }

            updatedAIDs.push(answerId);
        }

        // Remove deleted answers
        const answersToDelete = existingAIDs.filter(id => !updatedAIDs.includes(id));
        if (answersToDelete.length > 0) {
            await supabase
                .from('reponse')
                .delete()
                .in('id_reponse', answersToDelete);
        }
    }

    // Remove deleted questions
    const questionsToDelete = existingQIDs.filter(id => !updatedQIDs.includes(id));
    if (questionsToDelete.length > 0) {
        await supabase
            .from('question')
            .delete()
            .in('id_question', questionsToDelete);
    }

    res.json({ message: 'Form updated successfully' });
});

app.get('/api/forms/:id', async (req, res) => {
    const formId = parseInt(req.params.id);

    const { data: questions, error } = await supabase
        .from('question')
        .select(`
    id_question,
    intitule,
    type,
    reponse:reponse_id_question_fkey (
      id_reponse,
      intitule,
      url_image
    )
  `)
        .eq('identifiant_formulaire', formId);

    if (error?.message) {
        return res.status(500).json({ error: error.message });
    }

    res.json({ formId, questions });
});

app.post('/api/answers', async (req, res) => {
    const { formId, answers } = req.body;

    try {
        // 1 Recupere le formulaire
        const { data: form, error: formError } = await supabase
            .from('formulaire')
            .select('titre')
            .eq('identifiant_formulaire', formId)
            .single();
        if (formError || !form) return res.status(404).json({ error: 'Formulaire introuvable' });

        // 2 Recupere les questions
        const { data: questions, error: qErr } = await supabase
            .from('question')
            .select('id_question, intitule, type')
            .eq('identifiant_formulaire', formId);
        if (qErr) return res.status(500).json({ error: qErr.message });

        let ids_question = []
        for (q of questions)
            ids_question.push(q.id_question);
        // 3 Recupere toutes les reponses choisies
        const { data: reponses, error: rErr } = await supabase
            .from('reponse')
            .select('id_reponse, intitule, url_image, id_question')
            .in('id_question', ids_question);
        if (rErr) return res.status(500).json({ error: rErr.message });

        // 4. Creation du PDF
        const pdfFileName = `reponses_formulaire_${formId}_${Date.now()}.pdf`;
        const pdfFilePath = path.join(__dirname, 'public', 'pdf', pdfFileName);
        const doc = new PDFDocument({ margin: 40 });
        const writeStream = fs.createWriteStream(pdfFilePath);
        doc.pipe(writeStream);

        doc.fontSize(20).text(`Reponses au formulaire : ${form.titre}`, { underline: true });
        doc.moveDown(2);
        for (let i = 0; i < questions.length; i++) {
            const { id_question, intitule, type } = questions[i];

            doc.fontSize(14).text(`Q${i + 1} : ${intitule}`, { bold: true });
            doc.moveDown(0.5);

            const userAnswerObj = answers.find(a => a.question_id === id_question);
            const userAnswers = userAnswerObj
                ? (Array.isArray(userAnswerObj.answer) ? userAnswerObj.answer : [userAnswerObj.answer])
                : [];

            if (type === 0) {
                // Texte libre
                const answerText = userAnswers[0] || 'Non renseignée';
                doc.fontSize(12).text(`-> Réponse : ${answerText}`);
                doc.moveDown(1);
                continue;
            }

            // Type choix (radio ou checkbox) : montrer toutes les options, cocher les choisies
            const questionReponses = reponses.filter(r => r.id_question === id_question);
            if (questionReponses.length === 0) {
                doc.fontSize(12).text(`(Aucune réponse définie pour cette question)`);
                doc.moveDown(1);
                continue;
            }

            for (let rep of questionReponses) {
                const isSelected = userAnswers.includes(rep.intitule);
                const checkbox = isSelected ? '[x]' : '[ ]';

                doc.fontSize(12).text(`${checkbox} ${rep.intitule}`);

                if (rep.url_image) {
                    const imgPath = path.join(__dirname, 'public' + rep.url_image);
                    if (fs.existsSync(imgPath)) {
                        doc.image(imgPath, { width: 100 });
                    } else {
                        doc.text(`(Image manquante: ${rep.url_image})`);
                    }
                }

                doc.moveDown(0.5);
            }

            doc.moveDown(1);
        }


        doc.end();

        writeStream.on('finish', () => {
            res.json({
                success: true,
                pdfUrl: `/pdf/${pdfFileName}`,
                message: 'PDF genere et sauvegarde.'
            });
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.use('/api/role', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/progress', progressionRoutes);
app.use('/api', resetRoutes);
app.use('/api', answerToPDFRoutes);
app.use('/api/pdf', pdfRoutes);

app.listen(PORT, () => {
    console.log(`Serveur started on ${PORT}`);
});