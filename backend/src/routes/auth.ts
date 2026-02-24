import express from 'express';
import User from '../models/User';

const router = express.Router();

// Generate an anonymous user session
router.post('/anonymous', async (req, res) => {
    try {
        const { username } = req.body;
        if (!username) return res.status(400).json({ error: 'Username required' });

        // For anonymous mode, just create or fetch the user without password checks
        let user = await User.findOne({ username });
        if (!user) {
            // Give them a dummy password since the schema might require it,
            // though we won't check it anymore.
            user = await User.create({ username, password: 'anonymous_user' });
        }

        // We don't even need a real JWT for this open version, but to keep the 
        // frontend context happy with minimal changes, we'll just return a dummy token.
        const token = "anonymous-token-" + user._id;

        res.json({ token, user: { id: user._id, username: user.username } });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
