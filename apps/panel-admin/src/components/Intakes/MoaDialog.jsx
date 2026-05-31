import { useState, useEffect, useRef } from 'react';
import DocxPreview from '../DocxPreview';

export default function MoaDialog({
    moaDraft,
    onClose,
    apiFetch,
    setModal,
    fetchData,
    setSelected
}) {
    const [scanActive, setScanActive] = useState(false);
    const [verifyToken, setVerifyToken] = useState('');
    const [verifyResult, setVerifyResult] = useState(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const scannerRef = useRef(null);

    // Dynamic scanner logic
    useEffect(() => {
        let isCurrent = true;
        
        const initScanner = () => {
            if (!document.getElementById("qr-reader")) {
                setTimeout(initScanner, 50);
                return;
            }
            if (window.Html5Qrcode && isCurrent) {
                try {
                    const html5Qrcode = new window.Html5Qrcode("qr-reader");
                    scannerRef.current = html5Qrcode;
                    html5Qrcode.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 }
                        },
                        async (decodedText) => {
                            const cleanToken = decodedText.trim().toUpperCase();
                            setVerifyToken(cleanToken);
                            setScanActive(false);
                            
                            if (cleanToken.length === 8) {
                                setIsVerifying(true);
                                try {
                                    const res = await apiFetch(`/api/v1/acquisitions/delivery/verify/${cleanToken}`);
                                    const json = await res.json();
                                    if (res.ok) setVerifyResult(json.data);
                                } catch (e) {
                                    console.error("Scanner verify fetch failed", e);
                                } finally {
                                    setIsVerifying(false);
                                }
                            }
                        },
                        () => {} // Silent scan error
                    ).catch(err => {
                        console.error("Failed to start QR scanner:", err);
                        setScanActive(false);
                    });
                } catch (e) {
                    console.error("Error setting up Html5Qrcode:", e);
                    setScanActive(false);
                }
            }
        };

        if (scanActive && moaDraft?.isVerifyModal) {
            if (!window.Html5Qrcode) {
                const existingScript = document.getElementById('html5-qrcode-script');
                if (!existingScript) {
                    const script = document.createElement('script');
                    script.id = 'html5-qrcode-script';
                    script.src = "https://unpkg.com/html5-qrcode";
                    script.onload = initScanner;
                    document.body.appendChild(script);
                } else {
                    const checkInterval = setInterval(() => {
                        if (window.Html5Qrcode) {
                            clearInterval(checkInterval);
                            initScanner();
                        }
                    }, 100);
                }
            } else {
                initScanner();
            }
        } else {
            if (scannerRef.current) {
                const currentScanner = scannerRef.current;
                if (currentScanner.isScanning) {
                    currentScanner.stop().catch(() => {});
                }
                scannerRef.current = null;
            }
        }

        return () => {
            isCurrent = false;
            if (scannerRef.current) {
                const currentScanner = scannerRef.current;
                if (currentScanner.isScanning) {
                    currentScanner.stop().catch(() => {});
                }
                scannerRef.current = null;
            }
        };
    }, [scanActive, moaDraft, apiFetch]);

    const handleVerifyToken = async (e) => {
        if (e) e.preventDefault();
        setIsVerifying(true); 
        setVerifyResult(null);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/delivery/verify/${verifyToken}`);
            const json = await res.json();
            if (res.ok) {
                setVerifyResult(json.data);
            } else {
                setModal({ 
                    isOpen: true, 
                    title: 'Verification Failed', 
                    message: json.error || 'Invalid code.', 
                    type: 'alert', 
                    variant: 'error' 
                });
            }
        } catch (err) {
            setModal({ 
                isOpen: true, 
                title: 'Verification Failed', 
                message: 'Verification failed.', 
                type: 'alert', 
                variant: 'error' 
            });
        } finally {
            setIsVerifying(false);
        }
    };

    const confirmVerifiedDelivery = async () => {
        if (!verifyResult) return;
        setActionLoading(true);
        try {
            const res = await apiFetch(`/api/v1/acquisitions/intakes/${verifyResult.id}/confirm-delivery`, {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ token: verifyToken })
            });
            if (res.ok) {
                setVerifyResult(null); 
                setVerifyToken(''); 
                onClose();
                fetchData();
            } else {
                const json = await res.json(); 
                setModal({ 
                    isOpen: true, 
                    title: 'Error', 
                    message: json.error || 'Failed to confirm.', 
                    type: 'alert', 
                    variant: 'error' 
                });
            }
        } catch (err) {
            setModal({ 
                isOpen: true, 
                title: 'Error', 
                message: 'Request failed.', 
                type: 'alert', 
                variant: 'error' 
            });
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
            <div className={`bg-white w-full ${moaDraft.docxData ? 'max-w-4xl' : 'max-w-xl'} border border-zinc-200 rounded-sm shadow-2xl flex flex-col max-h-[90vh]`}>
                
                <div className="p-6 border-b border-zinc-200 flex justify-between items-center bg-zinc-50">
                    <h3 className="font-serif text-xl text-black tracking-wide">
                        {moaDraft.isVerifyModal ? 'Delivery Verification' : 'Legal Documentation'}
                    </h3>
                    <button 
                        onClick={() => {
                            setScanActive(false);
                            setVerifyToken('');
                            setVerifyResult(null);
                            onClose();
                            fetchData();
                        }} 
                        className="text-zinc-400 hover:text-black"
                    >
                        ✕
                    </button>
                </div>
                
                <div className="p-8 overflow-y-auto">
                    {moaDraft.isVerifyModal ? (
                        <div className="space-y-6">
                            <p className="text-sm text-zinc-500">Ask the donor for the 8-character verification code printed on their delivery slip, or scan the QR code from their portal.</p>
                            
                            {scanActive && (
                                 <div className="relative border border-zinc-300 rounded-sm bg-black overflow-hidden aspect-square max-w-sm mx-auto mb-4">
                                     <div id="qr-reader" className="w-full h-full"></div>
                                 </div>
                            )}
                            
                            <div className="flex justify-center">
                                 <button 
                                     type="button" 
                                     onClick={() => setScanActive(!scanActive)} 
                                     className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-sm transition-all cursor-pointer ${scanActive ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100' : 'border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'}`}
                                 >
                                     {scanActive ? 'Stop Camera' : 'Scan QR Code'}
                                 </button>
                            </div>

                            <form onSubmit={handleVerifyToken} className="flex gap-3">
                                <input 
                                    type="text" 
                                    required 
                                    value={verifyToken} 
                                    onChange={(e) => setVerifyToken(e.target.value)}
                                    className="flex-1 border border-zinc-300 rounded-sm px-4 py-3 text-lg font-mono text-black focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] uppercase tracking-widest"
                                    placeholder="ENTER CODE"
                                />
                                <button type="submit" disabled={isVerifying} className="bg-black hover:bg-zinc-800 text-white px-8 rounded-sm font-bold uppercase tracking-widest text-xs disabled:opacity-50">
                                    {isVerifying ? 'Checking' : 'Verify'}
                                </button>
                            </form>

                            {verifyResult && (
                                <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-6 space-y-6 mt-6">
                                    <div>
                                        <h4 className="font-bold text-lg text-black">{verifyResult.proposed_item_name}</h4>
                                        <p className="text-sm text-zinc-500">Donor: {verifyResult.donor_info}</p>
                                    </div>
                                    <button 
                                        onClick={confirmVerifiedDelivery} 
                                        disabled={actionLoading}
                                        className="w-full bg-black hover:bg-zinc-800 text-[#D4AF37] font-bold py-4 rounded-sm uppercase tracking-widest text-xs transition-colors disabled:opacity-50"
                                    >
                                        Confirm Physical Receipt
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex flex-col lg:flex-row gap-8">
                                {moaDraft.docxData && (
                                    <div className="flex-1">
                                        <label className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 block mb-3">Document Preview (Template Based)</label>
                                        <DocxPreview base64Data={moaDraft.docxData} />
                                    </div>
                                )}

                                <div className={`w-full ${moaDraft.docxData ? 'lg:w-80' : ''} space-y-6`}>
                                    <div className="w-16 h-16 mx-auto bg-green-50 text-green-600 rounded-full flex items-center justify-center">
                                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                    <div className="text-center">
                                        <h4 className="text-xl font-serif text-black mb-2">Documents Generated</h4>
                                        <p className="text-sm text-zinc-500">The Deed of Gift and Delivery Slip have been sent to the donor.</p>
                                    </div>

                                    <button 
                                        onClick={() => {
                                            onClose();
                                            fetchData();
                                            setSelected(null);
                                        }} 
                                        className="w-full bg-black hover:bg-zinc-800 text-[#D4AF37] font-bold py-4 rounded-sm uppercase tracking-widest text-xs transition-colors cursor-pointer"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
