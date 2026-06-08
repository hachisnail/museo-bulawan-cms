import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, Users, Ban,
  CheckCircle2, AlertTriangle, Loader2, Trash2, CalendarDays,
  Plus, Shield, Share2, Info,
} from 'lucide-react';
import MiniCal from '../../../components/MiniCal';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import { getLocalDateString, formatTimeTo12H, normalizeSchedule, normalizeAppointment } from '../../../utils/scheduleUtils';
import { validateScheduleCreation, validateDateDisabling } from '../../../utils/scheduleValidation';

const GOLD = '#D4AF37';

const INP = 'w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:border-zinc-400 transition-colors placeholder:text-zinc-400';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const isErr  = type === 'error';
  const isWarn = type === 'warning';
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold border backdrop-blur-sm
      ${isErr ? 'bg-red-500 text-white border-red-600' : isWarn ? 'bg-amber-500 text-white border-amber-600' : 'bg-zinc-900 text-white border-zinc-700'}`}>
      {isErr || isWarn ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 opacity-70" />}
      {msg}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, children, onConfirm, onCancel, confirmDisabled, confirmLabel = 'Confirm', danger }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white border border-zinc-200 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm text-zinc-600 leading-relaxed space-y-3">{children}</div>
        <div className="px-6 py-4 bg-zinc-50 flex gap-3 justify-end border-t border-zinc-100">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm
              ${danger ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ open, event, onConfirm, onCancel }) {
  if (!open || !event) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white border border-zinc-200 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900">Delete Schedule</h3>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm text-zinc-600">
          <p className="text-zinc-500">This action cannot be undone.</p>
          <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100">
            <p className="font-bold text-rose-900 text-sm">{event.title}</p>
            <p className="text-xs text-rose-600 mt-1 font-mono">
              {event.isDisabledDay ? 'All Day (Closed)' : `${formatTimeTo12H(event.startTime)} – ${formatTimeTo12H(event.endTime)}`}
            </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-zinc-50 flex gap-3 justify-end border-t border-zinc-100">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-5 py-2.5 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-rose-600 transition-all shadow-sm">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────
function Row({ k, v, muted }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-zinc-400 font-bold uppercase tracking-widest w-16 flex-shrink-0">{k}</span>
      <span className={muted ? 'text-zinc-500' : 'text-zinc-800 font-semibold'}>{v}</span>
    </div>
  );
}

// ─── Day timeline event row ───────────────────────────────────────────────────
function DayEventRow({ ev, onDelete }) {
  const isAppt    = ev.isAppointment;
  const isDisabled = ev.isDisabledDay;
  const isExcl    = ev.availability === 'EXCLUSIVE' && !isDisabled;

  const dotColor = isDisabled ? '#f43f5e' : isAppt ? '#6366f1' : isExcl ? '#fb923c' : '#3f3f46';
  const timeStr  = isDisabled ? 'All Day' : ev.hasFlexibleTime
    ? 'Flexible'
    : `${formatTimeTo12H(ev.startTime)} – ${formatTimeTo12H(ev.endTime)}`;

  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5 group hover:bg-zinc-50/80 transition-colors">
      <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-1">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-zinc-800 truncate leading-tight">
          {isAppt ? ev.organizer : ev.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] font-mono text-zinc-400 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            {timeStr}
          </span>
          {isAppt && ev.numPeople != null && (
            <span className="text-[9px] text-zinc-400 flex items-center gap-0.5">
              <Users className="w-2.5 h-2.5" />{ev.numPeople}
            </span>
          )}
        </div>
      </div>
      {ev.isSchedule && onDelete && (
        <button
          onClick={() => onDelete(ev)}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScheduleAdd() {
  const navigate     = useNavigate();
  const { apiFetch } = useAuth();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mode, setMode]                 = useState('add');
  const [closeType, setCloseType]       = useState('day');
  const [availability, setAvailability] = useState('SHARED');

  const [title, setTitle]         = useState('');
  const [desc, setDesc]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');

  const [reason, setReason]                 = useState('');
  const [closeTitle, setCloseTitle]         = useState('');
  const [closeStartTime, setCloseStartTime] = useState('');
  const [closeEndTime, setCloseEndTime]     = useState('');

  const [showAddConfirm, setShowAddConfirm]     = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [deletingEvent, setDeletingEvent]       = useState(null);
  const [countdown, setCountdown]               = useState(5);
  const [canConfirm, setCanConfirm]             = useState(false);
  const [isLoading, setIsLoading]               = useState(false);
  const [isDeleting, setIsDeleting]             = useState(false);
  const [toast, setToast]                       = useState({ msg: '', type: 'success' });

  const [daySchedules, setDaySchedules]       = useState([]);
  const [dayAppointments, setDayAppointments] = useState([]);
  const [allSchedules, setAllSchedules]       = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'success' }), 3500);
  }, []);

  const dateStr   = getLocalDateString(selectedDate);
  const dateLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // ── SSE ───────────────────────────────────────────────────────────────────────
  const { events: sseEvents } = useSSE('*');
  useEffect(() => {
    if (!sseEvents.length) return;
    const res = sseEvents[0]?.resource;
    if (res === 'Schedule' || res === 'Appointment' || res === 'AppointmentStatus') {
      fetchDayEvents(selectedDate);
      fetchAllSchedules();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseEvents]);

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchDayEvents = useCallback(async (date) => {
    const ds = getLocalDateString(date);
    try {
      const [sRes, aRes] = await Promise.all([
        apiFetch(`/api/v1/schedules?date=${ds}`),
        apiFetch('/api/v1/appointments'),
      ]);
      if (sRes.ok) {
        const raw = await sRes.json();
        setDaySchedules((Array.isArray(raw) ? raw : []).map(normalizeSchedule));
      }
      if (aRes.ok) {
        const raw = await aRes.json();
        const normalized = (Array.isArray(raw) ? raw : []).map(normalizeAppointment);
        setAllAppointments(normalized);
        setDayAppointments(normalized.filter(a => a.date === ds));
      }
    } catch (err) {
      console.error('fetchDayEvents:', err);
    }
  }, [apiFetch]);

  const fetchAllSchedules = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/schedules');
      if (res.ok) {
        const raw = await res.json();
        setAllSchedules((Array.isArray(raw) ? raw : []).map(normalizeSchedule));
      }
    } catch (err) {
      console.error('fetchAllSchedules:', err);
    }
  }, [apiFetch]);

  useEffect(() => { fetchDayEvents(selectedDate); }, [selectedDate]);
  useEffect(() => { fetchAllSchedules(); }, []);

  const dayEvents = useMemo(() => [...daySchedules, ...dayAppointments], [daySchedules, dayAppointments]);

  const isDateDisabledDay = useMemo(
    () => daySchedules.some(s => s.isDisabledDay),
    [daySchedules]
  );

  // ── Mode switch ───────────────────────────────────────────────────────────────
  const switchMode = (m) => {
    setMode(m);
    setTitle(''); setDesc(''); setStartTime(''); setEndTime('');
    setReason(''); setCloseTitle(''); setCloseStartTime(''); setCloseEndTime('');
  };

  // ── Validation ────────────────────────────────────────────────────────────────
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { showToast('Title is required', 'error'); return; }
    if (!startTime || !endTime) { showToast('Select start and end times', 'error'); return; }
    const v = validateScheduleCreation({ date: dateStr, startTime, endTime }, dayEvents);
    if (!v.isValid) { showToast(v.error, 'error'); return; }
    setShowAddConfirm(true);
  };

  const handleCloseSubmit = (e) => {
    e.preventDefault();
    if (closeType === 'time' && (!closeStartTime || !closeEndTime)) {
      showToast('Select start and end times', 'error'); return;
    }
    const v = validateDateDisabling({ date: dateStr, type: closeType, startTime: closeStartTime, endTime: closeEndTime }, dayEvents);
    if (!v.isValid) { showToast(v.error, 'error'); return; }
    if (v.warning) showToast(v.warning, 'warning');
    setCountdown(5); setCanConfirm(false); setShowCloseConfirm(true);
    const iv = setInterval(() => setCountdown(p => {
      if (p <= 1) { clearInterval(iv); setCanConfirm(true); return 0; }
      return p - 1;
    }), 1000);
  };

  // ── API calls ─────────────────────────────────────────────────────────────────
  const confirmAdd = async () => {
    setIsLoading(true); setShowAddConfirm(false);
    try {
      const res = await apiFetch('/api/v1/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), description: desc.trim() || null, date: dateStr, start_time: startTime, end_time: endTime, availability }),
      });
      if (res.ok) {
        showToast('Schedule added successfully!');
        setTitle(''); setDesc(''); setStartTime(''); setEndTime(''); setAvailability('SHARED');
        await Promise.all([fetchDayEvents(selectedDate), fetchAllSchedules()]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to add schedule', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setIsLoading(false); }
  };

  const confirmClose = async () => {
    setIsLoading(true); setShowCloseConfirm(false);
    try {
      const body = closeType === 'day'
        ? { title: 'DATE_DISABLED', description: reason.trim() || null, date: dateStr, start_time: '00:00', end_time: '23:59', availability: 'EXCLUSIVE' }
        : { title: closeTitle.trim() || 'Reserved Block', description: reason.trim() || null, date: dateStr, start_time: closeStartTime, end_time: closeEndTime, availability: 'EXCLUSIVE' };
      const res = await apiFetch('/api/v1/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (res.ok) {
        showToast(closeType === 'day' ? 'Date blocked successfully!' : 'Time slot blocked!');
        setReason(''); setCloseTitle(''); setCloseStartTime(''); setCloseEndTime('');
        await Promise.all([fetchDayEvents(selectedDate), fetchAllSchedules()]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to block', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setIsLoading(false); }
  };

  const confirmDelete = async () => {
    if (!deletingEvent?.schedule_id) return;
    setIsDeleting(true); setShowDeleteModal(false);
    try {
      const res = await apiFetch(`/api/v1/schedules/${deletingEvent.schedule_id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Schedule deleted');
        await Promise.all([fetchDayEvents(selectedDate), fetchAllSchedules()]);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to delete', 'error');
      }
    } catch { showToast('Network error', 'error'); }
    finally { setIsDeleting(false); setDeletingEvent(null); }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col bg-white"
      style={{ height: 'calc(100vh - 4rem)', overflow: 'hidden' }}
    >
      <Toast msg={toast.msg} type={toast.type} />

      {/* ── Page Header ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-6 pt-6 pb-4 border-b border-zinc-100">
        <button
          onClick={() => navigate('/schedule')}
          className="p-2 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-bold tracking-tight text-zinc-900">Configure Schedule</h1>
          <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] mt-0.5">Add slots · Block dates · Manage availability</p>
        </div>
        <div className="flex-1" />
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </div>
        )}
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: Calendar + Day Events ──────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 border-r border-zinc-100 flex flex-col overflow-hidden">

          {/* Mini Calendar */}
          <div className="px-4 pt-4 pb-3 flex-shrink-0">
            <MiniCal
              value={selectedDate}
              onChange={setSelectedDate}
              allSchedules={allSchedules}
              allAppointments={allAppointments}
              showLegend
              compact
            />
          </div>

          {/* Selected date status */}
          <div className="mx-4 mb-3 flex-shrink-0">
            {isDateDisabledDay ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border border-rose-100 rounded-lg">
                <Ban className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Day Closed — No Appointments</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Available for Bookings</span>
              </div>
            )}
          </div>

          {/* Day events */}
          <div className="flex items-center justify-between px-4 mb-2 flex-shrink-0">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400">
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-[9px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
              {dayEvents.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto border-t border-zinc-100">
            {dayEvents.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center gap-3 text-zinc-300">
                <CalendarDays className="w-8 h-8 opacity-40" />
                <span className="text-[10px] uppercase tracking-widest text-zinc-400">No events on this date</span>
              </div>
            ) : (
              <div className="divide-y divide-zinc-50 py-1">
                {dayEvents.map(ev => (
                  <DayEventRow
                    key={ev.id}
                    ev={ev}
                    onDelete={ev.isSchedule ? (e) => { setDeletingEvent(e); setShowDeleteModal(true); } : null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Form Panel ──────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mode tabs */}
          <div className="flex border-b border-zinc-200 flex-shrink-0 bg-zinc-50/50">
            <button
              onClick={() => switchMode('add')}
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border-b-2
                ${mode === 'add'
                  ? 'border-zinc-900 text-zinc-900 bg-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'}`}
            >
              <Plus className="w-3.5 h-3.5" /> Add Schedule Slot
            </button>
            <button
              onClick={() => switchMode('close')}
              className={`flex-1 py-3.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 border-b-2
                ${mode === 'close'
                  ? 'border-rose-500 text-rose-600 bg-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50'}`}
            >
              <Ban className="w-3.5 h-3.5" /> Close Date / Block
            </button>
          </div>

          {/* Form content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-lg mx-auto px-6 py-6">

              {/* Selected date */}
              <div className="mb-6 pb-5 border-b border-zinc-100">
                <div className="text-[9px] font-black uppercase tracking-[0.22em] text-zinc-400 mb-1">Working on date</div>
                <div className="text-xl font-bold text-zinc-900 leading-tight">{dateLabel}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5 font-mono">{dateStr}</div>
              </div>

              {/* ── ADD SCHEDULE FORM ──────────────────────────────────────────── */}
              {mode === 'add' && (
                <form onSubmit={handleAddSubmit} className="space-y-5">

                  {/* Guidelines */}
                  <div className="flex items-start gap-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
                    <Info className="w-4 h-4 text-zinc-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      {[
                        'Operating window: 6:00 AM – 6:00 PM',
                        'Minimum duration: 15 minutes',
                        'Max 10 concurrent events per slot',
                      ].map(r => (
                        <div key={r} className="text-[11px] text-zinc-500 leading-snug">{r}</div>
                      ))}
                    </div>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                      Schedule Title <span className="text-rose-400">*</span>
                    </label>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Morning Heritage Tour"
                      className={INP}
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                      Description <span className="text-zinc-300">Optional</span>
                    </label>
                    <textarea
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      placeholder="Describe this schedule block…"
                      rows={2}
                      className={`${INP} resize-none`}
                    />
                  </div>

                  {/* Time range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                        Start Time <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="time" value={startTime} min="06:00" max="18:00"
                        onChange={e => setStartTime(e.target.value)}
                        className={`${INP} font-mono`}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                        End Time <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="time" value={endTime} min="06:00" max="18:00"
                        onChange={e => setEndTime(e.target.value)}
                        className={`${INP} font-mono`}
                      />
                    </div>
                  </div>

                  {/* Availability */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                      Availability Type <span className="text-rose-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAvailability('SHARED')}
                        className={`p-4 border-2 rounded-xl text-left transition-all group
                          ${availability === 'SHARED'
                            ? 'border-zinc-900 bg-zinc-50'
                            : 'border-zinc-200 hover:border-zinc-300 bg-white'}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Share2 className={`w-4 h-4 ${availability === 'SHARED' ? 'text-zinc-900' : 'text-zinc-400'}`} />
                          <div className={`text-[10px] font-black uppercase tracking-widest ${availability === 'SHARED' ? 'text-zinc-900' : 'text-zinc-500'}`}>
                            Shared
                          </div>
                        </div>
                        <div className="text-[9px] text-zinc-400 leading-snug">
                          Appointments are allowed during this block
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAvailability('EXCLUSIVE')}
                        className={`p-4 border-2 rounded-xl text-left transition-all
                          ${availability === 'EXCLUSIVE'
                            ? 'border-orange-400 bg-orange-50'
                            : 'border-zinc-200 hover:border-zinc-300 bg-white'}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <Shield className={`w-4 h-4 ${availability === 'EXCLUSIVE' ? 'text-orange-500' : 'text-zinc-400'}`} />
                          <div className={`text-[10px] font-black uppercase tracking-widest ${availability === 'EXCLUSIVE' ? 'text-orange-700' : 'text-zinc-500'}`}>
                            Exclusive
                          </div>
                        </div>
                        <div className="text-[9px] text-zinc-400 leading-snug">
                          No new appointments during this block
                        </div>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    style={{ backgroundColor: GOLD }}
                    className="w-full py-3 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm mt-2"
                  >
                    {isLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                      : <><Plus className="w-3.5 h-3.5" /> Add Schedule Slot</>}
                  </button>
                </form>
              )}

              {/* ── CLOSE DATE FORM ────────────────────────────────────────────── */}
              {mode === 'close' && (
                <form onSubmit={handleCloseSubmit} className="space-y-5">

                  {/* Day / Time slot toggle */}
                  <div className="flex bg-zinc-100 p-1 rounded-xl gap-1">
                    {[
                      { val: 'day',  label: 'Block Full Day', icon: CalendarDays },
                      { val: 'time', label: 'Block Time Slot', icon: Clock },
                    ].map(({ val, label, icon: Icon }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCloseType(val)}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5
                          ${closeType === val ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'}`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    ))}
                  </div>

                  {/* Warning */}
                  <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                      <div className="text-[11px] text-rose-700 font-bold leading-snug">
                        {closeType === 'day'
                          ? 'Blocks the entire day — no new appointments can be booked'
                          : 'Blocks a specific time range — appointments outside it are unaffected'}
                      </div>
                      <div className="text-[10px] text-rose-500">Existing approved appointments are NOT cancelled.</div>
                    </div>
                  </div>

                  {/* Block title (time slot only) */}
                  {closeType === 'time' && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                        Block Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        value={closeTitle}
                        onChange={e => setCloseTitle(e.target.value)}
                        placeholder="e.g. Facility Maintenance"
                        className={INP}
                      />
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                      {closeType === 'day' ? 'Reason' : 'Description'} <span className="text-zinc-300">Optional</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      placeholder={closeType === 'day' ? 'Why is this date unavailable?' : 'Optional notes…'}
                      rows={2}
                      className={`${INP} resize-none`}
                    />
                  </div>

                  {/* Time range (time slot only) */}
                  {closeType === 'time' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                          Block Start <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="time" value={closeStartTime} min="06:00" max="18:00"
                          onChange={e => setCloseStartTime(e.target.value)}
                          className={`${INP} font-mono`}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">
                          Block End <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="time" value={closeEndTime} min="06:00" max="18:00"
                          onChange={e => setCloseEndTime(e.target.value)}
                          className={`${INP} font-mono`}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm mt-2"
                  >
                    {isLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
                      : <><Ban className="w-3.5 h-3.5" /> {closeType === 'day' ? 'Block Entire Day' : 'Block Time Slot'}</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}
      <ConfirmModal
        open={showAddConfirm}
        title="Confirm New Schedule Slot"
        onConfirm={confirmAdd}
        onCancel={() => setShowAddConfirm(false)}
      >
        <p className="text-zinc-600">You are adding the following schedule:</p>
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-100 space-y-2">
          <Row k="Title" v={title} />
          <Row k="Date"  v={dateLabel} />
          <Row k="Time"  v={`${formatTimeTo12H(startTime)} – ${formatTimeTo12H(endTime)}`} />
          <Row k="Type"  v={availability} />
          {desc && <Row k="Notes" v={desc} muted />}
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={showCloseConfirm}
        title={closeType === 'day' ? 'Block Entire Date' : 'Block Time Slot'}
        onConfirm={canConfirm ? confirmClose : undefined}
        onCancel={() => setShowCloseConfirm(false)}
        confirmDisabled={!canConfirm}
        confirmLabel={canConfirm ? 'Confirm Block' : `Wait ${countdown}s`}
        danger
      >
        <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          This will prevent new appointment bookings.
        </div>
        <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 space-y-2">
          <Row k="Date"     v={dateLabel} />
          {closeType === 'time' && (
            <Row k="Time" v={`${formatTimeTo12H(closeStartTime)} – ${formatTimeTo12H(closeEndTime)}`} />
          )}
          <Row k="Coverage" v={closeType === 'day' ? 'All Day' : 'Time Range'} />
          {reason && <Row k="Reason" v={reason} muted />}
        </div>
        {!canConfirm && (
          <div className="flex items-center gap-2.5 text-[10px] font-bold text-zinc-600 bg-zinc-100 border border-zinc-200 rounded-lg px-3.5 py-2.5">
            <Clock className="w-3.5 h-3.5 animate-pulse text-zinc-400" />
            Please wait {countdown}s before confirming…
          </div>
        )}
      </ConfirmModal>

      <DeleteModal
        open={showDeleteModal}
        event={deletingEvent}
        onConfirm={confirmDelete}
        onCancel={() => { setShowDeleteModal(false); setDeletingEvent(null); }}
      />

      {isDeleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl flex items-center gap-3 border border-zinc-100">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            <span className="text-sm font-semibold text-zinc-700">Deleting…</span>
          </div>
        </div>
      )}
    </div>
  );
}
