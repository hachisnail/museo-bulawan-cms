import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useFormLogic: Shared hook for both Internal and External form renderers.
 */
export const useFormLogic = ({ 
    slug, 
    apiBaseUrl = '', 
    customFetch = fetch,
    onSuccess,
    onError,
    prefillData = {}
}) => {
    const [definition, setDefinition] = useState(null);
    const [formData, setFormData] = useState({});
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const lastPrefilledId = useRef(null);
    
    // OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [otpEmail, setOtpEmail] = useState('');

    const fetchDefinition = useCallback(async () => {
        if (!slug) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const res = await customFetch(`${apiBaseUrl}/api/v1/forms/${slug}`);
            if (!res.ok) throw new Error(`Form definition '${slug}' not found`);
            const data = await res.json();
            setDefinition(data);
        } catch (err) {
            console.error(err);
            setError(err.message);
            if (onError) onError(err);
        } finally {
            setLoading(false);
        }
    }, [slug, apiBaseUrl, customFetch, onError]);

    // Initialize/Update form data when definition or prefillData changes
    useEffect(() => {
        if (!definition) return;

        const currentPrefillId = prefillData.artifact_id || prefillData.id;
        
        if (lastPrefilledId.current !== currentPrefillId) {
            const initialData = { ...prefillData };
            if (definition.schema && definition.schema.properties) {
                Object.keys(definition.schema.properties).forEach(key => {
                    if (initialData[key] === undefined) {
                        initialData[key] = definition.schema.properties[key].default || '';
                    }
                });
            }
            setFormData(initialData);
            lastPrefilledId.current = currentPrefillId;
        }
    }, [definition, JSON.stringify(prefillData)]);

    useEffect(() => {
        if (slug) {
            fetchDefinition();
        }
    }, [slug, fetchDefinition]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files);
        setFiles(prev => {
            const combined = [...prev, ...newFiles];
            return combined.slice(0, 5);
        });
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const getCsrfToken = () => {
        const name = "XSRF-TOKEN=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const ca = decodedCookie.split(';');
        for(let i = 0; i <ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1);
            if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
        }
        return "";
    };

    const handleRequestOtp = async () => {
        const mapping = definition?.settings?.field_mapping || {};
        let emailField = mapping.donorEmail;

        if (!emailField && definition?.schema?.properties) {
            emailField = Object.keys(definition.schema.properties).find(key => 
                definition.schema.properties[key].format === 'email' || 
                key.toLowerCase() === 'email'
            );
        }

        const email = formData[emailField || 'email'];

        if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
            alert('Please enter a valid email address in the form to receive a verification code.');
            return;
        }

        setOtpLoading(true);
        try {
            const res = await customFetch(`${apiBaseUrl}/api/v1/forms/${slug}/request-otp`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken()
                },
                body: JSON.stringify({ email })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Failed to send OTP');
            }

            setOtpSent(true);
            setOtpEmail(email);
            alert('Verification code sent to your email.');
        } catch (err) {
            alert(err.message);
        } finally {
            setOtpLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const properties = definition.schema?.properties || {};
            
            const isFieldVisible = (key, prop) => {
                const dependency = prop['ui:dependsOn'] || prop['dependsOn'];
                if (!dependency) return true;
                const { field, value, values, operator = 'eq' } = dependency;
                const actualValue = formData[field];
                if (operator === 'eq') return actualValue === value;
                if (operator === 'neq') return actualValue !== value;
                if (operator === 'in') return values?.includes(actualValue);
                if (operator === 'not_empty') return !!actualValue;
                return true;
            };

            const submissionData = {};
            Object.entries(properties).forEach(([key, prop]) => {
                if (isFieldVisible(key, prop)) {
                    const value = formData[key];
                    if (value !== '' && value !== undefined && value !== null) {
                        submissionData[key] = value;
                    }
                }
            });

            const body = new FormData();
            body.append('data', JSON.stringify(submissionData));
            if (otp) body.append('otp', otp);
            
            files.forEach(file => {
                body.append('attachments', file);
            });

            const res = await customFetch(`${apiBaseUrl}/api/v1/forms/${slug}/submit`, {
                method: 'POST',
                headers: {
                    'X-XSRF-TOKEN': getCsrfToken()
                },
                body
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Submission failed');

            if (onSuccess) onSuccess(result);
            
            setFormData({});
            setFiles([]);
            setOtp('');
            setOtpSent(false);

            return result;
        } catch (err) {
            setError(err.message);
            if (onError) onError(err);
            throw err;
        } finally {
            setSubmitting(false);
        }
    };

    return {
        definition,
        formData,
        files,
        loading,
        submitting,
        error,
        otpSent,
        otp,
        otpLoading,
        otpEmail,
        handleInputChange,
        handleFileChange,
        removeFile,
        handleRequestOtp,
        handleSubmit,
        setOtp,
        setOtpSent
    };
};
