import React, { useState, useEffect, useCallback } from 'react';

/**
 * FormRenderer: A reusable React component that dynamically generates a form
 * based on a JSON Schema definition fetched from the Museo Bulawan Form Service.
 * 
 * Supports:
 * - Dynamic field rendering (text, number, select, email, date)
 * - OTP Verification flow
 * - Multipart/form-data submission (including attachments)
 * - Custom styling via CSS variables
 */
const FormRenderer = ({ 
    slug, 
    apiBaseUrl = '', 
    customFetch = fetch,
    onSuccess,
    onError,
    prefillData = {},
    hideHeader = false,
    compact = false,
    className = ""
}) => {
    const [definition, setDefinition] = useState(null);
    const [formData, setFormData] = useState({});
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const lastPrefilledId = React.useRef(null);
    
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
        
        // Only reset if it's a first load or the target artifact has changed
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

    if (!slug) return <div className="p-8 border-2 border-dashed border-zinc-800 rounded-xl text-center text-zinc-500">No form slug provided.</div>;

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
            // Enforce max 5 files limit
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
        // 1. Try to find email field from mapping
        const mapping = definition?.settings?.field_mapping || {};
        let emailField = mapping.donorEmail;

        // 2. If no mapping, try to find a field with format: 'email'
        if (!emailField && schema?.properties) {
            emailField = Object.keys(schema.properties).find(key => 
                schema.properties[key].format === 'email' || 
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
        e.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            // 1. Filter the data to only include visible fields and remove empty optional fields
            const submissionData = {};
            Object.entries(properties).forEach(([key, prop]) => {
                if (isFieldVisible(key, prop)) {
                    const value = formData[key];
                    // Only include if it has a value, or if it's explicitly required
                    if (value !== '' && value !== undefined && value !== null) {
                        submissionData[key] = value;
                    }
                }
            });

            // Use FormData for multipart/form-data support (files)
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
                // Note: fetch automatically sets Content-Type to multipart/form-data with boundary when body is FormData
            });

            const result = await res.json();
            if (!res.ok) throw new Error(result.error || 'Submission failed');

            if (onSuccess) onSuccess(result);
            alert('Form submitted successfully!');
            
            // Reset form if success
            setFormData({});
            setFiles([]);
            setOtp('');
            setOtpSent(false);

        } catch (err) {
            setError(err.message);
            if (onError) onError(err);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="p-8 text-center opacity-50">Loading form...</div>;
    if (error && !definition) return <div className="p-8 text-red-400">Error: {error}</div>;
    if (!definition) return null;

    const { schema, settings } = definition;
    const properties = schema?.properties || {};
    const required = schema?.required || [];

    // Helper to evaluate conditional visibility
    const isFieldVisible = (key, prop) => {
        // Check if there's a dependency defined in the schema (e.g., ui:dependsOn)
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

    // Helper to determine field width
    const getFieldColSpan = (key, prop) => {
        if (prop.type === 'string' && prop.format === 'textarea') return 'md:col-span-2';
        if (settings?.layout === 'single_column') return 'md:col-span-2';
        return '';
    };

    return (
        <div className={`form-renderer ${hideHeader ? '' : 'glass-panel rounded-3xl border border-[var(--color-glass-border)] shadow-2xl'} ${compact ? 'p-0' : 'p-6 md:p-10'} ${className}`}>
            {!hideHeader && (
                <header className={`${compact ? 'mb-6' : 'mb-10'} text-center md:text-left`}>
                    <h2 className={`${compact ? 'text-xl' : 'text-3xl'} font-bold tracking-tight text-white`}>{definition.title}</h2>
                    {settings?.description && (
                        <p className={`text-[var(--text-secondary)] mt-2 ${compact ? 'text-sm' : 'text-lg'} max-w-2xl`}>
                            {settings.description}
                        </p>
                    )}
                </header>
            )}

            <form onSubmit={handleSubmit} className={`${compact ? 'space-y-4' : 'space-y-8'}`}>
                <div className={`grid grid-cols-1 ${compact ? 'gap-4' : 'md:grid-cols-2 gap-x-6 gap-y-8'}`}>
                    {Object.entries(properties).map(([key, prop]) => {
                        // Skip if condition not met
                        if (!isFieldVisible(key, prop)) return null;

                        // Support for hidden fields
                        if (prop['ui:widget'] === 'hidden') {
                            return <input key={key} type="hidden" name={key} value={formData[key] || ''} />;
                        }

                        const isRequired = required.includes(key);
                        const colSpan = getFieldColSpan(key, prop);
                        
                        return (
                            <div key={key} className={`${colSpan} flex flex-col animate-in fade-in slide-in-from-top-2 duration-300`}>
                                <label className={`flex items-center gap-1.5 font-semibold ${compact ? 'text-[10px] mb-1.5' : 'text-sm mb-2.5'} text-zinc-300`}>
                                    {prop.title || key}
                                    {isRequired && <span className="text-rose-500 font-bold">*</span>}
                                </label>

                                {prop.type === 'boolean' ? (
                                    <label className="relative inline-flex items-center cursor-pointer group">
                                        <input 
                                            type="checkbox"
                                            name={key}
                                            checked={!!formData[key]}
                                            onChange={handleInputChange}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-brand-600)]"></div>
                                        <span className="ml-3 text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                            {prop.description || 'Enable this option'}
                                        </span>
                                    </label>
                                ) : prop.enum ? (
                                    <div className="relative">
                                        <select
                                            name={key}
                                            required={isRequired}
                                            value={formData[key] || ''}
                                            onChange={handleInputChange}
                                            className={`w-full bg-zinc-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[var(--color-brand-500)] outline-none transition-all appearance-none cursor-pointer ${compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3'}`}
                                        >
                                            <option value="" disabled>Select an option...</option>
                                            {prop.enum.map(opt => (
                                                <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                ) : prop.format === 'textarea' ? (
                                    <textarea
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        rows={compact ? 2 : 4}
                                        placeholder={prop.description}
                                        className={`w-full bg-zinc-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[var(--color-brand-500)] outline-none transition-all resize-none placeholder:text-zinc-600 ${compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3'}`}
                                    />
                                ) : prop.format === 'file' || key.toLowerCase().includes('attachment') ? (
                                    /* Special handling if a specific field is marked as a file */
                                    <div className="p-4 border border-dashed border-white/10 rounded-xl bg-white/5 flex items-center justify-between">
                                        <div className="text-xs text-zinc-500">Use the attachment section below to upload files for this form.</div>
                                        <div className="text-[var(--color-brand-500)] text-xs font-bold">Files {files.length}/5</div>
                                    </div>
                                ) : (
                                    <input
                                        type={prop.format === 'email' ? 'email' : prop.format === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'}
                                        name={key}
                                        required={isRequired}
                                        min={prop.minimum}
                                        max={prop.maximum}
                                        step={prop.type === 'number' ? 'any' : undefined}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        placeholder={prop.description}
                                        className={`w-full bg-zinc-900/50 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-[var(--color-brand-500)] outline-none transition-all placeholder:text-zinc-600 ${compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3'}`}
                                    />
                                )}
                                
                                {prop.type !== 'boolean' && prop.description && !prop.format === 'textarea' && (
                                    <p className="mt-2 text-xs text-zinc-500">{prop.description}</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* File Upload Section - Aligned and Styled */}
                {settings?.allow_attachments && (
                    <div className="pt-6 border-t border-white/5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-300">Supporting Documents</h3>
                                <p className="text-xs text-zinc-500">Upload photos, IDs, or legal documents (Max 5 files, 15MB each)</p>
                            </div>
                            <span className="text-xs font-mono text-zinc-500 bg-zinc-800/50 px-2 py-1 rounded">
                                {files.length} / 5
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-[var(--color-brand-500)] bg-zinc-900/30 rounded-2xl p-6 transition-all cursor-pointer group">
                                <svg className="w-8 h-8 text-zinc-500 group-hover:text-[var(--color-brand-500)] mb-2 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200">Select Files</span>
                                <input 
                                    type="file" 
                                    multiple 
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>

                            {files.length > 0 && (
                                <div className="bg-zinc-900/50 rounded-2xl p-4 border border-white/5 space-y-2 max-h-[140px] overflow-y-auto">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs bg-white/5 p-2 rounded-lg group">
                                            <div className="flex items-center gap-2 truncate">
                                                <span className="text-zinc-500">📎</span>
                                                <span className="truncate text-zinc-300">{f.name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-zinc-600 font-mono shrink-0">{(f.size/1024).toFixed(1)} KB</span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeFile(i)}
                                                    className="text-rose-500 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* OTP Verification Section */}
                {definition.otp && (
                    <div className="pt-8 border-t border-white/5">
                        {!otpSent ? (
                            <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="text-center md:text-left">
                                    <h4 className="text-sm font-semibold text-indigo-300">Identity Verification</h4>
                                    <p className="text-xs text-indigo-400/80">A code will be sent to the email address provided above.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRequestOtp}
                                    disabled={otpLoading}
                                    className="whitespace-nowrap px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                                >
                                    {otpLoading ? 'Sending...' : 'Send Verification Code'}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-green-500/5 border border-green-500/10 rounded-2xl p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">✓</div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-green-300">Verification Sent</h4>
                                        <p className="text-xs text-green-500/80">Enter the 6-digit code sent to <strong>{otpEmail}</strong></p>
                                    </div>
                                    <button type="button" onClick={() => setOtpSent(false)} className="ml-auto text-xs text-zinc-500 hover:text-zinc-300 underline">Change Email</button>
                                </div>
                                <div className="max-w-[240px] mx-auto md:mx-0">
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full bg-zinc-900 border border-green-500/30 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.4em] font-bold text-green-400 focus:outline-none focus:border-green-500 transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                        <span className="text-lg">⚠️</span>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting || (definition.otp && otpSent && !otp)}
                    className={`w-full bg-gradient-to-r from-[var(--color-brand-600)] to-indigo-600 hover:from-[var(--color-brand-500)] hover:to-indigo-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed group ${compact ? 'py-2.5 text-xs' : 'py-4'}`}
                >
                    <span className="flex items-center justify-center gap-2">
                        {submitting ? 'Processing Submission...' : 'Confirm and Submit'}
                        {!submitting && <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
                    </span>
                </button>
            </form>
        </div>
    );
};

export default FormRenderer;
