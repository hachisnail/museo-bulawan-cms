import { userService } from "../services/userService.js";
import { env } from "../config/env.js"; // <-- Import the env config

export const onboardAdmin = async (req, res, next) => {
    try {
        const { fname, lname, email, username, password } = req.body;

        // Basic validation
        if (!fname || !lname || !email || !username || !password) {
            return res.status(400).json({ error: "All fields are required to initialize the system." });
        }

        await userService.onboardFirstAdmin({ fname, lname, email, username, password });

        res.status(201).json({ message: "System initialized. Master Admin created successfully. You may now log in." });

    } catch (error) {
        // If the system already has users, lock the endpoint out
        if (error.message === 'ALREADY_ONBOARDED') {
            return res.status(403).json({ error: "Forbidden: The system has already been initialized." });
        }
        next(error);
    }
};

export const inviteUser = async (req, res, next) => {
    try {
        const { fname, lname, email, role } = req.body;

        // Call the service
        const actionToken = await userService.inviteUser({ fname, lname, email, role });

        // Use the frontendUrl from env.js dynamically
        const setupLink = `${env.frontendUrl}/setup?token=${actionToken}`;
        console.log(`[MOCK EMAIL] Sent to ${email}: "Click to set up account: ${setupLink}"`);

        res.status(201).json({ message: "User invited successfully." });

    } catch (error) {
        // Translate service errors to HTTP responses
        if (error.message === 'EMAIL_EXISTS') {
            return res.status(400).json({ error: "Email is already registered." });
        }
        next(error);
    }
};

export const completeSetup = async (req, res, next) => {
    try {
        const { token, username, password } = req.body;

        await userService.completeSetup({ token, username, password });

        res.status(200).json({ message: "Account setup complete. You may now log in." });

    } catch (error) {
        if (error.message === 'INVALID_TOKEN') {
            return res.status(400).json({ error: "Invalid or expired token." });
        }
        if (error.message === 'USERNAME_TAKEN') {
            return res.status(400).json({ error: "Username is already taken." });
        }
        next(error);
    }
};

export const requestPasswordReset = async (req, res, next) => {
    try {
        const { email } = req.body;

        const actionToken = await userService.requestPasswordReset(email);

        if (actionToken) {
            // Use the frontendUrl from env.js dynamically
            const resetLink = `${env.frontendUrl}/reset-password?token=${actionToken}`;
            console.log(`[MOCK EMAIL] Sent to ${email}: "Reset your password: ${resetLink}"`);
        }

        // Always return success even if email isn't found (Security Best Practice)
        res.status(200).json({ message: "If that email exists, a reset link has been sent." });

    } catch (error) {
        next(error);
    }
};

export const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        await userService.resetPassword({ token, newPassword });

        res.status(200).json({ message: "Password has been successfully reset." });

    } catch (error) {
        if (error.message === 'INVALID_TOKEN') {
            return res.status(400).json({ error: "Invalid or expired reset token." });
        }
        next(error);
    }
};