import React from 'react';
import { useFormLogic } from './useFormLogic';
import { Check, AlertCircle, FileText, Upload } from 'lucide-react';

const InternalForm = (props) => {
    const { 
        className = "",
        hideHeader = false,
        infoBlock,
    } = props;

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
    } = useFormLogic(props);

    if (loading) return (
        <div className="py-10 text-center flex flex-col items-center justify-center gap-4">
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

    if (!definition) return null;

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

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                    {Object.entries(properties).map(([key, prop]) => {
                        if (!isFieldVisible(key, prop)) return null;
                        if (prop['ui:widget'] === 'hidden') {
                            return <input key={key} type="hidden" name={key} value={formData[key] || ''} />;
                        }

                        const isRequired = required.includes(key);
                        const isFullWidth = prop.type === 'string' && prop.format === 'textarea';

                        return (
                            <div key={key} className={`${isFullWidth ? 'md:col-span-2' : ''} space-y-2`}>
                                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                                    {prop.title || key}
                                    {isRequired && <span className="text-[#D4AF37]">•</span>}
                                </label>

                                {prop.type === 'boolean' ? (
                                    <label className="relative inline-flex items-center cursor-pointer group py-1.5">
                                        <input type="checkbox" name={key} checked={!!formData[key]} onChange={handleInputChange} className="sr-only peer" />
                                        <div className="w-10 h-5 bg-zinc-100 rounded-sm peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-sm after:h-4 after:w-4 after:transition-all peer-checked:bg-black after:peer-checked:bg-[#D4AF37]"></div>
                                        <span className="ml-3 text-[10px] text-zinc-500 group-hover:text-black transition-colors uppercase font-bold tracking-tighter">{prop.description || 'Enable'}</span>
                                    </label>
                                ) : prop.enum ? (
                                    <select
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        className="w-full bg-zinc-100 border border-zinc-300 rounded-sm px-4 py-3 text-[11px] text-black focus:outline-none focus:border-[#D4AF37] transition-all appearance-none font-medium"
                                    >
                                        <option value="" disabled>Select...</option>
                                        {prop.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                    </select>
                                ) : prop.format === 'textarea' ? (
                                    <textarea
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        rows={3}
                                        placeholder={prop.description}
                                        className="w-full bg-zinc-100 border border-zinc-300 rounded-sm px-4 py-3 text-[11px] text-black focus:outline-none focus:border-[#D4AF37] transition-all resize-none placeholder:text-zinc-400 font-light"
                                    />
                                ) : (
                                    <input
                                        type={prop.format === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'}
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        placeholder={prop.description}
                                        className="w-full bg-zinc-100 border border-zinc-300 rounded-sm px-4 py-3 text-[11px] text-black focus:outline-none focus:border-[#D4AF37] transition-all placeholder:text-zinc-400 font-medium"
                                    />
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
                            <label className="w-10 h-10 flex items-center justify-center border border-dashed border-zinc-300 hover:border-[#D4AF37] rounded-sm bg-zinc-100 cursor-pointer transition-all text-zinc-500 hover:text-[#D4AF37]">
                                <Upload className="w-4 h-4" />
                                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                            </label>
                            {files.map((f, i) => (
                                <div key={i} className="h-10 px-3 flex items-center gap-3 bg-white border border-zinc-300 rounded-sm text-[9px] text-zinc-600 group shadow-sm">
                                    <FileText className="w-3.5 h-3.5 text-[#D4AF37]" />
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
                    className="w-full py-4 bg-black text-[#D4AF37] rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all shadow-xl shadow-black/10 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                    {submitting ? 'Authenticating Submission...' : <><Check className="w-4 h-4" /> Finalize Registry Entry</>}
                </button>
            </form>
        </div>
    );
};

export default InternalForm;
