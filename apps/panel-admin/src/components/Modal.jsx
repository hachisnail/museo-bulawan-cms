import React from 'react';

/**
 * Premium Modal Component for Museo Bulawan CMS
 * 
 * Supports:
 * - Alert (info/success/error)
 * - Confirm (yes/no)
 * - Prompt (input)
 * - Custom children
 */
export default function Modal({ 
    isOpen, 
    onClose, 
    title, 
    message, 
    type = 'alert', // 'alert' | 'confirm' | 'prompt'
    variant = 'info', // 'info' | 'success' | 'error' | 'warning'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm,
    inputValue,
    onInputChange,
    children 
}) {
    if (!isOpen) return null;

    const variantStyles = {
        info: 'bg-indigo-500/10 text-indigo-500',
        success: 'bg-green-500/10 text-green-500',
        error: 'bg-red-500/10 text-red-500',
        warning: 'bg-[#D4AF37]/10 text-[#A68A27]'
    };

    const variantIcons = {
        info: 'ℹ️',
        success: '✓',
        error: '✕',
        warning: '⚠️'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md border border-zinc-200 rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                
                {/* Header Decoration */}
                <div className="h-2 bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent opacity-30" />
                
                <div className="p-8">
                    <div className="flex flex-col items-center text-center space-y-6">
                        
                        {/* Icon */}
                        <div className={`w-16 h-16 rounded-[24px] flex items-center justify-center text-2xl ${variantStyles[variant]}`}>
                            {variantIcons[variant]}
                        </div>

                        {/* Text */}
                        <div className="space-y-2">
                            <h3 className="font-serif text-2xl text-black uppercase tracking-widest leading-tight">{title}</h3>
                            {message && <p className="text-sm text-zinc-500 leading-relaxed font-light">{message}</p>}
                        </div>

                        {/* Input (Prompt mode) */}
                        {type === 'prompt' && (
                            <div className="w-full">
                                <input 
                                    autoFocus
                                    type="text" 
                                    value={inputValue} 
                                    onChange={(e) => onInputChange(e.target.value)}
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-2xl px-6 py-4 text-sm text-black focus:outline-none focus:border-[#D4AF37] transition-all"
                                    placeholder="Enter details..."
                                />
                            </div>
                        )}

                        {children && <div className="w-full">{children}</div>}

                        {/* Buttons */}
                        <div className="flex gap-3 w-full pt-4">
                            {(type === 'confirm' || type === 'prompt') && (
                                <button 
                                    onClick={onClose}
                                    className="flex-1 px-6 py-4 bg-zinc-50 hover:bg-zinc-100 text-zinc-500 text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-2xl"
                                >
                                    {cancelText}
                                </button>
                            )}
                            <button 
                                onClick={() => {
                                    if (onConfirm) onConfirm();
                                    else onClose();
                                }}
                                className="flex-1 px-6 py-4 bg-black hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all rounded-2xl shadow-lg shadow-black/10"
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
