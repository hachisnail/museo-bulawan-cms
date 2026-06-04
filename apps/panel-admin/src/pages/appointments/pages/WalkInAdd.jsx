import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Check, AlertCircle, Upload, FileText } from 'lucide-react';
import { useAuth } from '../../../context/authContext';
import { useFormLogic } from '../../../components/FormRenderer/useFormLogic';
import PHAddressSelect from '../../../components/PHAddressSelect';
import { validateAppointmentBooking } from '../../../utils/scheduleValidation';

const FORM_ID = '01KQEAAX7RAE9CEYNBV2VF512Q';
const PURPOSES = ['Walk-in Visit', 'School Field Trip', 'Heritage Research', 'Tourism'];
const REQUIRED_FIELDS = [
  'firstName', 'lastName', 'email', 'phone',
  'province', 'city',
  'purpose', 'populationCount', 'visitDate', 'startTime', 'endTime',
];

const today = new Date().toISOString().split('T')[0];

export default function WalkInAdd() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [address, setAddress] = useState({ province: null, city: null, barangay: null });
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Schedule-aware fetch interceptor ──────────────────────────────────────────
  // Validates the chosen visitDate against existing schedules before submitting.
  // Mirrors the interceptor in FormRenderer/index.jsx so WalkInAdd gets the same
  // conflict detection without touching the shared InternalForm module.
  const appointmentAwareFetch = async (url, options = {}) => {
    const isSubmit =
      options?.method === 'POST' &&
      typeof url === 'string' &&
      url.endsWith('/submit');

    if (isSubmit && options?.body instanceof FormData) {
      try {
        const raw = options.body.get('data');
        const submitted = raw ? JSON.parse(raw) : {};
        const visitDate = submitted.visitDate;

        if (visitDate) {
          const startTime = submitted.startTime || null;
          const endTime = submitted.endTime || null;

          const schRes = await apiFetch(`/api/v1/schedules?date=${visitDate}`);
          if (schRes.ok) {
            const rawSchedules = await schRes.json();
            const dayEvents = rawSchedules.map((s) => ({
              date: s.date?.split('T')[0],
              startTime: s.start_time?.substring(0, 5) || '00:00',
              endTime: s.end_time?.substring(0, 5) || '23:59',
              availability: s.availability || 'SHARED',
              isSchedule: true,
              title: s.title,
            }));

            const result = validateAppointmentBooking(
              { date: visitDate, startTime, endTime, isFlexibleTime: !startTime && !endTime },
              dayEvents
            );

            if (!result.isValid) {
              return new Response(
                JSON.stringify({ error: result.error }),
                { status: 422, headers: { 'Content-Type': 'application/json' } }
              );
            }
          }
        }
      } catch {
        // Schedule API unreachable — let server decide.
      }
    }

    return apiFetch(url, options);
  };

  // ── Form logic (shared hook — same as InternalForm uses internally) ───────────
  const {
    formData,
    files,
    loading,
    submitting,
    error,
    handleInputChange,
    handleFileChange,
    removeFile,
    handleSubmit,
  } = useFormLogic({
    id: FORM_ID,
    customFetch: appointmentAwareFetch,
    prefillData: { visitDate: today },   // default walk-in date = today
    onSuccess: () => setSubmitted(true),
    onError: () => {},
  });

  // ── Field helpers ─────────────────────────────────────────────────────────────

  const onInputChange = (e) => {
    const name = e?.target?.name;
    if (name && fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
    handleInputChange(e);
  };

  const handleAddressChange = (newAddr) => {
    setAddress(newAddr);
    setFieldErrors((prev) => ({ ...prev, province: null, city: null, barangay: null }));
    handleInputChange({ target: { name: 'province', value: newAddr.province?.name ?? '' } });
    handleInputChange({ target: { name: 'city',     value: newAddr.city?.name     ?? '' } });
    handleInputChange({ target: { name: 'barangay', value: newAddr.barangay?.name ?? '' } });
  };

  // ── Client-side validation before submit ──────────────────────────────────────

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    REQUIRED_FIELDS.forEach((key) => {
      const val = formData[key];
      if (val === undefined || val === null || String(val).trim() === '') {
        errors[key] = 'This field is required';
      }
    });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    handleSubmit(e);
  };

  // ── Styling helpers (mirrors InternalForm field styles) ───────────────────────

  const inputCls = (key) =>
    `w-full bg-zinc-100 border rounded-sm px-4 py-3 text-[11px] text-black focus:outline-none transition-all placeholder:text-zinc-400 font-medium ${
      fieldErrors[key]
        ? 'border-red-500 focus:border-red-500'
        : 'border-zinc-300 focus:border-[#D4AF37]'
    }`;

  const Label = ({ htmlFor, required: req, children }) => (
    <label htmlFor={htmlFor} className="text-[9px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
      {children}
      {req && <span className="text-[#D4AF37]">•</span>}
    </label>
  );

  const FieldError = ({ name }) =>
    fieldErrors[name] ? (
      <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
        <AlertCircle className="w-3 h-3" /> {fieldErrors[name]}
      </p>
    ) : null;

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-black rounded-full animate-spin" />
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-300">
            Retrieving Schema…
          </div>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-6 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-serif text-zinc-900 uppercase tracking-widest">
              Walk-in Registered
            </h2>
            <p className="text-sm text-zinc-500 mt-2 leading-relaxed">
              The visitor has been successfully registered as an approved appointment.
            </p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => {
                setSubmitted(false);
                setAddress({ province: null, city: null, barangay: null });
                setFieldErrors({});
              }}
              className="px-5 py-2.5 border border-zinc-200 text-[11px] font-bold uppercase tracking-widest text-zinc-600 rounded-sm hover:bg-zinc-50 transition-colors"
            >
              Register Another
            </button>
            <button
              onClick={() => navigate('/appointments')}
              className="px-5 py-2.5 bg-zinc-900 text-white text-[11px] font-bold uppercase tracking-widest rounded-sm hover:bg-[#D4AF37] hover:text-zinc-900 transition-colors"
            >
              View Appointments
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────────

  const addressError = fieldErrors.province || fieldErrors.city;

  return (
    <div className="flex flex-col gap-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

      {/* Page Header */}
      <section className="flex items-start border-b border-gray-100 pb-4">
        <div className="flex-1">
          <button
            onClick={() => navigate('/appointments')}
            className="text-xs text-zinc-500 hover:text-black transition-colors flex items-center gap-2 mb-4 font-bold uppercase tracking-widest"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Appointments
          </button>
          <div>
            <h1 className="text-3xl font-bold text-black tracking-tight">Register Walk-in</h1>
            <p className="text-sm text-gray-500 mt-1">Record an unannounced visitor arrival</p>
          </div>
        </div>
      </section>

      <div className="bg-white border border-zinc-200 rounded-sm shadow-sm p-8 md:p-12">
          <form onSubmit={handleFormSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">

              {/* ── Visitor Info ───────────────────────────────────────────── */}

              <div className="space-y-2">
                <Label required>First Name</Label>
                <input
                  type="text" name="firstName"
                  value={formData.firstName || ''}
                  onChange={onInputChange}
                  placeholder="Juan"
                  className={inputCls('firstName')}
                />
                <FieldError name="firstName" />
              </div>

              <div className="space-y-2">
                <Label required>Last Name</Label>
                <input
                  type="text" name="lastName"
                  value={formData.lastName || ''}
                  onChange={onInputChange}
                  placeholder="Dela Cruz"
                  className={inputCls('lastName')}
                />
                <FieldError name="lastName" />
              </div>

              <div className="space-y-2">
                <Label required>Email Address</Label>
                <input
                  type="email" name="email"
                  value={formData.email || ''}
                  onChange={onInputChange}
                  placeholder="email@example.com"
                  className={inputCls('email')}
                />
                <FieldError name="email" />
              </div>

              <div className="space-y-2">
                <Label required>Phone Number</Label>
                <input
                  type="text" name="phone"
                  value={formData.phone || ''}
                  onChange={onInputChange}
                  placeholder="09XX XXX XXXX"
                  className={inputCls('phone')}
                />
                <FieldError name="phone" />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label>
                  Organization
                  <span className="text-zinc-400 font-medium normal-case text-[9px]">(optional)</span>
                </Label>
                <input
                  type="text" name="organization"
                  value={formData.organization || ''}
                  onChange={onInputChange}
                  placeholder="School, company, or institution"
                  className={inputCls('organization')}
                />
              </div>

              {/* ── Philippine Address ─────────────────────────────────────── */}

              <div className="md:col-span-2 space-y-2">
                <PHAddressSelect
                  value={address}
                  onChange={handleAddressChange}
                  required
                />
                {addressError && (
                  <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" /> Province and City / Municipality are required
                  </p>
                )}
              </div>

              {/* ── Visit Details ──────────────────────────────────────────── */}

              <div className="space-y-2">
                <Label required>Purpose of Visit</Label>
                <select
                  name="purpose"
                  value={formData.purpose || ''}
                  onChange={onInputChange}
                  className={`${inputCls('purpose')} appearance-none`}
                >
                  <option value="" disabled>Select…</option>
                  {PURPOSES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <FieldError name="purpose" />
              </div>

              <div className="space-y-2">
                <Label required>Number of Visitors</Label>
                <input
                  type="number" name="populationCount"
                  min="1" max="30"
                  value={formData.populationCount || ''}
                  onChange={onInputChange}
                  placeholder="1"
                  className={inputCls('populationCount')}
                />
                <FieldError name="populationCount" />
              </div>

              <div className="space-y-2">
                <Label required>Date of Visit</Label>
                <input
                  type="date" name="visitDate"
                  value={formData.visitDate || ''}
                  onChange={onInputChange}
                  className={inputCls('visitDate')}
                />
                <FieldError name="visitDate" />
              </div>

              {/* spacer to push start/end time to their own row on md+ */}
              <div className="hidden md:block" />

              <div className="space-y-2">
                <Label required>Start Time</Label>
                <input
                  type="time" name="startTime"
                  value={formData.startTime || ''}
                  onChange={onInputChange}
                  className={inputCls('startTime')}
                />
                <FieldError name="startTime" />
              </div>

              <div className="space-y-2">
                <Label required>End Time</Label>
                <input
                  type="time" name="endTime"
                  value={formData.endTime || ''}
                  onChange={onInputChange}
                  className={inputCls('endTime')}
                />
                <FieldError name="endTime" />
              </div>

            </div>

            {/* ── Supporting Documents (optional) ──────────────────────────── */}

            <div className="pt-2 border-t border-zinc-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">
                  Supporting Documents
                </span>
                <span className="text-[8px] font-bold text-zinc-400 uppercase">
                  {files.length} / 5 — Optional
                </span>
              </div>

              <label
                className="w-full border border-dashed border-zinc-300 rounded-sm p-5 flex flex-col items-center justify-center gap-2 hover:border-[#D4AF37] hover:bg-zinc-50 transition-all cursor-pointer"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files?.length) {
                    handleFileChange({ target: { files: e.dataTransfer.files } });
                  }
                }}
              >
                <Upload className="w-4 h-4 text-zinc-400" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  Drag & drop or click to upload
                </span>
                <input type="file" multiple onChange={handleFileChange} className="hidden" />
              </label>

              {files.length > 0 && (
                <div className="grid grid-cols-1 gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border border-zinc-200 rounded-sm bg-white shadow-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                        <span className="text-[10px] font-medium text-black truncate">{f.name}</span>
                        <span className="text-[9px] text-zinc-400 shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-zinc-400 hover:text-red-500 transition-colors ml-2 shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── API Error ─────────────────────────────────────────────────── */}

            {error && (
              <div className="text-[9px] text-rose-600 font-black uppercase tracking-widest flex items-center gap-2 bg-rose-50 p-3 rounded-sm border border-rose-100">
                <AlertCircle className="w-3.5 h-3.5" /> {error}
              </div>
            )}

            {/* ── Submit ────────────────────────────────────────────────────── */}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 bg-black text-[#D4AF37] rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-zinc-900 transition-all shadow-xl shadow-black/10 disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {submitting
                ? 'Registering…'
                : <><Check className="w-4 h-4" /> Register Walk-in</>}
            </button>
          </form>
      </div>
    </div>
  );
}
