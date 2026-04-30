import React from 'react';
import { useFormLogic } from './useFormLogic';

const InternalForm = (props) => {
    const { 
        className = "",
        hideHeader = false,
        prefillData = {}
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

    if (loading) return <div className="p-8 text-center opacity-50 text-xs">Loading internal system form...</div>;
    if (error && !definition) return <div className="p-8 text-rose-400 text-xs bg-rose-500/5 rounded-2xl border border-rose-500/10">System Error: {error}</div>;
    if (!definition) return null;

    const { schema, settings } = definition;
    const properties = schema?.properties || {};
    const required = schema?.required || [];

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
        <div className={`internal-form-system ${className}`}>
            {!hideHeader && (
                <header className="mb-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                        {definition.title}
                    </h2>
                    {settings?.description && (
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
                            {settings.description}
                        </p>
                    )}
                </header>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                    {Object.entries(properties).map(([key, prop]) => {
                        if (!isFieldVisible(key, prop)) return null;
                        if (prop['ui:widget'] === 'hidden') {
                            return <input key={key} type="hidden" name={key} value={formData[key] || ''} />;
                        }

                        const isRequired = required.includes(key);
                        const isFullWidth = prop.type === 'string' && prop.format === 'textarea';

                        return (
                            <div key={key} className={`${isFullWidth ? 'md:col-span-2' : ''} space-y-1.5`}>
                                <label className="text-[10px] font-bold uppercase text-zinc-500 flex items-center gap-1">
                                    {prop.title || key}
                                    {isRequired && <span className="text-rose-500">*</span>}
                                </label>

                                {prop.type === 'boolean' ? (
                                    <label className="relative inline-flex items-center cursor-pointer group">
                                        <input type="checkbox" name={key} checked={!!formData[key]} onChange={handleInputChange} className="sr-only peer" />
                                        <div className="w-9 h-5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600 after:peer-checked:bg-white"></div>
                                        <span className="ml-3 text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors">{prop.description}</span>
                                    </label>
                                ) : prop.enum ? (
                                    <select
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-all"
                                    >
                                        <option value="" disabled>Select...</option>
                                        {prop.enum.map(opt => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
                                    </select>
                                ) : prop.format === 'textarea' ? (
                                    <textarea
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        rows={3}
                                        placeholder={prop.description}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-all resize-none placeholder:text-zinc-700"
                                    />
                                ) : (
                                    <input
                                        type={prop.format === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'}
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        placeholder={prop.description}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-zinc-700"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {settings?.allow_attachments && (
                    <div className="pt-4 border-t border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase text-zinc-500">Attachments</span>
                            <span className="text-[9px] font-mono text-zinc-600">{files.length} / 5</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <label className="w-12 h-12 flex items-center justify-center border border-dashed border-white/10 hover:border-indigo-500 rounded-xl bg-white/5 cursor-pointer transition-all text-zinc-500 hover:text-indigo-400">
                                <span className="text-xl">+</span>
                                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                            </label>
                            {files.map((f, i) => (
                                <div key={i} className="h-12 px-3 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl text-[10px] text-zinc-400 group">
                                    <span className="truncate max-w-[80px]">{f.name}</span>
                                    <button type="button" onClick={() => removeFile(i)} className="text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {error && <div className="text-[10px] text-rose-500 font-bold bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">⚠️ {error}</div>}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                >
                    {submitting ? 'Processing System Update...' : 'Commit Changes to Database'}
                </button>
            </form>
        </div>
    );
};

export default InternalForm;
