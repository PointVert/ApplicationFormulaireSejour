// middleware/requireAdmin.js
const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token manquant' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });

        // Vérifie que le rôle est admin
        if (user.role.name !== 'admin') {
            return res.status(403).json({ error: 'Accès interdit' });
        }

        req.user = user; // Attache les données du token à la requête
        next();
    });
}

module.exports = requireAdmin;