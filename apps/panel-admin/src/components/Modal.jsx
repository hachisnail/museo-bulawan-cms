import React from 'react';

/**
 * Clean Modal Component for Museo Bulawan CMS
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

    // Adjust title styles based on the variant (matching the reference image)
    const titleStyles = {
        info: 'text-black font-normal',
        success: 'text-[#A3CC39] font-bold uppercase tracking-wider', 
        error: 'text-[#F05A5A] font-bold uppercase tracking-wider',
        warning: 'text-black font-normal'
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-[28rem] rounded-xl shadow-2xl relative p-8 pb-10 animate-in zoom-in-95 duration-200">
                
                {/* Close Button Icon */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-800 transition-colors"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>

                <div className="flex flex-col items-center text-center space-y-4">
                    
                    {/* Title */}
                    {title && (
                        <h3 className={`text-2xl mt-2 ${titleStyles[variant]}`}>
                            {title}
                        </h3>
                    )}

                    {/* Message */}
                    {message && (
                        <p className="text-[15px] text-zinc-600 leading-relaxed max-w-sm">
                            {message}
                        </p>
                    )}

                    {/* Input (Prompt mode) */}
                    {type === 'prompt' && (
                        <div className="w-full mt-4">
                            <input 
                                autoFocus
                                type="text" 
                                value={inputValue} 
                                onChange={(e) => onInputChange(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-300 rounded px-4 py-2 text-sm text-black focus:outline-none focus:border-[#7A40F2] transition-all"
                                placeholder="Enter details..."
                            />
                        </div>
                    )}

                    {children && <div className="w-full">{children}</div>}

                    {/* Buttons */}
                    {(type === 'confirm' || type === 'prompt' || (type === 'alert' && onConfirm)) && (
                        <div className="flex justify-center gap-3 w-full pt-4">
                            <button 
                                onClick={() => {
                                    if (onConfirm) onConfirm(inputValue);
                                    else onClose();
                                }}
                                className="px-6 py-2 bg-[#7A40F2] hover:bg-[#6A30E2] text-white text-sm font-medium rounded transition-colors shadow-sm min-w-[100px]"
                            >
                                {confirmText}
                            </button>
                            
                            {(type === 'confirm' || type === 'prompt') && (
                                <button 
                                    onClick={onClose}
                                    className="px-6 py-2 bg-[#9CA3AF] hover:bg-zinc-500 text-white text-sm font-medium rounded transition-colors shadow-sm min-w-[100px]"
                                >
                                    {cancelText}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}