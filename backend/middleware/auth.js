const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ error: "Access Denied" });

    jwt.verify(token, process.env.JWT_SECRET || 'secret', async (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid Token" });

        // Single Device Login Validation
        try {
            const { data, error } = await supabase.from('users').select('active_session_id').eq('id', user.id).maybeSingle();

            if (error || !data) {
                return res.status(401).json({ error: "User not found" });
            }

            if (data.active_session_id !== user.sessionId) {
                return res.status(403).json({ error: "Session expired. You logged in from another device." });
            }

            req.user = user;
            next();
        } catch (dbError) {
            return res.status(500).json({ error: "Database error during authentication" });
        }
    });
};

const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ error: "Forbidden: You don't have required permissions" });
        }
        next();
    }
}

module.exports = { authenticateToken, requireRole };
