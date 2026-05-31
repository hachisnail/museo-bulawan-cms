import React, { useState, useMemo } from 'react';
import { useFormLogic } from './useFormLogic';
import { 
    ChevronRight, 
    Check, 
    AlertCircle, 
    FileText, 
    Upload, 
    Mail, 
    Key,
    Send
} from 'lucide-react';

const ExternalForm = (props) => {
    const { 
        className = "",
        hideHeader = false
    } = props;

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submittedId, setSubmittedId] = useState(null);

    const {
        definition,
        formData,
        files,
        loading,
        submitting,
        error: apiError,
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
    } = useFormLogic({
        ...props,
        onSuccess: (result) => {
            setIsSubmitted(true);
            setSubmittedId(result.id);
            if (props.onSuccess) props.onSuccess(result);
        }
    });

    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [localError, setLocalError] = useState(null);

    const handleResetForm = () => {
        setIsSubmitted(false);
        setSubmittedId(null);
        setCurrentStepIdx(0);
        setLocalError(null);
        setOtp('');
        setOtpSent(false);
    };

    const displayError = localError || apiError;

    const { schema, settings } = definition || {};
    const properties = schema?.properties || {};
    const required = schema?.required || [];
    const stepGroups = settings?.step_groups || [];

    // ── Visibility Logic ──
    const isFieldVisible = (key, prop) => {
        const dependency = prop['ui:dependsOn'] || prop['dependsOn'];
        if (!dependency) return true;
        const { field, value, values, operator = 'eq' } = dependency;
        const actualValue = formData?.[field];
        if (operator === 'eq') return actualValue === value;
        if (operator === 'neq') return actualValue !== value;
        if (operator === 'in') return values?.includes(actualValue);
        if (operator === 'not_empty') return !!actualValue;
        return true;
    };

    // ── Build Steps ──
    const steps = useMemo(() => {
        const result = [];

        if (stepGroups.length > 0) {
            for (const group of stepGroups) {
                const groupFields = Object.entries(properties)
                    .filter(([, prop]) => prop['ui:group'] === group.id);
                
                if (groupFields.length > 0) {
                    result.push({
                        id: group.id,
                        label: group.label,
                        type: 'fields',
                        fields: groupFields
                    });
                }
            }

            const groupedIds = new Set(stepGroups.map(g => g.id));
            const ungroupedFields = Object.entries(properties)
                .filter(([, prop]) => !prop['ui:group'] || !groupedIds.has(prop['ui:group']))
                .filter(([, prop]) => prop['ui:widget'] !== 'hidden');
            
            if (ungroupedFields.length > 0) {
                result.push({
                    id: 'additional',
                    label: 'Additional Details',
                    type: 'fields',
                    fields: ungroupedFields
                });
            }
        } else {
            const allFields = Object.entries(properties).filter(([, prop]) => prop['ui:widget'] !== 'hidden');
            if (allFields.length > 0) {
                result.push({
                    id: `fields-main`,
                    label: 'Tell us about yourself.',
                    type: 'fields',
                    fields: allFields
                });
            }
        }

        if (settings?.allow_attachments) {
            result.push({ id: 'media', label: 'Media Documentation', type: 'media', fields: [] });
        }
        if (definition?.otp) {
            result.push({ id: 'verify', label: 'Verification', type: 'verify', fields: [] });
        }

        return result;
    }, [properties, stepGroups, settings, definition?.otp]);

    const visibleStepIndices = useMemo(() => {
        return steps.map((step, idx) => {
            if (step.type !== 'fields') return idx;
            const hasVisible = step.fields.some(([key, prop]) => isFieldVisible(key, prop));
            return hasVisible ? idx : null;
        }).filter(idx => idx !== null);
    }, [steps, formData]);

    if (loading) return (
        <div className="min-h-screen min-w-screen bg-[#f7f7f7] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
        </div>
    );

    if (apiError && !definition) return (
        <div className="min-h-screen bg-[#f7f7f7] flex items-center justify-center p-4">
            <div className="max-w-xl w-full p-12 bg-white shadow-lg text-center">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                <h3 className="text-2xl font-serif text-black tracking-wide mb-2">Error</h3>
                <p className="text-sm text-gray-500 mb-8">{apiError}</p>
                <button onClick={() => window.location.reload()} className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-sm">Retry</button>
            </div>
        </div>
    );

    if (!definition) return null;

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-4">
                <div className="max-w-3xl w-full p-16 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-center animate-in fade-in duration-500">
                    <h3 className="text-4xl font-serif text-black tracking-wide mb-4 uppercase">Success!</h3>
                    <hr className="border-t border-gray-300 w-32 mx-auto mb-8" />
                    <p className="text-sm text-gray-600 font-light max-w-md mx-auto leading-relaxed mb-8">
                        Your submission has been successfully transmitted. A representative will review your documentation shortly.
                    </p>
                    {submittedId && (
                        <div className="mb-10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block mb-1">Receipt ID</span>
                            <code className="text-sm font-mono text-black">{submittedId}</code>
                        </div>
                    )}
                    <button
                        onClick={handleResetForm}
                        className="px-10 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-gray-800 transition-all"
                    >
                        Submit Another
                    </button>
                </div>
            </div>
        );
    }

    const visibleSteps = visibleStepIndices.map(i => steps[i]);
    const currentVisibleIdx = Math.min(currentStepIdx, visibleSteps.length - 1);
    const activeStep = visibleSteps[currentVisibleIdx];

    // ── Navigation ──
    const nextStep = (e) => {
        if (e) e.preventDefault();
        setLocalError(null);

        if (activeStep?.type === 'fields') {
            for (const [key, prop] of activeStep.fields) {
                if (!isFieldVisible(key, prop)) continue;
                if (prop['ui:widget'] === 'hidden') continue;
                const isRequired = required.includes(key);
                if (formData.is_anonymous === true && ['donor_first_name', 'donor_last_name'].includes(key)) continue;
                
                const value = formData[key];
                if (isRequired && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                    setLocalError(`"${prop.title || key}" is required.`);
                    return;
                }
            }
        }

        if (currentVisibleIdx < visibleSteps.length - 1) {
            setCurrentStepIdx(currentVisibleIdx + 1);
        }
    };

    const prevStep = (e) => {
        if (e) e.preventDefault();
        setLocalError(null);
        if (currentVisibleIdx > 0) {
            setCurrentStepIdx(currentVisibleIdx - 1);
        }
    };

    const onInputChange = (e) => {
        setLocalError(null);
        handleInputChange(e);
    };

    // ── Render a single form field ──
    const renderField = (key, prop) => {
        if (prop['ui:widget'] === 'hidden') {
            return <input key={key} type="hidden" name={key} value={formData[key] || ''} />;
        }
        if (!isFieldVisible(key, prop)) return null;

        const isRequired = required.includes(key);
        const showRequired = isRequired && !(formData.is_anonymous === true && ['donor_first_name', 'donor_last_name'].includes(key));

        return (
            <div key={key} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 mb-5">
                <label className="text-[11px] font-medium text-gray-800 w-32 shrink-0 capitalize">
                    {prop.title || key}
                    {showRequired && <span className="text-red-500 ml-1">*</span>}
                </label>

                <div className="flex-1">
                    {prop.type === 'boolean' ? (
                        <label className="flex items-center cursor-pointer py-2">
                            <input type="checkbox" name={key} checked={!!formData[key]} onChange={onInputChange} className="w-4 h-4 text-black border-gray-400 rounded-sm focus:ring-black" />
                            <span className="ml-3 text-sm text-gray-600">{prop.description || 'Confirmed'}</span>
                        </label>
                    ) : prop.enum ? (
                        <div className="relative">
                            <select
                                name={key}
                                required={showRequired}
                                value={formData[key] || ''}
                                onChange={onInputChange}
                                className="w-full bg-transparent border border-gray-400 rounded-full px-5 py-2.5 text-sm text-black focus:outline-none focus:border-black transition-colors appearance-none"
                            >
                                <option value="" disabled>Select...</option>
                                {prop.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                        </div>
                    ) : prop.format === 'textarea' ? (
                        <textarea
                            name={key}
                            required={showRequired}
                            value={formData[key] || ''}
                            onChange={onInputChange}
                            rows={3}
                            placeholder={prop.description}
                            className="w-full bg-transparent border border-gray-400 rounded-2xl px-5 py-3 text-sm text-black focus:outline-none focus:border-black transition-colors resize-none placeholder:text-gray-300"
                        />
                    ) : (
                        <input
                            type={prop.format === 'email' ? 'email' : prop.format === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'}
                            name={key}
                            required={showRequired}
                            value={formData[key] || ''}
                            onChange={onInputChange}
                            placeholder={prop.description}
                            className="w-full bg-transparent border border-gray-400 rounded-full px-5 py-2 text-sm text-black focus:outline-none focus:border-black transition-colors placeholder:text-gray-300"
                        />
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className={`min-h-screen bg-[#f7f7f7] flex flex-col items-center justify-center p-4 py-12 font-sans ${className}`}>
            
            {/* MAIN CARD */}
            <div className="w-full max-w-4xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] p-10 md:p-16 lg:p-20 relative">
                
                {/* Header Section */}
                <header className="mb-10">
                    {currentVisibleIdx === 0 && !hideHeader ? (
                        <div className={activeStep?.type !== 'fields' ? 'text-center' : 'text-left'}>
                            <h2 className="text-3xl md:text-4xl font-serif text-black tracking-wide">
                                {definition.title || "NOTICE"}
                            </h2>
                            {settings?.description && (
                                <p className="text-sm text-gray-500 mt-4 leading-relaxed max-w-2xl mx-auto md:mx-0">
                                    {settings.description}
                                </p>
                            )}
                        </div>
                    ) : (
                        <h2 className="text-3xl md:text-4xl font-serif text-black tracking-wide">
                            {activeStep?.label}
                        </h2>
                    )}
                    <hr className="border-t border-gray-300 mt-6" />
                </header>

                <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (currentVisibleIdx < visibleSteps.length - 1) nextStep();
                        else handleSubmit(e);
                    }} 
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.preventDefault();
                    }}
                >
                    {/* ── FIELD STEPS ── */}
                    {activeStep?.type === 'fields' && (
                        <div className="w-full animate-in fade-in duration-500">
                            {activeStep.fields.map(([key, prop]) => renderField(key, prop))}
                        </div>
                    )}

                    {/* ── MEDIA STEP ── */}
                    {activeStep?.type === 'media' && (
                        <div className="w-full animate-in fade-in duration-500 space-y-8">
                            <label className="border border-dashed border-gray-400 rounded-sm p-12 flex flex-col items-center justify-center gap-4 hover:border-black hover:bg-gray-50 transition-all cursor-pointer">
                                <Upload className="w-8 h-8 text-gray-400" />
                                <div className="text-[11px] font-bold uppercase tracking-widest text-gray-600">Select Files to Upload</div>
                                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                            </label>
                            
                            {files.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 border border-gray-200 rounded-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                                                <div className="flex flex-col overflow-hidden">
                                                    <span className="text-xs font-medium text-black truncate">{f.name}</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">{(f.size/1024).toFixed(1)} KB</span>
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors ml-2">✕</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── OTP VERIFY STEP ── */}
                    {activeStep?.type === 'verify' && (
                        <div className="w-full animate-in fade-in duration-500">
                            {!otpSent ? (
                                <div className="text-center py-8">
                                    <Mail className="w-10 h-10 text-gray-400 mx-auto mb-6" />
                                    <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Authenticated Email</div>
                                    <div className="text-lg font-serif text-black mb-8">{otpEmail || formData.donor_email || 'No email provided'}</div>
                                    <button
                                        type="button"
                                        onClick={handleRequestOtp}
                                        disabled={otpLoading}
                                        className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-sm disabled:opacity-50"
                                    >
                                        {otpLoading ? 'Sending...' : 'Send Verification Code'}
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8 max-w-sm mx-auto">
                                    <Key className="w-8 h-8 text-gray-400 mx-auto mb-6" />
                                    <h4 className="text-xl font-serif text-black mb-2">Enter Access Code</h4>
                                    <p className="text-xs text-gray-500 mb-8">Sent to {otpEmail}</p>
                                    
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full bg-transparent border border-gray-400 rounded-full px-6 py-4 text-center text-3xl tracking-[0.3em] font-medium text-black focus:outline-none focus:border-black transition-all mb-6"
                                    />
                                    <button type="button" onClick={() => setOtpSent(false)} className="text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-black transition-colors underline underline-offset-4">
                                        Change Email Address
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </div>

            {/* ERROR DISPLAY */}
            {displayError && (
                <div className="w-full max-w-4xl mt-6">
                    <div className="p-4 bg-red-50 text-red-600 border border-red-100 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-3 rounded-sm">
                        <AlertCircle className="w-4 h-4" /> {displayError}
                    </div>
                </div>
            )}

            {/* BOTTOM NAVIGATION */}
            <div className="w-full max-w-4xl flex items-center justify-between mt-6 px-2 md:px-0">
                <button
                    type="button"
                    onClick={prevStep}
                    className={`bg-black text-white px-8 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-sm transition-opacity ${currentVisibleIdx === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-gray-800'}`}
                >
                    PREV
                </button>

                <div className="flex items-center gap-4">
                    {currentVisibleIdx === 0 && !hideHeader && (
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest hidden md:inline">
                            Proceed to the Form
                        </span>
                    )}
                    
                    {currentVisibleIdx < visibleSteps.length - 1 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="bg-black text-white px-8 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-gray-800 transition-colors flex items-center gap-2"
                        >
                            NEXT <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting || (definition.otp && otpSent && !otp)}
                            className="bg-black text-white px-8 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                    )}
                </div>
            </div>

        </div>
    );
};

export default ExternalForm;