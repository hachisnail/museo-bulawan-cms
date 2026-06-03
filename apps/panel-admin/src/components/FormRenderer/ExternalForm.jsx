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
    Star
} from 'lucide-react';
import Modal from '../Modal';

const ExternalForm = (props) => {
    const { 
        className = "",
        hideHeader = false,
        infoBlock
    } = props;

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submittedId, setSubmittedId] = useState(null);
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

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
        setModal,
        onSuccess: (result) => {
            setIsSubmitted(true);
            setSubmittedId(result.id);
            if (props.onSuccess) props.onSuccess(result);
        }
    });

    const [currentStepIdx, setCurrentStepIdx] = useState(0);
    const [localError, setLocalError] = useState(null);
    const [fieldErrors, setFieldErrors] = useState({});

    const handleResetForm = () => {
        setIsSubmitted(false);
        setSubmittedId(null);
        setCurrentStepIdx(0);
        setLocalError(null);
        setFieldErrors({});
        setOtp('');
        setOtpSent(false);
    };

    const displayError = localError || apiError;

    const { schema, settings } = definition || {};
    const properties = schema?.properties || {};
    const required = schema?.required || [];
    const stepGroups = settings?.step_groups || [];
    const finalInfoBlock = infoBlock || settings?.info_block || settings?.infoBlock || settings?.intro_block || settings?.introBlock;

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

        if (finalInfoBlock && (finalInfoBlock.header || finalInfoBlock.title || finalInfoBlock.description || finalInfoBlock.text)) {
            result.push({
                id: 'intro_notice',
                label: finalInfoBlock.header || finalInfoBlock.title || 'Notice',
                type: 'info_block',
                fields: []
            });
        }

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
    }, [properties, stepGroups, settings, definition?.otp, finalInfoBlock]);

    const visibleStepIndices = useMemo(() => {
        return steps.map((step, idx) => {
            if (step.type !== 'fields') return idx;
            const hasVisible = step.fields.some(([key, prop]) => isFieldVisible(key, prop));
            return hasVisible ? idx : null;
        }).filter(idx => idx !== null);
    }, [steps, formData]);

    if (loading) return (
        <div className={`flex flex-col w-full max-w-4xl min-w-[320px] md:min-w-[600px] mx-auto font-sans ${className}`}>
            <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-20 flex flex-col items-center justify-center min-h-[500px]">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-black rounded-full animate-spin mb-4"></div>
                <div className="text-xs text-gray-500 uppercase tracking-widest font-bold">Loading Form...</div>
            </div>
        </div>
    );

    if (apiError && !definition) return (
        <div className={`flex flex-col w-full max-w-4xl min-w-[320px] md:min-w-[600px] mx-auto font-sans ${className}`}>
            <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-12 text-center min-h-[500px] flex flex-col justify-center items-center">
                <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
                <h3 className="text-2xl font-serif text-black tracking-wide mb-2">Error</h3>
                <p className="text-sm text-gray-500 mb-8 max-w-md">{apiError}</p>
                <button onClick={() => window.location.reload()} className="px-8 py-3 bg-black text-white text-[10px] font-bold uppercase tracking-widest rounded-sm">Retry</button>
            </div>
        </div>
    );

    if (!definition) return (
        <div className={`flex flex-col w-full max-w-4xl min-w-[320px] md:min-w-[600px] mx-auto font-sans ${className}`}>
            <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-12 text-center min-h-[500px] flex flex-col justify-center items-center">
                <AlertCircle className="w-10 h-10 text-gray-400 mx-auto mb-4" />
                <h3 className="text-2xl font-serif text-black tracking-wide mb-2">Form Not Found</h3>
                <p className="text-sm text-gray-500 mb-8 max-w-md">The form you are looking for is no longer available or does not exist.</p>
            </div>
        </div>
    );

    if (isSubmitted) {
        return (
            <div className={`flex flex-col w-full max-w-4xl min-w-[320px] md:min-w-[600px] mx-auto font-sans ${className}`}>
                <div className="w-full bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-16 text-center animate-in fade-in duration-500 min-h-[500px] flex flex-col justify-center items-center">
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
    const validateCurrentStep = () => {
        setLocalError(null);
        setFieldErrors({});

        if (activeStep?.type === 'fields') {
            const newErrors = {};
            for (const [key, prop] of activeStep.fields) {
                if (!isFieldVisible(key, prop)) continue;
                if (prop['ui:widget'] === 'hidden') continue;
                const isRequired = required.includes(key);
                if (formData.is_anonymous === true && ['donor_first_name', 'donor_last_name'].includes(key)) continue;
                
                const value = formData[key];
                if (isRequired && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                    newErrors[key] = `This field is required`;
                }
            }
            if (Object.keys(newErrors).length > 0) {
                setFieldErrors(newErrors);
                return false;
            }
        }
        return true;
    };

    const nextStep = (e) => {
        if (e) e.preventDefault();
        if (!validateCurrentStep()) return;

        if (currentVisibleIdx < visibleSteps.length - 1) {
            setCurrentStepIdx(currentVisibleIdx + 1);
        }
    };

    const handleFinalSubmit = (e) => {
        if (e) e.preventDefault();
        if (!validateCurrentStep()) return;
        handleSubmit(e);
    };

    const prevStep = (e) => {
        if (e) e.preventDefault();
        setLocalError(null);
        setFieldErrors({});
        if (currentVisibleIdx > 0) {
            setCurrentStepIdx(currentVisibleIdx - 1);
        }
    };

    const onInputChange = (e) => {
        setLocalError(null);
        if (fieldErrors[e.target.name]) {
            setFieldErrors(prev => ({ ...prev, [e.target.name]: null }));
        }
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
        const isFullWidth = prop['ui:width'] === 'full';

        return (
            <div key={key} className={`${isFullWidth ? 'md:col-span-2' : ''} space-y-3`}>
                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    {prop.title || key}
                    {showRequired && <span className="text-red-500">*</span>}
                </label>

                <div className={fieldErrors[key] ? 'animate-form-shake' : ''}>
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
                                <option value="" disabled>Select an option...</option>
                                {prop.enum.map((opt, i) => <option key={`${opt}_${i}`} value={opt}>{opt}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                                <ChevronRight className="w-4 h-4 rotate-90" />
                            </div>
                        </div>
                    ) : prop['ui:widget'] === 'radio' ? (
                        <div className="flex flex-col gap-2 py-2">
                            {prop.enum?.map((opt, i) => (
                                <label key={`${opt}_${i}`} className="flex items-center cursor-pointer">
                                    <input type="radio" name={key} required={showRequired} value={opt} checked={formData[key] === opt} onChange={(e) => {
                                        setLocalError(null);
                                        handleInputChange(e);
                                    }} className="w-4 h-4 text-black border-gray-300 focus:ring-black" />
                                    <span className="ml-3 text-sm text-gray-600">{opt}</span>
                                </label>
                            ))}
                        </div>
                    ) : prop['ui:widget'] === 'checkbox' ? (
                        <div className="flex flex-col gap-2 py-2">
                            {prop.items?.enum?.map((opt, i) => {
                                const currentVals = Array.isArray(formData[key]) ? formData[key] : [];
                                return (
                                    <label key={`${opt}_${i}`} className="flex items-center cursor-pointer">
                                        <input type="checkbox" name={key} value={opt} checked={currentVals.includes(opt)} onChange={(e) => {
                                            setLocalError(null);
                                            const newVals = e.target.checked ? [...currentVals, opt] : currentVals.filter(v => v !== opt);
                                            handleInputChange({ target: { name: key, value: newVals }});
                                        }} className="w-4 h-4 text-black border-gray-300 rounded focus:ring-black" />
                                        <span className="ml-3 text-sm text-gray-600">{opt}</span>
                                    </label>
                                );
                            })}
                        </div>
                    ) : prop['ui:widget'] === 'toggle' ? (
                        <label className="relative inline-flex items-center cursor-pointer py-2">
                            <input type="checkbox" name={key} checked={!!formData[key]} onChange={(e) => handleInputChange({ target: { name: key, value: e.target.checked }})} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                            <span className="ml-3 text-sm text-gray-600">{prop.description || 'Enabled'}</span>
                        </label>
                    ) : prop['ui:widget'] === 'range' ? (
                        <div className="flex flex-col gap-2 py-2">
                            <div className="flex justify-between text-xs text-gray-400 px-1">
                                <span>1</span>
                                <span>10</span>
                            </div>
                            <input type="range" name={key} min="1" max="10" value={formData[key] || 1} onChange={onInputChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black" />
                            <div className="text-center font-bold text-sm">{formData[key] || 1}</div>
                        </div>
                    ) : prop['ui:widget'] === 'linear_scale' ? (
                        <div className="flex flex-col gap-4 py-2">
                            <div className="flex justify-between items-center text-sm font-medium text-gray-600">
                                <span>{prop['ui:minLabel'] || ''}</span>
                                <span>{prop['ui:maxLabel'] || ''}</span>
                            </div>
                            <div className="flex justify-between">
                                {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                                    <label key={num} className="flex flex-col items-center gap-2 cursor-pointer">
                                        <span className="text-xs text-gray-500">{num}</span>
                                        <input type="radio" name={key} required={showRequired} value={num} checked={Number(formData[key]) === num} onChange={onInputChange} className="w-4 h-4 text-black border-gray-400 focus:ring-black" />
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : prop['ui:widget'] === 'multiple_choice_grid' || prop['ui:widget'] === 'checkbox_grid' ? (
                        <div className="overflow-x-auto w-full py-2">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead>
                                    <tr>
                                        <th className="p-2 border-b border-gray-200"></th>
                                        {prop['ui:columns']?.map(col => (
                                            <th key={col} className="p-2 border-b border-gray-200 text-center font-medium text-gray-600">{col}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {prop['ui:rows']?.map((row, rIdx) => (
                                        <tr key={row} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="p-2 font-medium text-gray-700">{row}</td>
                                            {prop['ui:columns']?.map((col, cIdx) => {
                                                const isRadio = prop['ui:widget'] === 'multiple_choice_grid';
                                                const inputType = isRadio ? 'radio' : 'checkbox';
                                                const fieldName = `${key}_${rIdx}`;
                                                
                                                const gridData = formData[key] || {};
                                                const isChecked = isRadio ? gridData[row] === col : (Array.isArray(gridData[row]) && gridData[row].includes(col));
                                                
                                                return (
                                                    <td key={col} className="p-2 text-center">
                                                        <input type={inputType} name={fieldName} value={col} checked={isChecked} onChange={(e) => {
                                                            const newData = { ...gridData };
                                                            if (isRadio) {
                                                                newData[row] = e.target.value;
                                                            } else {
                                                                const currentVals = Array.isArray(newData[row]) ? newData[row] : [];
                                                                newData[row] = e.target.checked ? [...currentVals, col] : currentVals.filter(v => v !== col);
                                                            }
                                                            handleInputChange({ target: { name: key, value: newData }});
                                                        }} className="w-4 h-4 text-black border-gray-400 focus:ring-black" />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : prop['ui:widget'] === 'rating' ? (
                        <div className="flex items-center gap-2 py-2">
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setLocalError(null);
                                        if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: null }));
                                        handleInputChange({ target: { name: key, value: star } });
                                    }}
                                    className={`transition-all hover:scale-110 focus:outline-none`}
                                >
                                    <Star className={`w-10 h-10 ${Number(formData[key]) >= star ? 'text-[#F5A623] fill-[#F5A623] drop-shadow-sm' : 'text-gray-300 hover:text-[#F5A623]/50'}`} />
                                </button>
                            ))}
                        </div>
) : prop['ui:widget'] === 'file' || prop.format === 'file' ? (
    <div className="space-y-4">
        <label 
            className="w-full border border-dashed border-gray-400 rounded-sm p-8 flex flex-col items-center justify-center gap-4 hover:border-black hover:bg-gray-50 transition-all cursor-pointer"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileChange({ target: { files: e.dataTransfer.files }}); 
                    // Tell formData that this required field has been filled
                    onInputChange({ target: { name: key, value: Array.from(e.dataTransfer.files).map(f => f.name).join(', ') } });
                }
            }}
        >
            <Upload className="w-6 h-6 text-gray-400" />
            <div className="text-[11px] font-bold uppercase tracking-widest text-gray-600">Drag & Drop or Click to Upload</div>
            <input type="file" multiple onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                    handleFileChange(e);
                    // Tell formData that this required field has been filled
                    onInputChange({ target: { name: key, value: Array.from(e.target.files).map(f => f.name).join(', ') } });
                }
            }} className="hidden" />
        </label>
        {files.length > 0 && (
            <div className="grid grid-cols-1 gap-2">
                {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-gray-200 rounded-sm">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-xs font-medium text-black truncate">{f.name}</span>
                        </div>
                        <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500 transition-colors ml-2">✕</button>
                    </div>
                ))}
            </div>
        )}
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
                            type={prop.format === 'email' ? 'email' : prop.format === 'date' ? 'date' : prop.format === 'time' ? 'time' : prop.type === 'number' ? 'number' : 'text'}
                            name={key}
                            required={showRequired}
                            value={formData[key] || ''}
                            onChange={onInputChange}
                            placeholder={prop.description}
                            className={`w-full bg-transparent border rounded-full px-5 py-2 text-sm text-black focus:outline-none transition-colors placeholder:text-gray-300 ${fieldErrors[key] ? 'border-red-500 focus:border-red-500' : 'border-gray-400 focus:border-black'}`}
                        />
                    )}
                </div>
                {fieldErrors[key] && (
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1.5 mt-1.5">
                        <AlertCircle className="w-3 h-3" /> {fieldErrors[key]}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div className={`flex flex-col w-full max-w-4xl min-w-[320px] md:min-w-[600px] mx-auto font-sans ${className}`}>
            <style>{`
                @keyframes form-shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
                    20%, 40%, 60%, 80% { transform: translateX(3px); }
                }
                .animate-form-shake {
                    animation: form-shake 0.4s ease-in-out;
                }
            `}</style>
            
            {/* MAIN INNER CARD */}
            <div className="w-full bg-white rounded-2xl border border-gray-300 shadow-[0_8px_30px_rgba(0,0,0,0.08)] p-10 md:p-16 lg:p-20 relative min-h-[500px] flex flex-col">
                
                {/* Header Section */}
                <header className="mb-8">
                    {activeStep?.type === 'info_block' ? (
                        <div className="text-left animate-in fade-in duration-500">
                            <h2 className="text-4xl md:text-5xl font-serif text-black tracking-widest uppercase">
                                {finalInfoBlock.header || finalInfoBlock.title || "Notice"}
                            </h2>
                        </div>
                    ) : currentVisibleIdx === 0 && !hideHeader ? (
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
                    {activeStep?.type !== 'info_block' && <hr className="border-t border-gray-300 mt-6" />}
                </header>


                <form 
                    className={`flex flex-col flex-1`}
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (currentVisibleIdx < visibleSteps.length - 1) nextStep();
                        else handleSubmit(e);
                    }} 
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.preventDefault();
                    }}
                >

                    {/* ── INFO BLOCK STEP ── */}
                    {activeStep?.type === 'info_block' && (
                        <div className="w-full animate-in fade-in duration-500 flex-1 flex flex-col justify-start items-start pb-10 pt-4">
                            {(finalInfoBlock.description || finalInfoBlock.text) && (
                                <p className="text-base md:text-lg font-sans text-gray-700 leading-relaxed font-normal whitespace-pre-wrap text-left max-w-3xl indent-8 md:indent-12">
                                    {finalInfoBlock.description || finalInfoBlock.text}
                                </p>
                            )}
                        </div>
                    )}

                    {/* ── FIELD STEPS ── */}
                    {activeStep?.type === 'fields' && (
                        <div className="w-full animate-in fade-in duration-500 flex-1">
                            {activeStep.fields.map(([key, prop]) => renderField(key, prop))}
                        </div>
                    )}

                    {/* ── MEDIA STEP ── */}
                    {activeStep?.type === 'media' && (
                        <div className="w-full animate-in fade-in duration-500 space-y-8 flex-1">
                            <label 
                                className="border border-dashed border-gray-400 rounded-sm p-12 flex flex-col items-center justify-center gap-4 hover:border-black hover:bg-gray-50 transition-all cursor-pointer"
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handleFileChange({ target: { files: e.dataTransfer.files }}); 
                                    }
                                }}
                            >
                                <Upload className="w-8 h-8 text-gray-400" />
                                <div className="text-[11px] font-bold uppercase tracking-widest text-gray-600">Drag & Drop or Click to Upload</div>
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
                        <div className="w-full animate-in fade-in duration-500 flex-1 flex flex-col justify-center">
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
                <div className="w-full mt-6">
                    <div className="p-4 bg-red-50 text-red-600 border border-red-100 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-3 rounded-sm">
                        <AlertCircle className="w-4 h-4" /> {displayError}
                    </div>
                </div>
            )}

            {/* BOTTOM NAVIGATION (Outside Card) */}
            <div className="w-full relative flex items-center justify-between mt-6 px-2 md:px-0">
                <button
                    type="button"
                    onClick={prevStep}
                    className={`bg-black text-white px-8 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-sm transition-opacity ${currentVisibleIdx === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-gray-800'}`}
                >
                    PREV
                </button>

                <div className="flex items-center gap-4">
                    {currentVisibleIdx === 0 && !hideHeader && (
                        <span className="text-xs font-sans text-gray-500 hidden md:inline">
                            Proceed to the {definition.type ? definition.type.charAt(0).toUpperCase() + definition.type.slice(1).replace('_', ' ') : 'Appointment'} form.
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
                            onClick={handleFinalSubmit}
                            disabled={submitting || (definition.otp && otpSent && !otp)}
                            className="bg-black text-white px-8 py-2.5 text-[10px] font-bold tracking-widest uppercase rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Submitting...' : 'Submit'}
                        </button>
                    )}
                </div>
            </div>

            <Modal {...modal} onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />
        </div>
    );
};

export default ExternalForm;