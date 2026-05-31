import { useParams, Link } from 'react-router-dom';
import FormRenderer from '../components/FormRenderer';
import { ArrowLeft, Landmark } from 'lucide-react';

export default function PublicFormViewer() {
    const { slug } = useParams();

    return (
        <div className="min-h-screen bg-[#121212] text-zinc-100 flex flex-col font-sans select-none">
            
            {/* Elegant Public Header */}
            <header className="border-b border-zinc-800 bg-[#1a1a1a]/80 backdrop-blur-md sticky top-0 z-20 py-4 px-6 sm:px-12 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-tr from-amber-500 to-yellow-600 rounded-lg text-black">
                        <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-widest uppercase text-white">Museo Bulawan</h1>
                        <p className="text-[10px] text-amber-500 uppercase tracking-widest font-semibold">External Submissions Portal</p>
                    </div>
                </div>
                
                <Link 
                    to="/login"
                    className="text-xs font-semibold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 px-4 py-2 rounded-full transition-all"
                >
                    Staff Portal
                </Link>
            </header>

            {/* Form Content Wrapper */}
            <main className="flex-1 py-16 px-4 flex justify-center items-center">
                <div className="w-full max-w-4xl">
                    <FormRenderer 
                        slug={slug} 
                        variant="external" 
                        className="bg-transparent"
                    />
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-zinc-900 bg-[#0d0d0d] py-6 text-center text-[10px] text-zinc-600 tracking-wider">
                &copy; {new Date().getFullYear()} MUSEO BULAWAN. ALL RIGHTS RESERVED.
            </footer>
        </div>
    );
}
