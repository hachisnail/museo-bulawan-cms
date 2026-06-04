import React, { useState } from 'react';
import { useFormLogic } from './useFormLogic';
import { Check, AlertCircle, FileText, Upload, Star } from 'lucide-react';
import Modal from '../Modal';

const InternalForm = (props) => {
    const { 
        className = "",
        hideHeader = false,
        infoBlock,
    } = props;
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'alert', variant: 'info' });

    const {
        definition,
        formData,
        files,
        loading,
        submitting,
        error,
        handleInputChange,
        handleFileChange,
        removeFile,
        handleSubmit
    } = useFormLogic({ 
        ...props, 
        onError: (err) => alert(err.message || err)
    });

    const [fieldErrors, setFieldErrors] = useState({});

    const onInputChange = (e) => {
        if (e && e.target && e.target.name && fieldErrors[e.target.name]) {
            setFieldErrors(prev => ({ ...prev, [e.target.name]: null }));
        }

        if (definition && definition.schema && definition.schema.properties) {
            const prop = definition.schema.properties[e.target?.name];
            if (prop && (prop.format === 'phone' || prop.format === 'tel')) {
                const val = e.target.value;
                if (val && !/^[0-9+\-\s()]*$/.test(val)) return;
            }
        }

        handleInputChange(e);
    };

    const handleInternalSubmit = (e) => {
        e.preventDefault();
        setFieldErrors({});
        const newErrors = {};
        
        const properties = definition?.schema?.properties || {};
        const required = definition?.schema?.required || [];
        
        Object.entries(properties).forEach(([key, prop]) => {
            const dependency = prop['ui:dependsOn'] || prop['dependsOn'];
            let isVisible = true;
            if (dependency) {
                const { field, value, values, operator = 'eq' } = dependency;
                const actualValue = formData[field];
                if (operator === 'eq') isVisible = actualValue === value;
                else if (operator === 'neq') isVisible = actualValue !== value;
                else if (operator === 'in') isVisible = values?.includes(actualValue);
                else if (operator === 'not_empty') isVisible = !!actualValue;
            }
            if (!isVisible) return;
            if (prop['ui:widget'] === 'hidden') return;
            
            const isRequired = required.includes(key);
            const value = formData[key];
            if (isRequired && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
                newErrors[key] = 'This field is required';
                return;
            }

            if (value === undefined || value === null || value === '') return;

            if (prop.format === 'email') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) newErrors[key] = `Please enter a valid email address`;
            } else if (prop.format === 'phone' || prop.format === 'tel') {
                const phoneRegex = /^[0-9+\-\s()]+$/;
                if (!phoneRegex.test(value)) newErrors[key] = `Please enter a valid phone number`;
                else if (value.replace(/[^0-9]/g, '').length < 10) newErrors[key] = `Phone number must have at least 10 digits`;
            } else if (prop.format === 'url' || prop.format === 'uri') {
                try { new URL(value); } catch (_) { newErrors[key] = `Please enter a valid URL`; }
            }
            
            if (typeof value === 'string') {
                if (prop.minLength !== undefined && value.length < prop.minLength) newErrors[key] = `Must be at least ${prop.minLength} characters`;
                if (prop.maxLength !== undefined && value.length > prop.maxLength) newErrors[key] = `Must be at most ${prop.maxLength} characters`;
                if (prop.pattern) {
                    try {
                        if (!new RegExp(prop.pattern).test(value)) newErrors[key] = prop['ui:error'] || `Invalid format`;
                    } catch (e) {}
                }
            }
            
            if (prop.type === 'number' || prop.type === 'integer') {
                const num = Number(value);
                if (isNaN(num)) newErrors[key] = `Must be a valid number`;
                else {
                    if (prop.minimum !== undefined && num < prop.minimum) newErrors[key] = `Must be at least ${prop.minimum}`;
                    if (prop.maximum !== undefined && num > prop.maximum) newErrors[key] = `Must be at most ${prop.maximum}`;
                }
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setFieldErrors(newErrors);
            return;
        }
        handleSubmit(e);
    };

    if (loading) return (
        <div className="py-10 text-center flex flex-col items-center justify-center gap-4 min-h-[400px]">
            <div className="w-6 h-6 border-2 border-zinc-200 border-t-black rounded-full animate-spin"></div>
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-300">Retrieving Schema...</div>
        </div>
    );

    if (error && !definition) return (
        <div className="p-6 bg-rose-50 border border-rose-100 rounded-sm flex items-center gap-4">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <p className="text-[10px] text-rose-600 font-bold uppercase tracking-tight">{error}</p>
        </div>
    );

    if (!definition) return (
        <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-sm flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-8 h-8 text-zinc-400" />
            <h3 className="text-lg font-serif text-black">Form Not Found</h3>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest">The requested form does not exist or has been removed.</p>
        </div>
    );

    const { schema, settings } = definition;
    const properties = schema?.properties || {};
    const required = schema?.required || [];
    const finalInfoBlock = infoBlock || settings?.info_block || settings?.infoBlock || settings?.intro_block || settings?.introBlock;

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

    return (
        <div className={`internal-form-compact ${className}`}>
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
            {!hideHeader && (
                <header className="mb-8 pb-4 border-b border-zinc-200">
                    <h2 className="text-xl font-serif text-black uppercase tracking-tight">{definition.title}</h2>
                    {settings?.description && (
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase font-black tracking-widest leading-relaxed">
                            {settings.description}
                        </p>
                    )}
                </header>
            )}

            {finalInfoBlock && (finalInfoBlock.header || finalInfoBlock.title || finalInfoBlock.description || finalInfoBlock.text) && (
                <div className="mb-6 p-4 bg-zinc-50 border border-zinc-200 rounded-sm">
                    {(finalInfoBlock.header || finalInfoBlock.title) && (
                        <h3 className="text-xs font-bold uppercase tracking-wider text-black mb-1">
                            {finalInfoBlock.header || finalInfoBlock.title}
                        </h3>
                    )}
                    {(finalInfoBlock.description || finalInfoBlock.text) && (
                        <p className="text-[11px] text-zinc-500 leading-relaxed font-light">
                            {finalInfoBlock.description || finalInfoBlock.text}
                        </p>
                    )}
                </div>
            )}

            <form onSubmit={handleInternalSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    {Object.entries(properties).map(([key, prop]) => {
                        if (!isFieldVisible(key, prop)) return null;
                        if (prop['ui:widget'] === 'hidden') {
                            return <input key={key} type="hidden" name={key} value={formData[key] || ''} />;
                        }

                        const isRequired = required.includes(key);
                        const isFullWidth = prop.type === 'string' && prop.format === 'textarea';

                        const titleText = prop.title !== undefined ? prop.title : key;
                        const hasTitleText = titleText !== '';

                        return (
                            <div key={key} className={`${isFullWidth ? 'md:col-span-2' : ''} space-y-2`}>
                                {(hasTitleText || isRequired) && (
                                    <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                                        {titleText}
                                        {isRequired && <span className="text-red-500">•</span>}
                                    </label>
                                )}
                                {prop.description && (
                                    <p className="text-[10px] text-zinc-400 font-normal leading-relaxed mt-0.5">{prop.description}</p>
                                )}

                                <div className={fieldErrors[key] ? 'animate-form-shake' : ''}>
                                {prop.type === 'boolean' ? (
                                    <label className="relative inline-flex items-center cursor-pointer group py-1.5">
                                        <input type="checkbox" name={key} checked={!!formData[key]} onChange={onInputChange} className="sr-only peer" />
                                        <div className="w-10 h-5 bg-zinc-100 rounded-sm peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-sm after:h-4 after:w-4 after:transition-all peer-checked:bg-black after:peer-checked:bg-white"></div>
                                        <span className="ml-3 text-[10px] text-zinc-500 group-hover:text-black transition-colors uppercase font-bold tracking-tighter">{prop.description || 'Enable'}</span>
                                    </label>
                                ) : prop['ui:widget'] === 'radio' ? (
                                    <div className="flex flex-col gap-2 py-2">
                                        {prop.enum?.map((opt, i) => (
                                            <label key={`${opt}_${i}`} className="flex items-center cursor-pointer group">
                                                <input type="radio" name={key} required={isRequired} value={opt} checked={formData[key] === opt} onChange={onInputChange} className="w-4 h-4 text-black border-zinc-300 focus:ring-black" />
                                                <span className="ml-3 text-[11px] text-zinc-600 font-medium group-hover:text-black transition-colors">{opt}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : prop['ui:widget'] === 'checkbox' ? (
                                    <div className="flex flex-col gap-2 py-2">
                                        {prop.items?.enum?.map((opt, i) => {
                                            const currentVals = Array.isArray(formData[key]) ? formData[key] : [];
                                            return (
                                                <label key={`${opt}_${i}`} className="flex items-center cursor-pointer group">
                                                    <input type="checkbox" name={key} value={opt} checked={currentVals.includes(opt)} onChange={(e) => {
                                                        const newVals = e.target.checked ? [...currentVals, opt] : currentVals.filter(v => v !== opt);
                                                        onInputChange({ target: { name: key, value: newVals }});
                                                    }} className="w-4 h-4 text-black border-zinc-300 rounded-sm focus:ring-black" />
                                                    <span className="ml-3 text-[11px] text-zinc-600 font-medium group-hover:text-black transition-colors">{opt}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                ) : prop['ui:widget'] === 'rating' ? (
                                    <div className="flex items-center gap-1 py-2">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onInputChange({ target: { name: key, value: star }});
                                                }}
                                                className={`transition-all hover:scale-110 focus:outline-none`}
                                            >
                                                <Star className={`w-8 h-8 ${Number(formData[key]) >= star ? 'text-black fill-black' : 'text-zinc-300 hover:text-zinc-400'}`} />
                                            </button>
                                        ))}
                                    </div>
                                ) : prop['ui:widget'] === 'range' ? (
                                    <div className="flex flex-col gap-2 py-2">
                                        <div className="flex justify-between text-[10px] text-zinc-400 font-bold px-1">
                                            <span>1</span>
                                            <span>10</span>
                                        </div>
                                        <input type="range" name={key} min="1" max="10" value={formData[key] || 1} onChange={onInputChange} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-black" />
                                        <div className="text-center font-black text-xs text-black">{formData[key] || 1}</div>
                                    </div>
                                ) : prop['ui:widget'] === 'linear_scale' ? (
                                    <div className="flex flex-col gap-4 py-2">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                                            <span>{prop['ui:minLabel'] || ''}</span>
                                            <span>{prop['ui:maxLabel'] || ''}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                                                <label key={num} className="flex flex-col items-center gap-2 cursor-pointer">
                                                    <span className="text-[10px] font-bold text-zinc-400">{num}</span>
                                                    <input type="radio" name={key} required={isRequired} value={num} checked={Number(formData[key]) === num} onChange={onInputChange} className="w-4 h-4 text-black border-zinc-300 focus:ring-black" />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ) : prop['ui:widget'] === 'multiple_choice_grid' || prop['ui:widget'] === 'checkbox_grid' ? (
                                    <div className="overflow-x-auto w-full py-2">
                                        <table className="w-full text-[11px] text-left border-collapse min-w-[400px]">
                                            <thead>
                                                <tr>
                                                    <th className="p-2 border-b border-zinc-200"></th>
                                                    {prop['ui:columns']?.map(col => (
                                                        <th key={col} className="p-2 border-b border-zinc-200 text-center font-bold text-zinc-500 uppercase tracking-wider">{col}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {prop['ui:rows']?.map((row, rIdx) => (
                                                    <tr key={row} className="border-b border-zinc-100 hover:bg-zinc-50">
                                                        <td className="p-2 font-bold text-zinc-700">{row}</td>
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
                                                                        onInputChange({ target: { name: key, value: newData }});
                                                                    }} className={`w-4 h-4 text-black border-zinc-300 focus:ring-black ${!isRadio && 'rounded-sm'}`} />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : prop.enum ? (
                                    <select
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={onInputChange}
                                        className={`w-full bg-zinc-100 border rounded-sm px-4 py-3 text-[11px] text-black focus:outline-none transition-all appearance-none font-medium ${fieldErrors[key] ? 'border-red-500 focus:border-red-500' : 'border-zinc-300 focus:border-black focus:ring-1 focus:ring-black/20'}`}
                                    >
                                        <option value="" disabled>Select...</option>
                                        {prop.enum.map((opt, i) => <option key={`${opt}_${i}`} value={opt}>{opt}</option>)}
                                    </select>
) : prop['ui:widget'] === 'file' || prop.format === 'file' ? (
    <div className="space-y-4">
        <label 
            className="w-full border border-dashed border-zinc-300 rounded-sm p-6 flex flex-col items-center justify-center gap-3 hover:border-zinc-500 hover:bg-zinc-50 transition-all cursor-pointer"
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
            <Upload className="w-5 h-5 text-zinc-400" />
            <div className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Drag & Drop or Click to Upload</div>
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
                    <div key={i} className="flex items-center justify-between p-2 border border-zinc-200 rounded-sm bg-white shadow-sm">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="text-[10px] font-medium text-black truncate">{f.name}</span>
                        </div>
                        <button type="button" onClick={() => removeFile(i)} className="text-zinc-400 hover:text-red-500 transition-colors ml-2">✕</button>
                    </div>
                ))}
            </div>
        )}
    </div>
                                ) : prop.format === 'textarea' ? (
                                    <textarea
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={onInputChange}
                                        rows={3}
                                        placeholder={prop.description}
                                        className={`w-full bg-zinc-100 border rounded-sm px-4 py-3 text-[11px] text-black focus:outline-none transition-all resize-none placeholder:text-zinc-400 font-light ${fieldErrors[key] ? 'border-red-500 focus:border-red-500' : 'border-zinc-300 focus:border-black focus:ring-1 focus:ring-black/20'}`}
                                    />
                                ) : (
                                    <input
                                        type={prop.format === 'date' ? 'date' : prop.format === 'time' ? 'time' : prop.type === 'number' ? 'number' : 'text'}
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={onInputChange}
                                        placeholder={prop.description}
                                        className={`w-full bg-zinc-100 border rounded-sm px-4 py-3 text-[11px] text-black focus:outline-none transition-all placeholder:text-zinc-400 font-medium ${fieldErrors[key] ? 'border-red-500 focus:border-red-500' : 'border-zinc-300 focus:border-black focus:ring-1 focus:ring-black/20'}`}
                                    />
                                )}
                                </div>
                                {fieldErrors[key] && (
                                    <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                                        <AlertCircle className="w-3 h-3" /> {fieldErrors[key]}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {settings?.allow_attachments && (
                    <div className="pt-6 border-t border-zinc-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">Supporting Assets</span>
                            <span className="text-[8px] font-bold text-zinc-400 uppercase">{files.length} / 5</span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <label 
                                className="w-10 h-10 flex items-center justify-center border border-dashed border-zinc-300 hover:border-zinc-500 rounded-sm bg-zinc-100 cursor-pointer transition-all text-zinc-500 hover:text-zinc-700"
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        handleFileChange({ target: { files: e.dataTransfer.files }}); 
                                    }
                                }}
                            >
                                <Upload className="w-4 h-4" />
                                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                            </label>
                            {files.map((f, i) => (
                                <div key={i} className="h-10 px-3 flex items-center gap-3 bg-white border border-zinc-300 rounded-sm text-[9px] text-zinc-600 group shadow-sm">
                                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                                    <span className="truncate max-w-[100px] font-bold">{f.name}</span>
                                    <button type="button" onClick={() => removeFile(i)} className="text-rose-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="text-[9px] text-rose-600 font-black uppercase tracking-widest flex items-center gap-2 bg-rose-50 p-3 rounded-sm border border-rose-100">
                        <AlertCircle className="w-3.5 h-3.5" /> {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 bg-black text-white rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all shadow-xl shadow-black/10 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    {submitting ? 'Authenticating Submission...' : <><Check className="w-4 h-4" /> Finalize Registry Entry</>}
                </button>
            </form>
            <Modal {...modal} onClose={() => setModal(prev => ({ ...prev, isOpen: false }))} />
        </div>
    );
};

export default InternalForm;
