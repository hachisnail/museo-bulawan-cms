import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import FormRenderer from '../../../components/FormRenderer';

export default function WalkInAdd() {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="flex-shrink-0 flex items-center justify-between py-5 border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/appointments')}
            className="p-2 border border-zinc-200 rounded-sm text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl text-black uppercase tracking-widest font-medium">Register Walk-in</h1>
            <p className="text-xs text-zinc-500 mt-1 tracking-wide">Record an unannounced visitor arrival</p>
          </div>
        </div>
      </div>

      {/* Changes made: 
        1. Changed to overflow-y-auto and added padding bottom (pb-12) to ensure the submit button isn't cut off.
        2. Removed 'overflow-hidden' from the white box so dropdowns/date-pickers can bleed outside if needed.
        3. Changed max-w-4xl to max-w-5xl (or 64rem) to better match the wide layout in your screenshot.
        4. Added h-fit and mb-8 to allow the container to size naturally and give space at the bottom.
      */}
      <div className="flex-1 overflow-y-auto pt-6 pb-12 flex justify-center">
        <div className="w-full max-w-5xl bg-white border border-zinc-200 rounded-sm shadow-sm h-fit flex flex-col p-8 md:p-12 mb-8">
          <FormRenderer 
            id="01KQEAAX7RAE9CEYNBV2VF512Q" 
            variant="internal" 
            hideHeader={true}
            className="w-full" /* Forces the internal form to span the full width of the container */
            onSuccess={() => navigate('/appointments')} 
          />
        </div>
      </div>
    </div>
  );
}