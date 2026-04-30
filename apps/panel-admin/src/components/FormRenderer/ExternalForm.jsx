import React from 'react';
import { useFormLogic } from './useFormLogic';

const ExternalForm = (props) => {
    const { 
        className = "",
        hideHeader = false
    } = props;

    const {
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
    } = useFormLogic(props);

    if (loading) return <div className="p-20 text-center opacity-50 text-indigo-400 animate-pulse">Initializing Secure Form Interface...</div>;
    if (error && !definition) return (
        <div className="p-10 text-center bg-rose-500/10 rounded-3xl border border-rose-500/20 max-w-2xl mx-auto">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold text-rose-500 mb-2">Form Access Error</h3>
            <p className="text-zinc-400">{error}</p>
        </div>
    );
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
        <div className={`external-form-public glass-panel rounded-[2rem] border border-white/10 shadow-2xl p-6 md:p-12 overflow-hidden relative ${className}`}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2"></div>
            
            {!hideHeader && (
                <header className="mb-12 text-center md:text-left relative z-10">
                    <div className="inline-block px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-4">
                        Official Submission Portal
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4">{definition.title}</h2>
                    {settings?.description && (
                        <p className="text-lg text-zinc-400 max-w-2xl leading-relaxed">
                            {settings.description}
                        </p>
                    )}
                </header>
            )}

            <form onSubmit={handleSubmit} className="space-y-10 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                    {Object.entries(properties).map(([key, prop]) => {
                        if (!isFieldVisible(key, prop)) return null;
                        if (prop['ui:widget'] === 'hidden') {
                            return <input key={key} type="hidden" name={key} value={formData[key] || ''} />;
                        }

                        const isRequired = required.includes(key);
                        const isFullWidth = (prop.type === 'string' && prop.format === 'textarea') || settings?.layout === 'single_column';

                        return (
                            <div key={key} className={`${isFullWidth ? 'md:col-span-2' : ''} flex flex-col group`}>
                                <label className="flex items-center gap-2 font-bold text-sm mb-3 text-zinc-300 group-focus-within:text-indigo-400 transition-colors">
                                    {prop.title || key}
                                    {isRequired && <span className="text-rose-500">*</span>}
                                </label>

                                {prop.type === 'boolean' ? (
                                    <label className="relative inline-flex items-center cursor-pointer group/toggle mt-2">
                                        <input type="checkbox" name={key} checked={!!formData[key]} onChange={handleInputChange} className="sr-only peer" />
                                        <div className="w-12 h-7 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-zinc-500 after:rounded-full after:h-[1.35rem] after:w-[1.35rem] after:transition-all peer-checked:bg-indigo-600 after:peer-checked:bg-white shadow-inner"></div>
                                        <span className="ml-4 text-sm text-zinc-400 group-hover/toggle:text-zinc-200 transition-colors">{prop.description || 'Confirm and Proceed'}</span>
                                    </label>
                                ) : prop.enum ? (
                                    <div className="relative">
                                        <select
                                            name={key}
                                            required={isRequired}
                                            value={formData[key] || ''}
                                            onChange={handleInputChange}
                                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all appearance-none cursor-pointer hover:bg-white/10"
                                        >
                                            <option value="" disabled>Please select an option...</option>
                                            {prop.enum.map(opt => <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>)}
                                        </select>
                                        <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-500">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                ) : prop.format === 'textarea' ? (
                                    <textarea
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        rows={5}
                                        placeholder={prop.description}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all resize-none placeholder:text-zinc-600 hover:bg-white/10"
                                    />
                                ) : (
                                    <input
                                        type={prop.format === 'email' ? 'email' : prop.format === 'date' ? 'date' : prop.type === 'number' ? 'number' : 'text'}
                                        name={key}
                                        required={isRequired}
                                        value={formData[key] || ''}
                                        onChange={handleInputChange}
                                        placeholder={prop.description}
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-zinc-600 hover:bg-white/10"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {settings?.allow_attachments && (
                    <div className="pt-10 border-t border-white/5">
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-white mb-2">Supporting Media</h3>
                            <p className="text-zinc-500">Please provide up to 5 relevant files (Max 15MB each).</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="md:col-span-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 hover:border-indigo-500/50 bg-white/5 rounded-[1.5rem] p-8 transition-all cursor-pointer group/upload">
                                <div className="w-12 h-12 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover/upload:scale-110 transition-transform mb-3">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                </div>
                                <span className="text-sm font-bold text-zinc-400 group-hover/upload:text-white transition-colors">Add Files</span>
                                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                            </label>
                            <div className="md:col-span-2 flex flex-wrap gap-3">
                                {files.map((f, i) => (
                                    <div key={i} className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-xs text-zinc-300 animate-in zoom-in-95 duration-200">
                                        <span className="opacity-40 text-lg">📄</span>
                                        <div className="flex flex-col">
                                            <span className="font-bold truncate max-w-[150px]">{f.name}</span>
                                            <span className="text-[10px] text-zinc-500 font-mono">{(f.size/1024).toFixed(1)} KB</span>
                                        </div>
                                        <button type="button" onClick={() => removeFile(i)} className="ml-2 text-rose-500 hover:scale-125 transition-transform text-lg">×</button>
                                    </div>
                                ))}
                                {files.length === 0 && (
                                    <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm italic border border-white/5 rounded-2xl bg-black/20">
                                        No files attached yet.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {definition.otp && (
                    <div className="pt-10 border-t border-white/5">
                        {!otpSent ? (
                            <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="text-center md:text-left">
                                    <h4 className="text-lg font-bold text-indigo-300 mb-1">Verify Your Identity</h4>
                                    <p className="text-zinc-400 text-sm">We'll send a 6-digit code to the email address above to authenticate your submission.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRequestOtp}
                                    disabled={otpLoading}
                                    className="whitespace-nowrap px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50"
                                >
                                    {otpLoading ? 'Sending...' : 'Receive Code'}
                                </button>
                            </div>
                        ) : (
                            <div className="bg-green-600/10 border border-green-500/20 rounded-3xl p-8 text-center animate-in slide-in-from-top-4 duration-500">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-400 mb-4">✓</div>
                                <h4 className="text-xl font-bold text-green-400 mb-2">Check Your Email</h4>
                                <p className="text-zinc-400 text-sm mb-6">Enter the verification code sent to <strong>{otpEmail}</strong></p>
                                <div className="flex flex-col items-center gap-4">
                                    <input
                                        type="text"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full max-w-[320px] bg-black/40 border-2 border-green-500/30 rounded-2xl px-6 py-5 text-center text-4xl tracking-[0.5em] font-black text-white focus:outline-none focus:border-green-500 transition-all shadow-[0_0_40px_rgba(34,197,94,0.1)]"
                                    />
                                    <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Entered wrong email? Change it here.</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-4 rounded-2xl text-sm font-bold flex items-center gap-4 animate-in shake-in duration-300">
                        <span className="text-2xl">🚨</span>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting || (definition.otp && otpSent && !otp)}
                    className="w-full h-20 bg-gradient-to-br from-indigo-600 to-violet-700 hover:from-indigo-500 hover:to-violet-600 text-white font-black uppercase tracking-[0.2em] rounded-3xl transition-all shadow-[0_15px_40px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:grayscale group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="relative z-10 flex items-center justify-center gap-4 text-sm">
                        {submitting ? 'Transmitting Data...' : 'Finalize Submission'}
                        {!submitting && <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
                    </span>
                </button>
            </form>
        </div>
    );
};

export default ExternalForm;
