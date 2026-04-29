import passport from "passport";
import crypto from "crypto";
import { db } from "../config/db.js";
import { sseManager } from "../utils/sseFactory.js";
import { auditService } from "../services/auditService.js";

export const login = async (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if(err) return next(err);

        if(!user) {
            return res.status(401).json({error: info.message || "Authentication failed" })
        }

        req.logIn(user, async (err) => {
            if(err) return next(err);

            // 1. Generate a unique ID for this specific device's session
            const loginInstanceId = crypto.randomUUID();
            req.session.loginInstanceId = loginInstanceId;

            // 2. Lock this instance ID into the database
            await db.query('UPDATE users SET current_session_id = ? WHERE id = ?', [loginInstanceId, user.id]);

            // 3. Write to Audit Logs
            await auditService.log({
                userId: user.id,
                action: 'LOGIN',
                resource: 'Auth',
                details: { message: "User logged in" },
                ipAddress: req.ip
            });

            // 4. REAL-TIME KICKOUT: Broadcast to any *existing* SSE connections for this user.
            // Because the new client hasn't connected to SSE yet, this only hits the old devices!
            sseManager.broadcast(`user_${user.id}`, 'force_logout', { 
                message: "You have been logged in from another device. This session is terminated."
            });

            res.status(200).json({ 
                message: "Logged in successfully",
                user: { id: user.id, username: user.username, role: user.role, fname: user.fname, lname: user.lname, email: user.email }
            });
        });
    })(req, res, next);
}

export const logout = (req, res, next) => {
    const userId = req.user?.id;
    const ip = req.ip;
    
    // Grab both IDs to compare them
    const instanceId = req.session?.loginInstanceId;
    const currentActiveInstance = req.user?.current_session_id;

    req.logout(async (err) => {
        if (err) return next(err);
        
        // FIX: ONLY clear the database if the session attempting to log out 
        // is actually the currently active device!
        if (userId && instanceId === currentActiveInstance) {
            await db.query('UPDATE users SET current_session_id = NULL WHERE id = ?', [userId]);
            await auditService.log({
                userId: userId,
                action: 'LOGOUT',
                resource: 'Auth',
                details: { message: "User logged out manually" },
                ipAddress: ip
            });
        }

        req.session.destroy(() => {
            res.clearCookie('connect.sid'); 
            res.status(200).json({ message: "Logged out successfully" });
        });
    });
};

export const check = async (req, res) => {
    if (req.isAuthenticated() && req.session.loginInstanceId === req.user.current_session_id) {
        const { id, username, role, fname, lname, email } = req.user;
        res.status(200).json({ valid: true, user: { id, username, role, fname, lname, email } });
    } else {
        res.status(401).json({ error: "No active session" });
    }
};