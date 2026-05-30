import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Clock, Users, FileText, Ban,
  CheckCircle2, AlertTriangle, Loader2, Trash2, CalendarDays, Plus,
} from 'lucide-react';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import { getLocalDateString, formatTimeTo12H, normalizeSchedule, normalizeAppointment } from '../utils/scheduleUtils';
import { validateScheduleCreation, validateDateDisabling } from '../utils/scheduleValidation';

// ─── Input class ──────────────────────────────────────────────────────────────
const INP = 'w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] transition-colors placeholder:text-zinc-400';

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const isErr  = type === 'error';
  const isWarn = type === 'warning';
  return (
    <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold border
      ${isErr ? 'bg-red-500 text-white border-red-600' : isWarn ? 'bg-amber-500 text-white border-amber-600' : 'bg-zinc-900 text-white border-zinc-800'}`}>
      {isErr || isWarn ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />}
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
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm text-zinc-600 leading-relaxed space-y-3">{children}</div>
        <div className="px-6 py-4 bg-zinc-50 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed
              ${danger ? 'bg-rose-500 text-white hover:bg-rose-600' : 'bg-zinc-900 text-white hover:bg-[#D4AF37] hover:text-zinc-900'}`}
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
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">Delete Schedule</h3>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm text-zinc-600">
          <p>This action cannot be undone:</p>
          <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
            <p className="font-bold text-rose-900 text-sm">{event.title}</p>
            <p className="text-xs text-rose-600 mt-1 font-mono">
              {event.isDisabledDay ? 'All Day (Closed)' : `${formatTimeTo12H(event.startTime)} – ${formatTimeTo12H(event.endTime)}`}
            </p>
          </div>
        </div>
        <div className="px-6 py-4 bg-zinc-50 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-5 py-2 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-rose-600 transition-all">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCal({ value, onChange, allSchedules }) {
  const [cursor, setCursor] = useState({ m: value.getMonth(), y: value.getFullYear() });

  const prev = () => setCursor(c => c.m === 0 ? { m: 11, y: c.y - 1 } : { m: c.m - 1, y: c.y });
  const next = () => setCursor(c => c.m === 11 ? { m: 0, y: c.y + 1 } : { m: c.m + 1, y: c.y });

  const today      = getLocalDateString(new Date());
  const selectedStr = getLocalDateString(value);

  const disabledSet = useMemo(
    () => new Set(allSchedules.filter(s => s.isDisabledDay).map(s => s.date)),
    [allSchedules]
  );
  const markedSet = useMemo(
    () => new Set(allSchedules.filter(s => !s.isDisabledDay && s.status !== 'COMPLETED').map(s => s.date)),
    [allSchedules]
  );

  const firstDay   = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const ds = (d) =>
    `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="select-none p-4">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-700">
          {new Date(cursor.y, cursor.m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={next} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-zinc-300 pb-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateStr   = ds(day);
          const isSel     = dateStr === selectedStr;
          const isToday   = dateStr === today;
          const isDisabled = disabledSet.has(dateStr);
          const hasEvent  = markedSet.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => onChange(new Date(cursor.y, cursor.m, day))}
              className={`relative h-8 w-full flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-all
                ${isSel
                  ? 'bg-[#D4AF37] text-zinc-900 font-bold shadow-sm'
                  : isToday
                    ? 'bg-zinc-900 text-white font-bold'
                    : isDisabled
                      ? 'text-rose-400 hover:bg-rose-50'
                      : 'text-zinc-600 hover:bg-zinc-100'}`}
            >
              <span className="leading-none">{day}</span>
              {(hasEvent || isDisabled) && !isSel && (
                <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isDisabled ? 'bg-rose-400' : 'bg-[#D4AF37]'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-100">
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37] inline-block" /> Has schedule
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-rose-400 inline-block opacity-60" /> Closed
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-[#D4AF37]/60 border border-[#D4AF37] inline-block" /> Selected
        </div>
      </div>
    </div>
  );
}

// ─── Row helper (for confirm modals) ─────────────────────────────────────────
function Row({ k, v, muted }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-zinc-400 font-bold uppercase tracking-widest w-16 flex-shrink-0">{k}</span>
      <span className={muted ? 'text-zinc-500' : 'text-zinc-800 font-medium'}>{v}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ScheduleAdd() {
  const navigate = useNavigate();
  const { apiFetch } = useAuth();

  // ── Form state ────────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mode, setMode] = useState('add'); // 'add' | 'close'
  const [closeType, setCloseType] = useState('day');
  const [availability, setAvailability] = useState('SHARED');

  // Add schedule fields
  const [title, setTitle]         = useState('');
  const [desc, setDesc]           = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime]     = useState('');

  // Close date fields
  const [reason, setReason]               = useState('');
  const [closeTitle, setCloseTitle]       = useState('');
  const [closeStartTime, setCloseStartTime] = useState('');
  const [closeEndTime, setCloseEndTime]   = useState('');

  // UI state
  const [showAddConfirm, setShowAddConfirm]     = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDeleteModal, setShowDeleteModal]   = useState(false);
  const [deletingEvent, setDeletingEvent]       = useState(null);
  const [countdown, setCountdown]               = useState(5);
  const [canConfirm, setCanConfirm]             = useState(false);
  const [isLoading, setIsLoading]               = useState(false);
  const [isDeleting, setIsDeleting]             = useState(false);
  const [toast, setToast]                       = useState({ msg: '', type: 'success' });

  // Data
  const [daySchedules, setDaySchedules]     = useState([]);
  const [dayAppointments, setDayAppointments] = useState([]);
  const [allSchedules, setAllSchedules]     = useState([]);

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
        setDayAppointments(
          (Array.isArray(raw) ? raw : []).map(normalizeAppointment).filter(a => a.date === ds)
        );
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
        showToast('Schedule added!');
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
        showToast(closeType === 'day' ? 'Date blocked!' : 'Time slot blocked!');
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
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <Toast msg={toast.msg} type={toast.type} />

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Configure Schedule</h2>
          <p className="text-[10px] text-zinc-400 mt-0.5 uppercase tracking-[0.15em]">
            Add schedule blocks or set date closures
          </p>
        </div>
        <button
          onClick={() => navigate('/schedule')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:border-zinc-300 hover:text-zinc-900 shadow-sm transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Schedule
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 grid grid-cols-12 gap-4 min-h-0">

        {/* ── Left: Calendar + Events ────────────────────────────────────────── */}
        <div className="col-span-5 flex flex-col gap-4 min-h-0">

          {/* Mini Calendar */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex-shrink-0">
            <MiniCal
              value={selectedDate}
              onChange={setSelectedDate}
              allSchedules={allSchedules}
            />
          </div>

          {/* Events for selected date */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-zinc-400">Events on Date</div>
                <div className="text-sm font-semibold text-zinc-800 mt-0.5">
                  {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <span className="text-[10px] font-bold bg-zinc-100 text-zinc-500 px-2 py-1 rounded-full">
                {dayEvents.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-50">
              {dayEvents.length === 0 ? (
                <div className="p-10 text-center flex flex-col items-center gap-2 text-zinc-400">
                  <CalendarDays className="w-6 h-6 opacity-30" />
                  <span className="text-[10px] uppercase tracking-widest">No events on this date</span>
                </div>
              ) : (
                dayEvents.map(ev => {
                  const isAppt    = ev.isAppointment;
                  const isDisabled = ev.isDisabledDay;
                  const isExcl    = ev.availability === 'EXCLUSIVE' && !isDisabled;
                  const dot = isDisabled ? 'bg-rose-500' : isAppt ? 'bg-indigo-500' : isExcl ? 'bg-rose-400' : 'bg-[#D4AF37]';

                  return (
                    <div key={ev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 transition-colors group">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-zinc-800 truncate">
                          {isAppt ? ev.organizer : ev.title}
                        </div>
                        {isAppt && ev.title && (
                          <div className="text-[10px] text-zinc-400 truncate">{ev.title}</div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {isDisabled ? 'All Day' : ev.hasFlexibleTime ? 'Flexible' : `${formatTimeTo12H(ev.startTime)} – ${formatTimeTo12H(ev.endTime)}`}
                          </span>
                          {isAppt && ev.numPeople != null && (
                            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
                              <Users className="w-2.5 h-2.5" />{ev.numPeople}
                            </span>
                          )}
                        </div>
                      </div>
                      {ev.isSchedule && (
                        <button
                          onClick={() => { setDeletingEvent(ev); setShowDeleteModal(true); }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-zinc-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Form ─────────────────────────────────────────────────────── */}
        <div className="col-span-7 bg-white rounded-xl border border-zinc-200 shadow-sm flex flex-col min-h-0 overflow-hidden">

          {/* Mode tabs */}
          <div className="flex border-b border-zinc-200 flex-shrink-0">
            <button
              onClick={() => switchMode('add')}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5
                ${mode === 'add' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'}`}
            >
              <Plus className="w-3.5 h-3.5" /> Add Schedule
            </button>
            <button
              onClick={() => switchMode('close')}
              className={`flex-1 py-4 text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5
                ${mode === 'close' ? 'bg-rose-500 text-white' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'}`}
            >
              <Ban className="w-3.5 h-3.5" /> Close Date
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Selected date label */}
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-bold">Selected Date</div>
              <div className="text-lg font-bold text-zinc-900 mt-1">{dateLabel}</div>
            </div>

            {/* ── ADD SCHEDULE FORM ──────────────────────────────────────────── */}
            {mode === 'add' && (
              <form onSubmit={handleAddSubmit} className="space-y-5">
                {/* Guidelines */}
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200/60 rounded-xl">
                  <FileText className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    {['6:00 AM – 6:00 PM window', '15 min minimum duration', 'Max 10 concurrent events'].map(r => (
                      <div key={r} className="text-[11px] text-amber-700">{r}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                    Title *
                  </label>
                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Morning Heritage Tour"
                    className={INP}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="Optional description…"
                    rows={3}
                    className={`${INP} resize-none`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">Start Time</label>
                    <input type="time" value={startTime} min="06:00" max="18:00" onChange={e => setStartTime(e.target.value)} className={`${INP} font-mono`} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">End Time</label>
                    <input type="time" value={endTime} min="06:00" max="18:00" onChange={e => setEndTime(e.target.value)} className={`${INP} font-mono`} />
                  </div>
                </div>

                {/* Availability */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                    Availability *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { val: 'SHARED', label: 'Shared', sub: 'Appointments allowed during this block', color: 'border-amber-300 bg-amber-50 text-amber-800' },
                      { val: 'EXCLUSIVE', label: 'Exclusive', sub: 'No new appointments during this block', color: 'border-rose-300 bg-rose-50 text-rose-800' },
                    ].map(({ val, label, sub, color }) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAvailability(val)}
                        className={`p-3.5 border-2 rounded-xl text-left transition-all
                          ${availability === val ? color : 'border-zinc-200 hover:border-zinc-300 bg-white text-zinc-600'}`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-widest">{label}</div>
                        <div className="text-[9px] mt-1 opacity-70 leading-relaxed">{sub}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-[#D4AF37] hover:text-zinc-900 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                    : <><Plus className="w-3.5 h-3.5" /> Add Schedule</>}
                </button>
              </form>
            )}

            {/* ── CLOSE DATE FORM ────────────────────────────────────────────── */}
            {mode === 'close' && (
              <form onSubmit={handleCloseSubmit} className="space-y-5">
                {/* Day / Time slot toggle */}
                <div className="flex bg-zinc-100 p-1 rounded-xl">
                  {['day', 'time'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCloseType(t)}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all
                        ${closeType === t ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                      {t === 'day' ? 'Full Day' : 'Time Slot'}
                    </button>
                  ))}
                </div>

                {/* Warning */}
                <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200/60 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-0.5">
                    <div className="text-[11px] text-rose-700 font-semibold">
                      {closeType === 'day' ? 'Blocks the entire day — no new appointments' : 'Blocks a specific time range'}
                    </div>
                    <div className="text-[11px] text-rose-600">Existing approved appointments are NOT affected.</div>
                  </div>
                </div>

                {closeType === 'time' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">Block Title *</label>
                    <input
                      value={closeTitle}
                      onChange={e => setCloseTitle(e.target.value)}
                      placeholder="e.g. Facility Maintenance"
                      className={INP}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">
                    {closeType === 'day' ? 'Reason (Optional)' : 'Description (Optional)'}
                  </label>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder={closeType === 'day' ? 'Why is this date unavailable?' : 'Optional notes…'}
                    rows={3}
                    className={`${INP} resize-none`}
                  />
                </div>

                {closeType === 'time' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">Start</label>
                      <input type="time" value={closeStartTime} min="06:00" max="18:00" onChange={e => setCloseStartTime(e.target.value)} className={`${INP} font-mono`} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1.5">End</label>
                      <input type="time" value={closeEndTime} min="06:00" max="18:00" onChange={e => setCloseEndTime(e.target.value)} className={`${INP} font-mono`} />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-rose-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-rose-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}
      <ConfirmModal
        open={showAddConfirm}
        title="Confirm Schedule"
        onConfirm={confirmAdd}
        onCancel={() => setShowAddConfirm(false)}
      >
        <p className="text-zinc-700 font-medium">Adding a new schedule block:</p>
        <div className="mt-1 p-4 bg-zinc-50 rounded-lg border border-zinc-100 space-y-2">
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
        <div className="text-rose-600 font-semibold text-sm">⚠ This will prevent new appointment bookings.</div>
        <div className="p-4 bg-rose-50 rounded-lg border border-rose-100 space-y-2">
          <Row k="Date"     v={dateLabel} />
          {closeType === 'time' && (
            <Row k="Time" v={`${formatTimeTo12H(closeStartTime)} – ${formatTimeTo12H(closeEndTime)}`} />
          )}
          <Row k="Coverage" v={closeType === 'day' ? 'All Day' : 'Time Range'} />
          {reason && <Row k="Reason" v={reason} muted />}
        </div>
        {!canConfirm && (
          <div className="flex items-center gap-2 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5 animate-pulse" /> Wait {countdown}s to confirm…
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
          <div className="bg-white rounded-xl px-8 py-6 shadow-2xl flex items-center gap-3 border border-zinc-200">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            <span className="text-sm font-medium text-zinc-700">Deleting…</span>
          </div>
        </div>
      )}
    </div>
  );
}
