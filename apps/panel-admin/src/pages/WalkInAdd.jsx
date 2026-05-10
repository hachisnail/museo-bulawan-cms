import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { ArrowLeft, User, MapPin, Briefcase, Calendar, Clock, FileText, CheckCircle2, ChevronRight, Users } from 'lucide-react';

const walkInSchema = yup.object({
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Invalid email').required('Email is required'),
  phone: yup.string().required('Phone is required'),
  organization: yup.string(),
  street: yup.string(),
  province: yup.string().required('Province is required'),
  city: yup.string().required('City is required'),
  barangay: yup.string().required('Barangay is required'),
  purpose: yup.string().required('Purpose is required'),
  populationCount: yup.number().positive().integer().max(30).required('Population is required'),
  visitDate: yup.string().required('Date is required'),
  startTime: yup.string().required('Start time is required'),
  endTime: yup.string().required('End time is required'),
});

export default function WalkInAdd() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, formState: { errors, isValid }, trigger, watch } = useForm({
    resolver: yupResolver(walkInSchema),
    mode: 'onTouched',
    defaultValues: {
      visitDate: new Date().toISOString().split('T')[0],
      purpose: 'Walk-in Visit',
      populationCount: 1,
    }
  });

  const onSubmit = async (data) => {
    setIsLoading(true);
    console.log('Submitting walk-in:', data);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      navigate('/appointments');
    }, 1000);
  };

  const handleNext = async () => {
    const isStep1Valid = await trigger(['firstName', 'lastName', 'email', 'phone', 'province', 'city', 'barangay', 'purpose', 'populationCount']);
    if (isStep1Valid) {
      setStep(2);
    }
  };

  const InputLabel = ({ children, required }) => (
    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-1.5">
      {children} {required && <span className="text-[#D4AF37]">*</span>}
    </label>
  );

  const InputError = ({ error }) => {
    if (!error) return null;
    return <p className="text-[10px] text-red-500 mt-1 uppercase tracking-wider">{error.message}</p>;
  };

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
        
        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 1 ? 'bg-zinc-900 text-[#D4AF37]' : 'bg-green-500 text-white'}`}>
            {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
          </div>
          <div className={`h-px w-8 ${step > 1 ? 'bg-green-500' : 'bg-zinc-200'}`}></div>
          <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${step === 2 ? 'bg-zinc-900 text-[#D4AF37]' : 'bg-zinc-100 text-zinc-400'}`}>
            2
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto pt-6 flex justify-center">
        <div className="w-full max-w-4xl bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden flex flex-col">
          
          <div className="px-8 py-5 border-b border-zinc-100 bg-zinc-50/50 flex items-center gap-3">
            {step === 1 ? <User className="w-5 h-5 text-[#D4AF37]" /> : <Clock className="w-5 h-5 text-[#D4AF37]" />}
            <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-900">
              {step === 1 ? 'Visitor Information' : 'Visit Details'}
            </h2>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 p-8 overflow-y-auto">
            {step === 1 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Personal Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <InputLabel required>First Name</InputLabel>
                    <input {...register('firstName')} className={`w-full border ${errors.firstName ? 'border-red-500 ring-1 ring-red-500/20' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50`} />
                    <InputError error={errors.firstName} />
                  </div>
                  <div>
                    <InputLabel required>Last Name</InputLabel>
                    <input {...register('lastName')} className={`w-full border ${errors.lastName ? 'border-red-500 ring-1 ring-red-500/20' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]`} />
                    <InputError error={errors.lastName} />
                  </div>
                  <div>
                    <InputLabel required>Email Address</InputLabel>
                    <input {...register('email')} type="email" className={`w-full border ${errors.email ? 'border-red-500 ring-1 ring-red-500/20' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]`} />
                    <InputError error={errors.email} />
                  </div>
                  <div>
                    <InputLabel required>Phone Number</InputLabel>
                    <input {...register('phone')} className={`w-full border ${errors.phone ? 'border-red-500 ring-1 ring-red-500/20' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]`} />
                    <InputError error={errors.phone} />
                  </div>
                </div>

                <hr className="border-zinc-100" />

                {/* Address & Organization */}
                <div className="grid grid-cols-3 gap-6">
                  <div className="col-span-3">
                    <InputLabel>Organization (Optional)</InputLabel>
                    <input {...register('organization')} className="w-full border border-zinc-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]" placeholder="e.g. University of the Philippines" />
                  </div>
                  
                  <div>
                    <InputLabel required>Province</InputLabel>
                    <input {...register('province')} className={`w-full border ${errors.province ? 'border-red-500' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]`} />
                    <InputError error={errors.province} />
                  </div>
                  <div>
                    <InputLabel required>City / Municipality</InputLabel>
                    <input {...register('city')} className={`w-full border ${errors.city ? 'border-red-500' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]`} />
                    <InputError error={errors.city} />
                  </div>
                  <div>
                    <InputLabel required>Barangay</InputLabel>
                    <input {...register('barangay')} className={`w-full border ${errors.barangay ? 'border-red-500' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]`} />
                    <InputError error={errors.barangay} />
                  </div>
                </div>

                <hr className="border-zinc-100" />

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <InputLabel required>Purpose of Visit</InputLabel>
                    <select {...register('purpose')} className="w-full border border-zinc-200 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37] appearance-none bg-white">
                      <option value="Walk-in Visit">Walk-in Visit</option>
                      <option value="School Field Trip">School Field Trip</option>
                      <option value="Heritage Research">Heritage Research</option>
                      <option value="Tourism">Tourism</option>
                    </select>
                    <InputError error={errors.purpose} />
                  </div>
                  <div>
                    <InputLabel required>Number of Visitors</InputLabel>
                    <input {...register('populationCount')} type="number" min="1" max="30" className={`w-full border ${errors.populationCount ? 'border-red-500' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37]`} />
                    <InputError error={errors.populationCount} />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-sm text-sm text-[#92750a] flex items-center gap-3 mb-6">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p>Walk-in appointments are automatically approved and will be tracked in today's active schedule.</p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <InputLabel required>Date of Visit</InputLabel>
                    <input {...register('visitDate')} type="date" className={`w-full border ${errors.visitDate ? 'border-red-500' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37] font-mono`} />
                    <InputError error={errors.visitDate} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <InputLabel required>Start Time</InputLabel>
                    <input {...register('startTime')} type="time" className={`w-full border ${errors.startTime ? 'border-red-500' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37] font-mono`} />
                    <InputError error={errors.startTime} />
                  </div>
                  <div>
                    <InputLabel required>End Time</InputLabel>
                    <input {...register('endTime')} type="time" className={`w-full border ${errors.endTime ? 'border-red-500' : 'border-zinc-200'} rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#D4AF37] font-mono`} />
                    <InputError error={errors.endTime} />
                  </div>
                </div>

                {watch('purpose') === 'School Field Trip' && (
                  <div className="p-6 border-2 border-dashed border-zinc-200 rounded-sm flex flex-col items-center justify-center text-center gap-2">
                    <FileText className="w-8 h-8 text-zinc-400" />
                    <h3 className="text-sm font-bold text-zinc-800">Request Letter Upload</h3>
                    <p className="text-xs text-zinc-500">School field trips require a request letter. Please attach it here.</p>
                    <input type="file" className="mt-3 text-xs" />
                  </div>
                )}
              </div>
            )}
            
            {/* Form Actions Footer */}
            <div className="mt-10 pt-6 border-t border-zinc-100 flex items-center justify-between">
              {step === 1 ? (
                <div></div> // Empty div for spacing
              ) : (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-2.5 border border-zinc-200 text-zinc-500 text-[11px] font-bold uppercase tracking-widest rounded-sm hover:border-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  Back
                </button>
              )}
              
              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-8 py-2.5 bg-zinc-900 text-[#D4AF37] text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-[#D4AF37] hover:text-zinc-900 transition-colors shadow-sm"
                >
                  Continue <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isLoading ? 'Processing...' : 'Confirm Walk-in'}
                  {!isLoading && <CheckCircle2 className="w-4 h-4" />}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
