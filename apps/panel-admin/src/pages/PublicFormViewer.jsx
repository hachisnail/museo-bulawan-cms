import { useParams } from 'react-router-dom';
import FormRenderer from '../components/FormRenderer';
import { useEffect, useRef } from 'react';

export default function PublicFormViewer() {
    const { id } = useParams();
    const containerRef = useRef(null);

    useEffect(() => {
        // Function to report the current height to the parent window
        const reportHeight = () => {
            if (containerRef.current) {
                const height = containerRef.current.scrollHeight;
                window.parent.postMessage({ type: 'form-resize', height }, '*');
            }
        };

        // Observe changes to the form's size (e.g., expanding fields, error messages)
        const observer = new ResizeObserver(() => reportHeight());
        
        if (containerRef.current) {
            observer.observe(containerRef.current);
            reportHeight(); // Initial check
        }

        return () => observer.disconnect();
    }, []);

    return (
        // Changed min-h-screen to h-auto. Added bg-transparent for clean embedding.
        <div ref={containerRef} className="h-auto w-full bg-transparent flex items-center justify-center p-0 overflow-hidden">
            <main className="w-full h-auto flex items-center justify-center">
                <FormRenderer 
                    id={id} 
                    variant="external" 
                    className="w-full h-auto"
                />
            </main>
        </div>
    );
}