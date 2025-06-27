// middleware/requireAdmin.js
const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Token manquant' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token invalide' });

        // V�rifie que le r�le est admin
        if (user.role.name !== 'admin') {
            return res.status(403).json({ error: 'Acc�s interdit' });
        }

        req.user = user; // Attache les donn�es du token � la requ�te
        next();
    });
}

module.exports = requireAdmin;