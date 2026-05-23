import { useEffect, useRef } from 'react';
import * as docx from 'docx-preview';

export default function DocxPreview({ base64Data }) {
    const containerRef = useRef(null);

    useEffect(() => {
        if (base64Data && containerRef.current) {
            const binaryString = window.atob(base64Data);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            docx.renderAsync(bytes.buffer, containerRef.current, null, {
                className: "docx-preview",
                inWrapper: false,
                ignoreWidth: false,
                ignoreHeight: false,
            })
            .then(x => console.log("docx: finished"))
            .catch(err => console.error("docx-preview error:", err));
        }
    }, [base64Data]);

    return (
        <div className="border border-zinc-200 rounded-sm overflow-hidden bg-white">
            <div 
                ref={containerRef} 
                className="docx-container"
                style={{ 
                    height: '500px', 
                    overflowY: 'auto', 
                    padding: '20px',
                    backgroundColor: '#f4f4f5'
                }}
            />
            <style>{`
                .docx-preview {
                    background: white;
                    padding: 40px !important;
                    margin: 0 auto;
                    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
                    max-width: 800px;
                    font-family: 'Times New Roman', serif;
                }
                .docx-container::-webkit-scrollbar {
                    width: 6px;
                }
                .docx-container::-webkit-scrollbar-thumb {
                    background: #d4d4d8;
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
}
