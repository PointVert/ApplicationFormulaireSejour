const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_KEY);

async function sendResetEmail(to, resetLink) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Point Vert <noreply@resend.dev>', // Tu peux utiliser resend.dev sans setup de domaine
            to,
            subject: 'Reinitialisation de mot de passe',
            html: `<p>Bonjour,</p><p>Cliquez sur ce lien pour reinitialiser votre mot de passe :</p>
                   <p><a href="${resetLink}">${resetLink}</a></p><p>Ce lien expire dans 1 heure.</p>`
        });

        if (error) {
            console.error('Erreur envoi mail:', error);
            return { success: false, error };
        }

        return { success: true };
    } catch (err) {
        console.error('Erreur sendResetEmail:', err);
        return { success: false, error: err.message };
    }
}

module.exports = sendResetEmail;