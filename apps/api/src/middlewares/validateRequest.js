export const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({ error: error.details[0].message });
        }
        // Replace req.body with the validated and type-cast value
        req.body = value;
        next();
    };
};
