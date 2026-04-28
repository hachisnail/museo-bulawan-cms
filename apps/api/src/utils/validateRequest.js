export const validateRequest = (schema, req, res) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
        res.status(400).json({ error: error.details[0].message });
        return { isValid: false, value: null };
    }
    return { isValid: true, value };
};