import React, { useState, useMemo } from 'react';
import { useFormLogic } from './useFormLogic';
import { 
    ChevronRight, 
    ChevronLeft, 
    Check, 
    AlertCircle, 
    FileText, 
    Upload, 
    Shield, 
    Mail, 
    Key,
    Send,
    User,
    Gift,
    Archive
} from 'lucide-react';

const STEP_ICONS = {
    user: User,
    gift: Gift,
    archive: Archive,
    media: Upload,
    verify: Shield
};

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

    // ── Build Steps from step_groups or fallback to 1-field-per-step ──
    const steps = useMemo(() => {
        const result = [];

        if (stepGroups.length > 0) {
            // Group-based wizard: each step_group becomes one wizard step
            for (const group of stepGroups) {
                const groupFields = Object.entries(properties)
                    .filter(([, prop]) => prop['ui:group'] === group.id);
                
                if (groupFields.length > 0) {
                    result.push({
                        id: group.id,
                        label: group.label,
                        icon: group.icon || 'archive',
                        type: 'fields',
                        fields: groupFields
                    });
                }
            }

            // Also capture any ungrouped fields
            const groupedIds = new Set(stepGroups.map(g => g.id));
            const ungroupedFields = Object.entries(properties)
                .filter(([, prop]) => !prop['ui:group'] || !groupedIds.has(prop['ui:group']))
                .filter(([, prop]) => prop['ui:widget'] !== 'hidden');
            
            if (ungroupedFields.length > 0) {
                result.push({
                    id: 'additional',
                    label: 'Additional Details',
                    icon: 'archive',
                    type: 'fields',
                    fields: ungroupedFields
                });
            }
        } else {
            // Fallback: one field per step
            const allFields = Object.entries(properties).filter(([, prop]) => prop['ui:widget'] !== 'hidden');
            for (const entry of allFields) {
                const [key, prop] = entry;
                result.push({
                    id: `field-${key}`,
                    label: prop.title || key,
                    icon: 'archive',
                    type: 'fields',
                    fields: [entry]
                });
            }
        }

        // Append media & OTP steps
        if (settings?.allow_attachments) {
            result.push({ id: 'media', label: 'Media Documentation', icon: 'media', type: 'media', fields: [] });
        }
        if (definition?.otp) {
            result.push({ id: 'verify', label: 'Verification', icon: 'verify', type: 'verify', fields: [] });
        }

        return result;
    }, [properties, stepGroups, settings, definition?.otp]);

    // ── Determine which steps have at least one visible field ──
    const visibleStepIndices = useMemo(() => {
        return steps.map((step, idx) => {
            if (step.type !== 'fields') return idx; // media/verify always visible
            const hasVisible = step.fields.some(([key, prop]) => isFieldVisible(key, prop));
            return hasVisible ? idx : null;
        }).filter(idx => idx !== null);
    }, [steps, formData]);

    if (loading) return (
        <div className="p-40 text-center flex flex-col items-center justify-center gap-6 animate-in fade-in duration-700">
            <div className="w-12 h-12 border-2 border-zinc-100 border-t-[#D4AF37] rounded-full animate-spin"></div>
            <div className="text-[11px] font-black uppercase tracking-[0.4em] text-zinc-300">Initializing Official Portal...</div>
        </div>
    );

    if (apiError && !definition) return (
        <div className="max-w-2xl mx-auto p-12 bg-white border border-zinc-200 rounded-sm shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-rose-50 rounded-sm flex items-center justify-center text-rose-500 mb-6">
                <AlertCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-serif text-black uppercase tracking-widest mb-2">Access Restricted</h3>
            <p className="text-sm text-zinc-500 font-light italic mb-8">{apiError}</p>
            <button onClick={() => window.location.reload()} className="px-8 py-3 bg-black text-[#D4AF37] text-[10px] font-black uppercase tracking-widest rounded-sm">Retry Connection</button>
        </div>
    );

    if (!definition) return null;

    if (isSubmitted) {
        return (
            <div className="max-w-2xl mx-auto p-16 bg-white border border-zinc-200 rounded-sm shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-500 min-h-[500px] justify-center">
                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-8 shadow-inner animate-bounce">
                    <Check className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-serif text-black uppercase tracking-widest mb-4">Submission Received</h3>
                <p className="text-sm text-zinc-500 font-light italic max-w-md leading-relaxed mb-8">
                    Your acquisition submission has been successfully transmitted to the Museo Bulawan registry department. A curatorial representative will review the documentation.
                </p>
                {submittedId && (
                    <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-6 mb-10 w-full max-w-md">
                        <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1">Receipt ID</div>
                        <code className="text-xs font-mono font-bold text-black">{submittedId}</code>
                    </div>
                )}
                <button
                    onClick={handleResetForm}
                    className="px-10 py-4 bg-[#D4AF37] text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-sm hover:bg-[#B48F17] hover:shadow-2xl transition-all"
                >
                    Submit Another Artifact
                </button>
            </div>
        );
    }

    const visibleSteps = visibleStepIndices.map(i => steps[i]);
    const currentVisibleIdx = Math.min(currentStepIdx, visibleSteps.length - 1);
    const activeStep = visibleSteps[currentVisibleIdx];

    // ── Navigation ──
    const nextStep = (e) => {
        e.preventDefault();
        setLocalError(null);

        // Validate current step's visible required fields
        if (activeStep?.type === 'fields') {
            for (const [key, prop] of activeStep.fields) {
                if (!isFieldVisible(key, prop)) continue;
                if (prop['ui:widget'] === 'hidden') continue;
                const isRequired = required.includes(key);
                // For anonymous donors, skip name field validation
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
        e.preventDefault();
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
        // Don't mark as required visually if anonymous and it's a name field
        const showRequired = isRequired && !(formData.is_anonymous === true && ['donor_first_name', 'donor_last_name'].includes(key));

        return (
            <div key={key} className="space-y-3 group">
                <label className="text-[11px] font-black uppercase tracking-[0.1em] text-zinc-500 flex items-center gap-2 group-focus-within:text-black transition-colors">
                    {prop.title || key}
                    {showRequired && <span className="text-[#D4AF37]">•</span>}
                </label>

                {prop.type === 'boolean' ? (
                    <label className="relative inline-flex items-center cursor-pointer group/toggle py-2">
                        <input type="checkbox" name={key} checked={!!formData[key]} onChange={onInputChange} className="sr-only peer" />
                        <div className="w-12 h-6 bg-zinc-100 rounded-sm peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-zinc-500 after:rounded-sm after:h-4.5 after:w-5 after:transition-all peer-checked:bg-black after:peer-checked:bg-[#D4AF37]"></div>
                        <span className="ml-4 text-xs text-zinc-600 group-hover/toggle:text-black transition-colors">{prop.description || 'Confirmed'}</span>
                    </label>
                ) : prop.enum ? (
                    <div className="relative">
                        <select
                            name={key}
                            required={showRequired}
                            value={formData[key] || ''}
                            onChange={onInputChange}
                            className="w-full bg-zinc-100 border border-zinc-300 rounded-sm px-6 py-5 text-[13px] text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all appearance-none font-medium"
                        >
                            <option value="" disabled>Please select an option...</option>
                            {prop.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-300">
                            <ChevronRight className="w-4 h-4 rotate-90" />
                        </div>
                    </div>
                ) : prop.format === 'textarea' ? (
                    <textarea
                        name={key}
                        required={showRequired}
                        value={formData[key] || ''}
                        onChange={onInputChange}
                        rows={5}
                        placeholder={prop.description}
                        className="w-full bg-zinc-100 border border-zinc-300 rounded-sm px-6 py-5 text-[13px] text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all resize-none placeholder:text-zinc-400 font-light"
                    />
                ) : prop.format === 'file' ? (
                    <div className="space-y-4">
                        <label className="border-2 border-dashed border-zinc-200 rounded-sm p-10 flex flex-col items-center justify-center gap-4 hover:border-[#D4AF37] hover:bg-zinc-50 transition-all cursor-pointer group/upload">
                            <div className="w-12 h-12 bg-white border border-zinc-300 rounded-sm flex items-center justify-center text-zinc-400 group-hover/upload:text-[#D4AF37] transition-all">
                                <Upload className="w-6 h-6" />
                            </div>
                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{prop.description || 'Select Files'}</div>
                            <input type="file" multiple onChange={handleFileChange} className="hidden" />
                        </label>
                        {files.length > 0 && (
                            <div className="grid grid-cols-1 gap-2">
                                {files.map((f, i) => (
                                    <div key={i} className="flex items-center justify-between p-4 border border-zinc-200 rounded-sm bg-white shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-zinc-50 rounded-sm flex items-center justify-center text-[#D4AF37]">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-black truncate max-w-[200px]">{f.name}</span>
                                                <span className="text-[9px] text-zinc-400 uppercase">{(f.size/1024).toFixed(1)} KB</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => removeFile(i)} className="p-1 text-rose-300 hover:text-rose-500 transition-colors">✕</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <input
                        type={prop.format === 'email' ? 'email' : prop.format === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'}
                        name={key}
                        required={showRequired}
                        value={formData[key] || ''}
                        onChange={onInputChange}
                        placeholder={prop.description}
                        className="w-full bg-zinc-100 border border-zinc-300 rounded-sm px-6 py-5 text-[13px] text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-all placeholder:text-zinc-400 font-medium"
                    />
                )}
            </div>
        );
    };

    const StepIcon = STEP_ICONS[activeStep?.icon] || Archive;

    return (
        <div className={`external-form-modern flex flex-col lg:flex-row bg-white border border-zinc-300 rounded-sm shadow-[0_40px_100px_rgba(0,0,0,0.1)] overflow-hidden min-h-[600px] max-w-6xl mx-auto ${className}`}>
            
            {/* PUBLIC PORTAL SIDEBAR */}
            <aside className="lg:w-80 bg-zinc-950 text-white p-10 flex flex-col justify-between relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#D4AF37]/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-[#D4AF37] mb-12">
                        <Shield className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Official Portal</span>
                    </div>
                    
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
                        {visibleSteps.map((step, idx) => {
                            const IconComp = STEP_ICONS[step.icon] || Archive;
                            return (
                                <div key={step.id} className="flex items-center gap-5">
                                    <div className={`w-8 h-8 rounded-sm flex items-center justify-center text-[11px] font-black transition-all ${
                                        currentVisibleIdx === idx ? 'bg-[#D4AF37] text-black shadow-[0_0_20px_rgba(212,175,55,0.3)]' : 
                                        currentVisibleIdx > idx ? 'bg-green-500 text-white' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                                    }`}>
                                        {currentVisibleIdx > idx ? <Check className="w-4 h-4" /> : <IconComp className="w-3.5 h-3.5" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className={`text-[10px] uppercase font-black tracking-widest ${currentVisibleIdx === idx ? 'text-white' : 'text-zinc-600'}`}>
                                            {step.label}
                                        </span>
                                        <div className="h-0.5 bg-zinc-900 mt-1 w-12 rounded-full overflow-hidden">
                                            <div className={`h-full bg-[#D4AF37] transition-all duration-500 ${currentVisibleIdx >= idx ? 'w-full' : 'w-0'}`}></div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="relative z-10 pt-10 border-t border-zinc-900 mt-6">
                    <div className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mb-2">Legal Compliance</div>
                    <p className="text-[10px] text-zinc-500 font-light italic leading-relaxed">By submitting, you agree to the museum's curatorial standards and terms of provenance.</p>
                </div>
            </aside>

            {/* PUBLIC PORTAL CONTENT */}
            <div className="flex-1 p-10 md:p-20 relative flex flex-col justify-between min-h-[600px]">
                {!hideHeader && currentVisibleIdx === 0 && (
                    <header className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-[#A68A27] mb-4">Museo Bulawan Submission</div>
                        <h2 className="text-4xl font-serif text-black uppercase tracking-tight mb-4 leading-tight">
                            {definition.title}
                        </h2>
                        {settings?.description && (
                            <p className="text-sm text-zinc-500 font-light italic max-w-xl leading-relaxed">
                                {settings.description}
                            </p>
                        )}
                    </header>
                )}

                {/* Step header for non-first steps */}
                {currentVisibleIdx > 0 && activeStep?.type === 'fields' && (
                    <div className="mb-8 animate-in fade-in duration-500">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-10 h-10 bg-zinc-100 rounded-sm flex items-center justify-center text-[#D4AF37]">
                                <StepIcon className="w-5 h-5" />
                            </div>
                            <h3 className="text-2xl font-serif text-black uppercase tracking-wide">{activeStep.label}</h3>
                        </div>
                    </div>
                )}

                <form 
                    onSubmit={handleSubmit} 
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                        }
                    }}
                    className="flex-1 flex flex-col justify-between space-y-8"
                >
                    <div className="flex-1 flex flex-col justify-center min-h-[300px]">

                        {/* ── FIELD STEPS ── */}
                        {activeStep?.type === 'fields' && (
                            <div className="w-full max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
                                {activeStep.fields.map(([key, prop]) => renderField(key, prop))}
                            </div>
                        )}

                        {/* ── MEDIA STEP ── */}
                        {activeStep?.type === 'media' && (
                            <div className="w-full max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
                                <div className="text-center md:text-left">
                                    <h4 className="text-2xl font-serif text-black uppercase tracking-wide mb-2">Visual Documentation</h4>
                                    <p className="text-sm text-zinc-500 font-light italic">Attach up to 5 clear photographs of the artifact for archival assessment.</p>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <label className="border-2 border-dashed border-zinc-200 rounded-sm p-16 flex flex-col items-center justify-center gap-6 hover:border-[#D4AF37] hover:bg-zinc-100 transition-all cursor-pointer group">
                                        <div className="w-16 h-16 bg-white border border-zinc-300 rounded-sm flex items-center justify-center text-zinc-400 group-hover:text-[#D4AF37] group-hover:shadow-2xl transition-all">
                                            <Upload className="w-8 h-8" />
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">Select Media Files</div>
                                        <input type="file" multiple onChange={handleFileChange} className="hidden" />
                                    </label>
                                    
                                    <div className="grid grid-cols-1 gap-3">
                                        {files.map((f, i) => (
                                            <div key={i} className="flex items-center justify-between p-5 border border-zinc-200 rounded-sm bg-white shadow-sm hover:shadow-md transition-shadow group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 bg-zinc-50 rounded-sm flex items-center justify-center text-[#D4AF37]">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-black truncate max-w-[200px]">{f.name}</span>
                                                        <span className="text-[9px] text-zinc-400 uppercase tracking-tighter">{(f.size/1024).toFixed(1)} KB • READY</span>
                                                    </div>
                                                </div>
                                                <button type="button" onClick={() => removeFile(i)} className="p-2 text-rose-300 hover:text-rose-500 transition-colors">✕</button>
                                            </div>
                                        ))}
                                        {files.length === 0 && (
                                            <div className="h-full border border-zinc-50 border-dashed rounded-sm flex items-center justify-center italic text-zinc-300 text-xs">No media attached for this submission.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── OTP VERIFY STEP ── */}
                        {activeStep?.type === 'verify' && (
                            <div className="w-full max-w-md mx-auto space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
                                <div className="text-center space-y-4">
                                    <h4 className="text-2xl font-serif text-black uppercase tracking-wide">Identity Verification</h4>
                                    <p className="text-sm text-zinc-500 font-light italic leading-relaxed">
                                        To protect the integrity of the museum archive, please verify your email address before finalizing the submission.
                                    </p>
                                </div>

                                {!otpSent ? (
                                    <div className="p-12 bg-zinc-50 border border-zinc-100 rounded-sm text-center space-y-8">
                                        <div className="w-20 h-20 bg-white border border-zinc-200 rounded-sm flex items-center justify-center text-[#D4AF37] mx-auto shadow-sm">
                                            <Mail className="w-10 h-10" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-1">Authenticated Channel</div>
                                            <div className="text-sm font-bold text-black">{otpEmail || formData.donor_email || 'No email provided'}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRequestOtp}
                                            disabled={otpLoading}
                                            className="w-full py-5 bg-black text-[#D4AF37] rounded-sm text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-2xl shadow-black/10 disabled:opacity-50 flex items-center justify-center gap-3"
                                        >
                                            {otpLoading ? 'Dispatching Code...' : <><Send className="w-4 h-4" /> Receive Access Token</>}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-12 bg-white border border-zinc-200 rounded-sm shadow-2xl text-center space-y-10 animate-in zoom-in-95 duration-500">
                                        <div className="w-16 h-16 bg-green-50 text-green-500 rounded-sm flex items-center justify-center mx-auto">
                                            <Key className="w-8 h-8" />
                                        </div>
                                        <div className="space-y-6">
                                            <div>
                                                <h4 className="text-lg font-bold text-black uppercase tracking-widest">Enter Access Code</h4>
                                                <p className="text-[10px] text-zinc-400 uppercase tracking-tighter mt-1">Sent to {otpEmail}</p>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="000000"
                                                maxLength={6}
                                                value={otp}
                                                onChange={(e) => setOtp(e.target.value)}
                                                className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-6 py-6 text-center text-5xl tracking-[0.4em] font-black text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                            />
                                            <button type="button" onClick={() => setOtpSent(false)} className="text-[9px] font-black uppercase tracking-widest text-[#A68A27] hover:underline underline-offset-4 transition-all">Incorrect email? Change address.</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {displayError && (
                        <div className="max-w-xl mx-auto p-5 bg-rose-50 border border-rose-100 text-rose-600 text-[11px] font-bold uppercase tracking-widest flex items-center gap-4 rounded-sm animate-in shake-in duration-300">
                            <AlertCircle className="w-5 h-5" /> {displayError}
                        </div>
                    )}

                    {/* NAVIGATION CONTROLS */}
                    <div className="flex flex-col items-center justify-center pt-8 border-t border-zinc-100 gap-4 mt-auto">
                        <div className="flex items-center gap-6 justify-center">
                            <button
                                type="button"
                                onClick={prevStep}
                                disabled={currentVisibleIdx === 0}
                                className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-black hover:border-black transition-all disabled:opacity-30 disabled:pointer-events-none"
                                title="Previous Step"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>

                            <div className="text-[10px] font-black uppercase tracking-widest text-zinc-400 min-w-[120px] text-center">
                                Step {currentVisibleIdx + 1} of {visibleSteps.length}
                            </div>

                            {currentVisibleIdx < visibleSteps.length - 1 ? (
                                <button
                                    type="button"
                                    onClick={nextStep}
                                    className="w-12 h-12 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-400 hover:text-black hover:border-black transition-all"
                                    title="Next Step"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={submitting || (definition.otp && otpSent && !otp)}
                                    className="px-8 py-3 bg-black text-[#D4AF37] rounded-sm text-[10px] font-black uppercase tracking-[0.2em] hover:bg-zinc-900 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
                                >
                                    {submitting ? 'Submitting...' : 'Submit'}
                                    <Check className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ExternalForm;
