import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  ChevronLeft, ChevronRight, Plus, Users, Clock, CheckCircle2,
  Ban, Loader2, X, CalendarDays, ArrowRight, Activity,
} from 'lucide-react';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import {
  getLocalDateString, formatTimeTo12H,
  normalizeSchedule, normalizeAppointment, toFCEvent,
} from '../utils/scheduleUtils';

// ─── FullCalendar CSS ─────────────────────────────────────────────────────────
const FC_STYLES = `
  .sch-cal .fc { height: 100%; font-family: inherit; }
  .sch-cal .fc-toolbar { display: none !important; }
  .sch-cal .fc-theme-standard td,
  .sch-cal .fc-theme-standard th { border-color: #f4f4f5; }
  .sch-cal .fc-theme-standard .fc-scrollgrid { border-color: #f4f4f5; border-radius: 0; }
  .sch-cal .fc-col-header-cell { background: #fafafa; }
  .sch-cal .fc-col-header-cell-cushion {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.15em; color: #71717a; text-decoration: none !important;
    padding: 10px 8px; display: block;
  }
  .sch-cal .fc-timegrid-slot-label-cushion {
    font-size: 10px; color: #a1a1aa;
    font-family: ui-monospace, monospace; padding-right: 10px; font-weight: 500;
  }
  .sch-cal .fc-timegrid-slot-minor { border-top-style: dashed !important; border-color: #f9f9f9 !important; }
  .sch-cal .fc-timegrid-now-indicator-line { border-color: #D4AF37 !important; border-width: 2px !important; }
  .sch-cal .fc-timegrid-now-indicator-arrow { border-top-color: #D4AF37 !important; border-bottom-color: #D4AF37 !important; }
  .sch-cal .fc-timegrid-event {
    border-radius: 4px !important; border-left-width: 3px !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important;
  }
  .sch-cal .fc-timegrid-event:hover { box-shadow: 0 3px 8px rgba(0,0,0,0.10) !important; z-index: 10 !important; }
  .sch-cal .fc-timegrid-event .fc-event-main { padding: 0; }
  .sch-cal .fc-event-title { display: none; }
  .sch-cal .fc-v-event { border: 1px solid; }
  .sch-cal .fc-day-today { background: rgba(212,175,55,0.025) !important; }
  .sch-cal .fc-day-today .fc-col-header-cell-cushion { color: #D4AF37 !important; }
`;

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCal({ value, onChange, allSchedules }) {
  const [cursor, setCursor] = useState({ m: value.getMonth(), y: value.getFullYear() });

  // Sync when external value changes (e.g. Dashboard auto-select)
  useEffect(() => {
    setCursor({ m: value.getMonth(), y: value.getFullYear() });
  }, [value.getFullYear(), value.getMonth()]);

  const prev = () => setCursor(c => c.m === 0 ? { m: 11, y: c.y - 1 } : { m: c.m - 1, y: c.y });
  const next = () => setCursor(c => c.m === 11 ? { m: 0, y: c.y + 1 } : { m: c.m + 1, y: c.y });

  const today = getLocalDateString(new Date());
  const selectedStr = getLocalDateString(value);

  const disabledSet = useMemo(
    () => new Set(allSchedules.filter(s => s.isDisabledDay).map(s => s.date)),
    [allSchedules]
  );
  const markedSet = useMemo(
    () => new Set(allSchedules.filter(s => !s.isDisabledDay && s.status !== 'COMPLETED').map(s => s.date)),
    [allSchedules]
  );

  const firstDay = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const ds = (d) =>
    `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  return (
    <div className="px-4 pt-4 pb-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prev} className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
          {new Date(cursor.y, cursor.m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <button onClick={next} className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-bold text-zinc-300 pb-1.5">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const dateStr = ds(day);
          const isSel = dateStr === selectedStr;
          const isToday = dateStr === today;
          const isDisabled = disabledSet.has(dateStr);
          const hasEvent = markedSet.has(dateStr);

          return (
            <button
              key={dateStr}
              onClick={() => onChange(new Date(cursor.y, cursor.m, day))}
              className={`relative h-7 w-full flex flex-col items-center justify-center rounded text-xs font-medium transition-all
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
    </div>
  );
}

// ─── Event card (sidebar list item) ──────────────────────────────────────────
function EventCard({ ev, isSelected, onClick }) {
  const isAppt    = ev.isAppointment;
  const isDisabled = ev.isDisabledDay;
  const isExcl    = ev.availability === 'EXCLUSIVE' && !isDisabled;

  const dot = isDisabled ? 'bg-rose-500' : isAppt ? 'bg-indigo-500' : isExcl ? 'bg-rose-400' : 'bg-[#D4AF37]';
  const bg  = isSelected ? 'bg-zinc-50 shadow-sm border border-zinc-200' : 'hover:bg-zinc-50 border border-transparent';

  const timeStr = isDisabled
    ? 'All Day'
    : ev.hasFlexibleTime
      ? 'Flexible'
      : `${formatTimeTo12H(ev.startTime)} – ${formatTimeTo12H(ev.endTime)}`;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-all rounded-sm ${bg}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-zinc-800 truncate">
          {isAppt ? ev.organizer : ev.title}
        </div>
        {isAppt && ev.title && (
          <div className="text-[10px] text-zinc-400 truncate">{ev.title}</div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-zinc-400">{timeStr}</span>
          {isAppt && ev.numPeople != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-zinc-400">
              <Users className="w-2.5 h-2.5" />{ev.numPeople}
            </span>
          )}
        </div>
      </div>
      {ev.isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />}
      {isDisabled && <Ban className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />}
    </button>
  );
}

// ─── Event detail ─────────────────────────────────────────────────────────────
function EventDetail({ ev, onClose, onMarkDone, isSubmitting }) {
  const isAppt = ev.isAppointment;
  const isDisabled = ev.isDisabledDay;
  const isExcl = ev.availability === 'EXCLUSIVE';
  const isDone = ev.isDone || ev.status === 'COMPLETED';

  const tag = isAppt ? 'Appointment' : isDisabled ? 'Date Closed' : isExcl ? 'Exclusive Block' : 'Shared Schedule';
  const tagColor = isAppt ? 'text-indigo-600 bg-indigo-50 border-indigo-200'
    : (isExcl || isDisabled) ? 'text-rose-600 bg-rose-50 border-rose-200'
      : 'text-amber-700 bg-amber-50 border-amber-200';

  const timeStr = isDisabled
    ? 'All Day — Closed for Appointments'
    : ev.hasFlexibleTime
      ? 'Flexible — no fixed time'
      : `${formatTimeTo12H(ev.startTime)} – ${formatTimeTo12H(ev.endTime)}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 flex-shrink-0">
        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded border ${tagColor}`}>{tag}</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-zinc-100 text-zinc-400 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-base font-bold text-zinc-900 leading-tight">
            {isAppt ? ev.organizer : ev.title}
          </h3>
          {isAppt && ev.title && (
            <p className="text-xs text-zinc-500 mt-0.5">{ev.title}</p>
          )}
        </div>

        <div className="space-y-3">
          <DetailRow icon={<Clock className="w-3.5 h-3.5" />} value={timeStr} />
          {isAppt && ev.numPeople != null && (
            <DetailRow icon={<Users className="w-3.5 h-3.5" />} value={`${ev.numPeople} visitor${ev.numPeople !== 1 ? 's' : ''}`} />
          )}
          {ev.description && (
            <p className="text-xs text-zinc-500 leading-relaxed pt-1 border-t border-zinc-100">{ev.description}</p>
          )}
        </div>

        <div className="pt-2 border-t border-zinc-100">
          {isDone || isDisabled ? (
            <div className={`flex items-center justify-center gap-2 py-2.5 rounded text-[10px] font-bold uppercase tracking-widest border
              ${isDisabled ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
              {isDisabled ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {isDisabled ? 'Date Closed' : 'Completed'}
            </div>
          ) : (
            <button
              onClick={onMarkDone}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-[#D4AF37] hover:text-zinc-900 transition-all duration-200 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              {isAppt ? 'Go to Appointment' : 'Mark Completed'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, value }) {
  return (
    <div className="flex items-start gap-2 text-xs text-zinc-600">
      <span className="text-zinc-400 mt-0.5 flex-shrink-0">{icon}</span>
      <span>{value}</span>
    </div>
  );
}

// ─── FC event content ─────────────────────────────────────────────────────────
function renderEventContent(info) {
  const p = info.event.extendedProps;
  const c = info.event.textColor;
  return (
    <div style={{ padding: '3px 7px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '1px' }}>
      <div style={{ color: c, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {p.isAppointment ? (p.organizer || info.event.title) : info.event.title}
      </div>
      {p.isAppointment && p.numPeople != null && (
        <div style={{ color: c, fontSize: '9px', opacity: 0.65 }}>{p.numPeople} visitors</div>
      )}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white border border-zinc-200 rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-900">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm text-zinc-600 leading-relaxed">{message}</div>
        <div className="px-6 py-4 bg-zinc-50 flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900">
            Cancel
          </button>
          <button onClick={onConfirm} className="px-5 py-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded hover:bg-[#D4AF37] hover:text-zinc-900 transition-all">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Schedule() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const calRef     = useRef(null);
  const { apiFetch } = useAuth();

  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [selectedEvent, setSelectedEvent]   = useState(null);
  const [showConfirm, setShowConfirm]       = useState(false);
  const [currentView, setCurrentView]       = useState('timeGridDay');
  const [toast, setToast]                   = useState({ text: '', type: 'success' });
  const [isLoading, setIsLoading]           = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);

  const [allSchedules, setAllSchedules]         = useState([]);
  const [allAppointments, setAllAppointments]   = useState([]);

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: '', type: 'success' }), 3500);
  }, []);

  const dateStr = getLocalDateString(selectedDate);

  // ── SSE ──────────────────────────────────────────────────────────────────────
  const { events: sseEvents } = useSSE('*');
  useEffect(() => {
    if (!sseEvents.length) return;
    const res = sseEvents[0]?.resource;
    if (res === 'Schedule' || res === 'Appointment' || res === 'AppointmentStatus') fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseEvents]);

  // ── Fetch ─────────────────────────────────────────────────────────────────────
  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        apiFetch('/api/v1/schedules'),
        apiFetch('/api/v1/appointments'),
      ]);
      if (sRes.ok) {
        const raw = await sRes.json();
        setAllSchedules((Array.isArray(raw) ? raw : []).map(normalizeSchedule));
      }
      if (aRes.ok) {
        const raw = await aRes.json();
        setAllAppointments((Array.isArray(raw) ? raw : []).map(normalizeAppointment));
      }
    } catch {
      showToast('Failed to load schedule data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => { fetchAllData(); }, []);

  // ── Dashboard auto-select ─────────────────────────────────────────────────────
  useEffect(() => {
    const state = location.state;
    if (!state?.selectedScheduleId || !allSchedules.length) return;
    const match = allSchedules.find(s => s.schedule_id === state.selectedScheduleId);
    if (match) {
      const d = new Date(match.date + 'T00:00:00');
      setSelectedDate(d);
      calRef.current?.getApi()?.gotoDate(d);
      setSelectedEvent(match);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, allSchedules]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const allEvents = useMemo(() => [...allSchedules, ...allAppointments], [allSchedules, allAppointments]);

  const todayEvents = useMemo(() => {
    return allEvents
      .filter(ev => {
        if (ev.date !== dateStr) return false;
        if (ev.isSchedule) return true;
        return ev.status === 'APPROVED' || ev.status === 'COMPLETED';
      })
      .sort((a, b) => {
        if (a.hasFlexibleTime && !b.hasFlexibleTime) return 1;
        if (!a.hasFlexibleTime && b.hasFlexibleTime) return -1;
        const am = (a.startTime || '').split(':').reduce((h, m) => h * 60 + +m, 0);
        const bm = (b.startTime || '').split(':').reduce((h, m) => h * 60 + +m, 0);
        return am - bm;
      });
  }, [allEvents, dateStr]);

  const fcEvents = useMemo(() => {
    return allEvents
      .filter(ev => {
        if (ev.isSchedule) return ev.status !== 'COMPLETED';
        return ev.status === 'APPROVED' && !ev.hasFlexibleTime;
      })
      .map(ev => toFCEvent(ev))
      .filter(Boolean);
  }, [allEvents]);

  const isDateDisabled = useMemo(
    () => allSchedules.some(s => s.date === dateStr && s.isDisabledDay),
    [allSchedules, dateStr]
  );

  const dateStats = useMemo(() => ({
    schedules: allEvents.filter(e => e.isSchedule && !e.isDisabledDay && e.date === dateStr && e.status !== 'COMPLETED').length,
    appointments: allEvents.filter(e => e.isAppointment && e.status === 'APPROVED' && e.date === dateStr).length,
  }), [allEvents, dateStr]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleEventClick = useCallback((info) => {
    setSelectedEvent(info.event.extendedProps);
  }, []);

  const handleDateChange = useCallback((date) => {
    setSelectedDate(date);
    const api = calRef.current?.getApi();
    if (api) {
      api.gotoDate(date);
      if (currentView === 'timeGridWeek') {
        // Week view stays, just navigate to the week containing the date
      }
    }
  }, [currentView]);

  const handleMarkDone = useCallback(() => {
    if (!selectedEvent) return;
    if (selectedEvent.isAppointment) {
      navigate(`/appointments/${selectedEvent.appointment_id}`, { state: { autoAction: 'arrive' } });
    } else {
      setShowConfirm(true);
    }
  }, [selectedEvent, navigate]);

  const handleConfirmDone = useCallback(async () => {
    if (!selectedEvent?.schedule_id) return;
    setIsSubmitting(true);
    setShowConfirm(false);
    try {
      const res = await apiFetch(`/api/v1/schedules/${selectedEvent.schedule_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });
      if (res.ok) {
        showToast('Schedule marked as completed');
        setSelectedEvent(null);
        await fetchAllData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.message || 'Failed to update', 'error');
      }
    } catch {
      showToast('Network error — try again', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedEvent, apiFetch, showToast, fetchAllData]);

  const switchView = (view) => {
    calRef.current?.getApi()?.changeView(view);
    setCurrentView(view);
  };

  const goDir = (dir) => {
    const api = calRef.current?.getApi();
    if (!api) return;
    dir === 'prev' ? api.prev() : api.next();
    const d = api.getDate();
    setSelectedDate(new Date(d));
  };

  // ── Date label ────────────────────────────────────────────────────────────────
  const dateLabel = useMemo(() => {
    if (currentView === 'timeGridWeek') {
      const api = calRef.current?.getApi();
      if (api) {
        const start = api.view.activeStart;
        const end   = new Date(api.view.activeEnd);
        end.setDate(end.getDate() - 1);
        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    }
    return selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, currentView]);

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <style>{FC_STYLES}</style>

      {/* Toast */}
      {toast.text && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold border
          ${toast.type === 'error' ? 'bg-red-500 text-white border-red-600' : 'bg-zinc-900 text-white border-zinc-800'}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" /> {toast.text}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 pb-4 border-b border-zinc-200">
        {/* Date nav */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
          <button onClick={() => goDir('prev')} className="p-1.5 rounded-md hover:bg-white text-zinc-500 hover:text-zinc-900 hover:shadow-sm transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { calRef.current?.getApi()?.today(); setSelectedDate(new Date()); }}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 hover:bg-white hover:shadow-sm rounded-md transition-all"
          >
            Today
          </button>
          <button onClick={() => goDir('next')} className="p-1.5 rounded-md hover:bg-white text-zinc-500 hover:text-zinc-900 hover:shadow-sm transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Date label */}
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-zinc-900">{dateLabel}</h2>
          {isDateDisabled && currentView === 'timeGridDay' && (
            <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">
              <Ban className="w-2.5 h-2.5" /> Closed
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Loading indicator */}
        {isLoading && <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />}

        {/* View switch */}
        <div className="flex bg-zinc-100 rounded-lg p-0.5 gap-0.5">
          {[
            { key: 'timeGridDay', label: 'Day' },
            { key: 'timeGridWeek', label: 'Week' },
          ].map(v => (
            <button
              key={v.key}
              onClick={() => switchView(v.key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all
                ${currentView === v.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Add button */}
        <button
          onClick={() => navigate('/schedule/add')}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-[#D4AF37] hover:text-zinc-900 transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add Schedule
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex gap-0 min-h-0 pt-4">

        {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-zinc-100 mr-4">

          {/* Mini Calendar */}
          <MiniCal value={selectedDate} onChange={handleDateChange} allSchedules={allSchedules} />

          {/* Stats strip */}
          <div className="flex border-t border-b border-zinc-100 divide-x divide-zinc-100 flex-shrink-0">
            <div className="flex-1 flex flex-col items-center py-2.5">
              <span className="text-lg font-bold text-zinc-900 leading-none">{dateStats.schedules}</span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold mt-0.5 flex items-center gap-0.5">
                <CalendarDays className="w-2.5 h-2.5" /> Schedules
              </span>
            </div>
            <div className="flex-1 flex flex-col items-center py-2.5">
              <span className="text-lg font-bold text-zinc-900 leading-none">{dateStats.appointments}</span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-400 font-bold mt-0.5 flex items-center gap-0.5">
                <Activity className="w-2.5 h-2.5" /> Appts
              </span>
            </div>
          </div>

          {/* Events list OR Event detail */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {selectedEvent ? (
              <EventDetail
                ev={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onMarkDone={handleMarkDone}
                isSubmitting={isSubmitting}
              />
            ) : (
              <>
                <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-100 flex-shrink-0">
                  <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-zinc-400">
                    {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[9px] font-bold bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full">
                    {todayEvents.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto py-1">
                  {isLoading && allEvents.length === 0 ? (
                    <div className="p-8 flex flex-col items-center gap-2 text-zinc-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  ) : todayEvents.length === 0 ? (
                    <div className="p-8 text-center text-[10px] text-zinc-400 uppercase tracking-widest">
                      No events
                    </div>
                  ) : (
                    todayEvents.map(ev => (
                      <EventCard
                        key={ev.id}
                        ev={ev}
                        isSelected={false}
                        onClick={() => setSelectedEvent(ev)}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Calendar ─────────────────────────────────────────────────────────── */}
        <div className={`sch-cal flex-1 min-w-0 bg-white rounded-xl border border-zinc-100 overflow-hidden relative shadow-sm
          ${isDateDisabled && currentView === 'timeGridDay' ? 'ring-1 ring-rose-200' : ''}`}>
          {isDateDisabled && currentView === 'timeGridDay' && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-rose-500 text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full shadow pointer-events-none">
              <Ban className="w-3 h-3" /> Appointments Disabled
            </div>
          )}
          <FullCalendar
            ref={calRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            initialView="timeGridDay"
            initialDate={new Date()}
            events={fcEvents}
            eventContent={renderEventContent}
            eventClick={handleEventClick}
            dateClick={(info) => {
              const d = new Date(info.date);
              setSelectedDate(d);
            }}
            datesSet={(info) => {
              if (currentView === 'timeGridDay') {
                setSelectedDate(new Date(info.start));
              }
            }}
            slotMinTime="06:00:00"
            slotMaxTime="18:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            height="100%"
            allDaySlot={false}
            nowIndicator
            scrollTime="08:00:00"
            headerToolbar={false}
            eventMinHeight={24}
            expandRows
          />
        </div>
      </div>

      {/* Confirm complete modal */}
      <ConfirmModal
        open={showConfirm}
        title="Mark Schedule Completed"
        message={
          <>
            Mark <strong>"{selectedEvent?.title}"</strong> as completed?
            <br />
            <span className="text-xs text-zinc-400 mt-1 block">
              {selectedEvent?.date} · {formatTimeTo12H(selectedEvent?.startTime)} – {formatTimeTo12H(selectedEvent?.endTime)}
            </span>
          </>
        }
        onConfirm={handleConfirmDone}
        onCancel={() => setShowConfirm(false)}
      />

      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-xl px-8 py-6 shadow-2xl flex items-center gap-3 border border-zinc-200">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            <span className="text-sm font-medium text-zinc-700">Updating…</span>
          </div>
        </div>
      )}
    </div>
  );
}
