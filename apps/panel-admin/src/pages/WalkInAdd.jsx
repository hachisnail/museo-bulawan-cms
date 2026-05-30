import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import FormRenderer from '../components/FormRenderer';

export default function WalkInAdd() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Page Header */}
      <div className="flex-shrink-0 flex items-center justify-between pb-5 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/appointments')}
            className="p-2 border border-zinc-200 rounded-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Register Walk-in</h1>
            <p className="text-xs text-zinc-500 mt-1 font-light tracking-wide">Record an unannounced visitor arrival</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pt-6 flex justify-center">
        <div className="w-full max-w-4xl bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden flex flex-col p-8">
          <FormRenderer 
            slug="appointment-booking" 
            variant="internal" 
            hideHeader={true}
            onSuccess={() => navigate('/appointments')} 
          />
        </div>
      </div>
    </div>
  );
}
