import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import { userService } from '../services/userService.js';

// Define the Joi validation schema for the login payload
const loginSchema = Joi.object({
    username: Joi.string().min(3).max(50).required().messages({
        'string.empty': 'Username is required.',
        'string.min': 'Username must be at least 3 characters long.'
    }),
    password: Joi.string().required().messages({
        'string.empty': 'Password is required.'
    })
});

// 1. Define the Local Strategy (How to log in)
passport.use(new LocalStrategy(
    { usernameField: 'username', passwordField: 'password' },
    async (username, password, done) => {
        try {
            // Step 1: Validate inputs using Joi
            const { error } = loginSchema.validate({ username, password });
            if (error) {
                // Return the Joi error message to the client
                return done(null, false, { message: error.details[0].message });
            }

            // Step 2: Find user via Service
            const user = await userService.getUserByUsername(username);
            
            if (!user) {
                return done(null, false, { message: 'Incorrect username.' });
            }

            // Step 3: Verify password
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                return done(null, false, { message: 'Incorrect password.' });
            }

            // Success: Pass the user object to Passport
            return done(null, user);
        } catch (error) {
            return done(error);
        }
    }
));

// 2. Serialize User (What to store in the session cookie)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// 3. Deserialize User (How to retrieve the user on every subsequent request)
passport.deserializeUser(async (id, done) => {
    try {
        // Fetch the fresh data using the Service instead of raw DB queries
        const user = await userService.getUserById(id);
        
        if (!user) {
            return done(new Error('User not found'));
        }
        
        // This attaches the user data to `req.user` globally!
        done(null, user); 
    } catch (error) {
        done(error);
    }
});

export default passport;