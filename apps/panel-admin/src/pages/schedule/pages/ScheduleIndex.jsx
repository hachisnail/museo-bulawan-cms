import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  ChevronLeft, ChevronRight, Plus, Users, Clock,
  CheckCircle2, Ban, Loader2, CalendarDays, X,
  ArrowRight, Tag, Calendar,
} from 'lucide-react';
import MiniCal from '../../../components/MiniCal';
import { useAuth } from '../../../context/authContext';
import { useSSE } from '../../../hooks/useSSE';
import {
  getLocalDateString, formatTimeTo12H,
  normalizeSchedule, normalizeAppointment, toFCEvent,
} from '../../../utils/scheduleUtils';

const GOLD = '#D4AF37';

// ─── Type helpers ─────────────────────────────────────────────────────────────
function getTypeInfo(ev) {
  const isAppt    = ev.isAppointment;
  const isDisabled = ev.isDisabledDay;
  const isExcl    = ev.availability === 'EXCLUSIVE' && !isDisabled;
  const color = isDisabled ? '#f43f5e'
    : isAppt  ? '#6366f1'
    : isExcl  ? '#f97316'
    : '#71717a';
  const bg = isDisabled ? 'rgba(244,63,94,0.07)'
    : isAppt  ? 'rgba(99,102,241,0.07)'
    : isExcl  ? 'rgba(249,115,22,0.07)'
    : 'rgba(113,113,122,0.06)';
  const label = isDisabled ? 'Closed' : isAppt ? 'Appointment' : isExcl ? 'Exclusive' : 'Schedule';
  return { color, bg, label, isAppt, isDisabled, isExcl };
}

// ─── FullCalendar CSS ─────────────────────────────────────────────────────────
const FC_STYLES = `
  .sch-cal { height: 100%; }
  .sch-cal .fc { height: 100%; font-family: inherit; }
  .sch-cal .fc-toolbar { display: none !important; }

  /* Grid */
  .sch-cal .fc-theme-standard td,
  .sch-cal .fc-theme-standard th { border-color: #f0f0f0; }
  .sch-cal .fc-theme-standard .fc-scrollgrid { border: none; }

  /* Column header */
  .sch-cal .fc-col-header-cell {
    background: #fafafa;
    border-bottom: 1px solid #efefef !important;
  }
  .sch-cal .fc-col-header-cell-cushion {
    font-size: 10px; font-weight: 800; text-transform: uppercase;
    letter-spacing: 0.18em; color: #a1a1aa; text-decoration: none !important;
    padding: 11px 8px 9px; display: block; text-align: center;
  }
  .sch-cal .fc-day-today .fc-col-header-cell { background: #fffcf0 !important; }
  .sch-cal .fc-day-today .fc-col-header-cell-cushion {
    color: #18181b !important; font-weight: 900;
  }

  /* Time labels */
  .sch-cal .fc-timegrid-slot-label-cushion {
    font-size: 9px; color: #d4d4d8; font-family: ui-monospace, monospace;
    padding-right: 14px; font-weight: 600; letter-spacing: 0.05em;
    user-select: none;
  }

  /* Slot lines */
  .sch-cal .fc-timegrid-slot { border-color: #f5f5f5 !important; }
  .sch-cal .fc-timegrid-slot-minor { border-top: 1px dashed #f0f0f0 !important; }

  /* Event blocks */
  .sch-cal .fc-timegrid-event {
    border-radius: 6px !important;
    border-top: none !important;
    border-right: none !important;
    border-bottom: none !important;
    border-left-width: 3px !important;
    box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03) !important;
    cursor: pointer;
    transition: box-shadow 0.15s ease, transform 0.1s ease !important;
  }
  .sch-cal .fc-timegrid-event:hover {
    box-shadow: 0 6px 20px rgba(0,0,0,0.12) !important;
    z-index: 10 !important;
    transform: translateY(-1px) scale(1.01);
  }
  .sch-cal .fc-timegrid-event .fc-event-main { padding: 0; overflow: hidden; }
  .sch-cal .fc-event-title { display: none; }
  .sch-cal .fc-v-event { background: transparent; }

  /* Today column */
  .sch-cal .fc-day-today { background: rgba(212,175,55,0.012) !important; }

  /* Scroller */
  .sch-cal .fc-scrollgrid-section-header th { border-bottom: 1px solid #efefef !important; }
  .sch-cal .fc-scrollgrid-liquid { height: 100% !important; }
  .sch-cal .fc-scroller-liquid-absolute { overflow: hidden !important; }
  .sch-cal .fc-scroller { overflow: hidden !important; }

  /* Selected event highlight */
  .sch-cal .fc-event-selected {
    box-shadow: 0 0 0 3px ${GOLD}60 !important;
  }
`;

// ─── FC event content ─────────────────────────────────────────────────────────
function renderEventContent(info) {
  const p = info.event.extendedProps;
  const { color, bg, label, isAppt } = getTypeInfo(p);
  const isWeek = info.view.type === 'timeGridWeek';
  const mainLabel = isAppt ? (p.organizer || info.event.title) : info.event.title;
  const sub = isAppt && p.numPeople ? `${p.numPeople} pax` : null;

  // Week view: ultra-compact — just type dot + name
  if (isWeek) {
    return (
      <div style={{
        background: bg,
        height: '100%',
        padding: '3px 5px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '1px',
        overflow: 'hidden',
      }}>
        <div style={{
          fontSize: '7px', fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color, lineHeight: 1, opacity: 0.8,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: '9.5px', fontWeight: 700,
          color: '#18181b',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.2,
        }}>
          {mainLabel}
        </div>
      </div>
    );
  }

  // Day view: full content
  return (
    <div style={{
      background: bg,
      height: '100%',
      padding: '4px 7px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '2px',
      overflow: 'hidden',
    }}>
      <div style={{
        fontSize: '7.5px', fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.09em',
        color, lineHeight: 1, opacity: 0.85,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '11px', fontWeight: 700,
        color: '#18181b',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        lineHeight: 1.25,
      }}>
        {mainLabel}
      </div>
      {sub && (
        <div style={{
          fontSize: '9px', color: '#71717a',
          fontWeight: 600, lineHeight: 1,
          display: 'flex', alignItems: 'center', gap: '3px',
        }}>
          <span>👤</span>{sub}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar compact event row ────────────────────────────────────────────────
function SidebarEvent({ ev, isSelected, onClick }) {
  const { color, label, isAppt, isDisabled } = getTypeInfo(ev);
  const timeStr = isDisabled ? 'All Day'
    : ev.hasFlexibleTime ? 'Flexible'
    : `${formatTimeTo12H(ev.startTime)} – ${formatTimeTo12H(ev.endTime)}`;

  return (
    <button
      onClick={onClick}
      style={{ borderLeftColor: isSelected ? GOLD : 'transparent' }}
      className={`w-full text-left px-3 py-2.5 border-l-[3px] transition-all flex items-start gap-2.5
        ${isSelected ? 'bg-amber-50/70' : 'hover:bg-zinc-50'}`}
    >
      {/* Type dot */}
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
        style={{ backgroundColor: isSelected ? GOLD : color }}
      />
      <div className="flex-1 min-w-0">
        {/* Type label */}
        <div
          className="text-[7.5px] font-black uppercase tracking-[0.18em] leading-none mb-0.5"
          style={{ color: isSelected ? GOLD : color }}
        >
          {label}
        </div>
        {/* Name */}
        <div className="text-[11px] font-semibold text-zinc-800 truncate leading-tight">
          {isAppt ? ev.organizer : ev.title}
        </div>
        {/* Time */}
        <div className="text-[9px] text-zinc-400 font-mono mt-0.5">{timeStr}</div>
      </div>
      {/* Pax */}
      {isAppt && ev.numPeople != null && (
        <div className="flex items-center gap-0.5 text-[9px] text-zinc-400 flex-shrink-0 mt-0.5">
          <Users className="w-2.5 h-2.5" />
          <span className="tabular-nums">{ev.numPeople}</span>
        </div>
      )}
    </button>
  );
}

// ─── Event Detail Panel (right slide-in) ─────────────────────────────────────
function EventDetailPanel({ ev, onClose, onAction, isSubmitting }) {
  const { color, label, isAppt, isDisabled, isExcl } = getTypeInfo(ev);
  const isDone   = ev.isDone || ev.status === 'COMPLETED';
  const timeStr  = isDisabled ? 'All Day'
    : ev.hasFlexibleTime ? 'Flexible time'
    : `${formatTimeTo12H(ev.startTime)} – ${formatTimeTo12H(ev.endTime)}`;

  const statusMap = {
    ACTIVE:    ['bg-emerald-50 text-emerald-600 border-emerald-100', '● Active'],
    COMPLETED: ['bg-zinc-100 text-zinc-400 border-zinc-200', '✓ Completed'],
    APPROVED:  ['bg-blue-50 text-blue-600 border-blue-100', '● Approved'],
    PENDING:   ['bg-amber-50 text-amber-600 border-amber-100', '◌ Pending'],
    REJECTED:  ['bg-rose-50 text-rose-600 border-rose-100', '✕ Rejected'],
    CANCELLED: ['bg-zinc-100 text-zinc-400 border-zinc-200', '— Cancelled'],
  };
  const [statusCls, statusLabel] = statusMap[ev.status] || ['bg-zinc-100 text-zinc-400 border-zinc-200', ev.status];

  return (
    <div className="w-64 flex-shrink-0 flex flex-col border-l border-zinc-100 bg-white overflow-hidden">

      {/* Panel header */}
      <div
        className="flex-shrink-0 px-4 py-3.5 border-b border-zinc-100 flex items-start gap-2"
        style={{ borderTop: `3px solid ${color}` }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="text-[8px] font-black uppercase tracking-[0.2em] leading-none mb-1"
            style={{ color }}
          >
            {label}
          </div>
          <div className="text-[13px] font-bold text-zinc-900 leading-snug">
            {isAppt ? ev.organizer : ev.title}
          </div>
          {isAppt && ev.title && (
            <div className="text-[10px] text-zinc-400 mt-0.5 truncate">{ev.title}</div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-zinc-100 text-zinc-300 hover:text-zinc-600 transition-colors flex-shrink-0 -mt-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status */}
      <div className="px-4 pt-3">
        {isDisabled ? (
          <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-rose-50 text-rose-500 border border-rose-100">
            <Ban className="w-2.5 h-2.5" /> Date Closed
          </span>
        ) : (
          <span className={`inline-flex items-center text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${statusCls}`}>
            {statusLabel}
          </span>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">

        {/* Date */}
        <div className="flex items-start gap-3">
          <Calendar className="w-3.5 h-3.5 text-zinc-300 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Date</div>
            <div className="text-[11px] text-zinc-700 mt-0.5 leading-snug">
              {new Date(ev.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </div>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-start gap-3">
          <Clock className="w-3.5 h-3.5 text-zinc-300 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Time</div>
            <div className="text-[11px] text-zinc-700 font-mono mt-0.5">{timeStr}</div>
          </div>
        </div>

        {/* Group size */}
        {isAppt && ev.numPeople != null && (
          <div className="flex items-start gap-3">
            <Users className="w-3.5 h-3.5 text-zinc-300 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Group Size</div>
              <div className="text-[11px] text-zinc-700 mt-0.5">
                {ev.numPeople} visitor{ev.numPeople !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        )}

        {/* Availability (schedules) */}
        {!isAppt && !isDisabled && (
          <div className="flex items-start gap-3">
            <Tag className="w-3.5 h-3.5 text-zinc-300 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-[8px] font-black uppercase tracking-wider text-zinc-400">Availability</div>
              <div className="text-[11px] text-zinc-700 mt-0.5">
                {isExcl ? 'Exclusive — No appointments' : 'Shared — Open to appointments'}
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        {ev.description && (
          <div className="rounded-xl bg-zinc-50 border border-zinc-100 p-3">
            <div className="text-[8px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">Notes</div>
            <p className="text-[10px] text-zinc-600 leading-relaxed">{ev.description}</p>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-zinc-50">
        {isDone || isDisabled ? (
          <div className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest border
            ${isDisabled ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
            {isDisabled ? <Ban className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {isDisabled ? 'Date Closed' : 'Completed'}
          </div>
        ) : (
          <button
            onClick={onAction}
            disabled={isSubmitting}
            style={{ backgroundColor: isAppt ? '#6366f1' : GOLD }}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
            {isAppt ? 'Open Appointment' : 'Mark Completed'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-900">{title}</h3>
        </div>
        <div className="px-6 py-5 text-sm text-zinc-600 leading-relaxed">{message}</div>
        <div className="px-6 py-4 bg-zinc-50 flex gap-3 justify-end border-t border-zinc-100">
          <button onClick={onCancel} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2.5 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-zinc-800 transition-all shadow-sm"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Schedule() {
  const navigate     = useNavigate();
  const location     = useLocation();
  const calRef       = useRef(null);
  const { apiFetch } = useAuth();

  const [selectedDate, setSelectedDate]   = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [currentView, setCurrentView]     = useState('timeGridDay');
  const [toast, setToast]                 = useState({ text: '', type: 'success' });
  const [isLoading, setIsLoading]         = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [allSchedules, setAllSchedules]   = useState([]);
  const [allAppointments, setAllAppointments] = useState([]);

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast({ text: '', type: 'success' }), 3500);
  }, []);

  const dateStr = getLocalDateString(selectedDate);

  // ── SSE ────────────────────────────────────────────────────────────────────
  const { events: sseEvents } = useSSE('*');
  useEffect(() => {
    if (!sseEvents.length) return;
    const res = sseEvents[0]?.resource;
    if (res === 'Schedule' || res === 'Appointment' || res === 'AppointmentStatus') fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sseEvents]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
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
        // Deduplicate by appointment_id (JOIN can return multiple rows)
        const seen = new Set();
        const unique = (Array.isArray(raw) ? raw : []).filter(a => {
          if (seen.has(a.appointment_id)) return false;
          seen.add(a.appointment_id);
          return true;
        });
        setAllAppointments(unique.map(normalizeAppointment));
      }
    } catch {
      showToast('Failed to load schedule data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, showToast]);

  useEffect(() => { fetchAllData(); }, []);

  // ── Dashboard auto-select ──────────────────────────────────────────────────
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

  // ── Derived ────────────────────────────────────────────────────────────────
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
    const seenIds = new Set();
    return allEvents
      .filter(ev => {
        if (seenIds.has(ev.id)) return false;
        seenIds.add(ev.id);
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
    schedules:    allEvents.filter(e => e.isSchedule && !e.isDisabledDay && e.date === dateStr && e.status !== 'COMPLETED').length,
    appointments: allEvents.filter(e => e.isAppointment && e.status === 'APPROVED' && e.date === dateStr).length,
    visitors:     allEvents.filter(e => e.isAppointment && e.status === 'APPROVED' && e.date === dateStr)
                           .reduce((s, e) => s + (e.numPeople || 0), 0),
  }), [allEvents, dateStr]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleEventClick = useCallback((info) => {
    const ev = info.event.extendedProps;
    setSelectedEvent(prev => prev?.id === ev.id ? null : ev);
  }, []);

  const handleDateChange = useCallback((date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    calRef.current?.getApi()?.gotoDate(date);
  }, []);

  const handleAction = useCallback((ev) => {
    if (!ev) return;
    if (ev.isAppointment) {
      navigate(`/appointments/${ev.appointment_id}`, { state: { autoAction: 'arrive' } });
    } else {
      setShowConfirm(true);
    }
  }, [navigate]);

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
    setSelectedDate(new Date(api.getDate()));
  };

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
    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, currentView]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-white" style={{ height: 'calc(100vh - 4rem)', overflow: 'hidden' }}>
      <style>{FC_STYLES}</style>

      {/* Toast */}
      {toast.text && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold border
          ${toast.type === 'error' ? 'bg-red-500 text-white border-red-600' : 'bg-zinc-900 text-white border-zinc-700'}`}>
          <CheckCircle2 className="w-3.5 h-3.5 opacity-60" />
          {toast.text}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 h-14 flex items-center gap-3 px-5 border-b border-zinc-100 bg-white">

        {/* Title */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div>
            <h1 className="text-sm font-black tracking-tight text-zinc-900 font-serif">Schedule</h1>
            <p className="text-[8px] text-zinc-400 uppercase tracking-[0.22em]">Visitor Program</p>
          </div>
          <div className="w-px h-6 bg-zinc-200" />
        </div>

        {/* Date nav */}
        <div className="flex items-center gap-0.5 bg-zinc-100 rounded-lg p-0.5">
          <button onClick={() => goDir('prev')} className="p-1.5 rounded-md hover:bg-white text-zinc-500 hover:text-zinc-900 hover:shadow-sm transition-all">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              calRef.current?.getApi()?.today();
              setSelectedDate(new Date());
              setSelectedEvent(null);
            }}
            className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-900 hover:bg-white hover:shadow-sm rounded-md transition-all"
          >
            Today
          </button>
          <button onClick={() => goDir('next')} className="p-1.5 rounded-md hover:bg-white text-zinc-500 hover:text-zinc-900 hover:shadow-sm transition-all">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Date label */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-900">{dateLabel}</span>
          {isDateDisabled && currentView === 'timeGridDay' && (
            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase tracking-widest bg-rose-50 text-rose-500 border border-rose-100 px-2 py-0.5 rounded-full">
              <Ban className="w-2 h-2" /> Closed
            </span>
          )}
        </div>

        <div className="flex-1" />

        {isLoading && <Loader2 className="w-3.5 h-3.5 text-zinc-300 animate-spin" />}

        {/* View toggle */}
        <div className="flex bg-zinc-100 rounded-lg p-0.5 gap-0.5">
          {[{ key: 'timeGridDay', label: 'Day' }, { key: 'timeGridWeek', label: 'Week' }].map(v => (
            <button
              key={v.key}
              onClick={() => switchView(v.key)}
              className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all
                ${currentView === v.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Add */}
        <button
          onClick={() => navigate('/schedule/add')}
          style={{ backgroundColor: GOLD }}
          className="flex items-center gap-1.5 px-3.5 py-2 text-white text-[9px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add Schedule
        </button>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
        <aside className="w-52 flex-shrink-0 flex flex-col border-r border-zinc-100 bg-white overflow-hidden">

          {/* Mini cal */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <MiniCal
              value={selectedDate}
              onChange={handleDateChange}
              allSchedules={allSchedules}
              allAppointments={allAppointments}
              compact
            />
          </div>

          {/* Stats */}
          <div className="mx-3 mb-3 rounded-xl border border-zinc-100 bg-zinc-50/70 flex divide-x divide-zinc-100 flex-shrink-0 overflow-hidden">
            <div className="flex-1 flex flex-col items-center py-2">
              <span className="text-sm font-black text-zinc-900 tabular-nums">{dateStats.schedules}</span>
              <span className="text-[7.5px] uppercase tracking-[0.14em] text-zinc-400 font-bold mt-0.5">Slots</span>
            </div>
            <div className="flex-1 flex flex-col items-center py-2">
              <span className="text-sm font-black text-indigo-500 tabular-nums">{dateStats.appointments}</span>
              <span className="text-[7.5px] uppercase tracking-[0.14em] text-zinc-400 font-bold mt-0.5">Appts</span>
            </div>
            <div className="flex-1 flex flex-col items-center py-2">
              <span className="text-sm font-black tabular-nums" style={{ color: GOLD }}>{dateStats.visitors}</span>
              <span className="text-[7.5px] uppercase tracking-[0.14em] text-zinc-400 font-bold mt-0.5">Visitors</span>
            </div>
          </div>

          {/* Day events header */}
          <div className="px-3 pb-1.5 flex items-center justify-between flex-shrink-0">
            <span className="text-[7.5px] font-black uppercase tracking-[0.2em] text-zinc-400">
              {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            <span className="text-[7.5px] font-black bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full tabular-nums">
              {todayEvents.length}
            </span>
          </div>

          {/* Event list */}
          <div className="flex-1 overflow-y-auto border-t border-zinc-100">
            {isLoading && allEvents.length === 0 ? (
              <div className="p-6 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-zinc-200 animate-spin" />
              </div>
            ) : todayEvents.length === 0 ? (
              <div className="p-6 text-center flex flex-col items-center gap-2">
                <CalendarDays className="w-7 h-7 text-zinc-200" />
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-300">No events</p>
                  <p className="text-[8px] text-zinc-300 mt-0.5">on this date</p>
                </div>
              </div>
            ) : (
              todayEvents.map(ev => (
                <SidebarEvent
                  key={ev.id}
                  ev={ev}
                  isSelected={selectedEvent?.id === ev.id}
                  onClick={() => setSelectedEvent(prev => prev?.id === ev.id ? null : ev)}
                />
              ))
            )}
          </div>

          {/* Legend */}
          <div className="px-3 py-2.5 border-t border-zinc-100 flex-shrink-0 flex flex-wrap gap-x-2.5 gap-y-1">
            {[
              { color: '#71717a', label: 'Schedule' },
              { color: '#6366f1', label: 'Appt' },
              { color: '#f97316', label: 'Excl' },
              { color: '#f43f5e', label: 'Closed' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[7.5px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Calendar ─────────────────────────────────────────────────────── */}
        <div className={`sch-cal flex-1 min-w-0 overflow-hidden relative
          ${isDateDisabled && currentView === 'timeGridDay' ? 'ring-1 ring-inset ring-rose-100' : ''}`}>

          {isDateDisabled && currentView === 'timeGridDay' && (
            <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-md pointer-events-none">
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
              setSelectedDate(new Date(info.date));
              setSelectedEvent(null);
            }}
            datesSet={(info) => {
              if (currentView === 'timeGridDay') setSelectedDate(new Date(info.start));
            }}
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            slotDuration="00:30:00"
            slotLabelInterval="01:00:00"
            height="100%"
            allDaySlot={false}
            headerToolbar={false}
            eventMinHeight={28}
            expandRows
          />
        </div>

        {/* ── Detail Panel ─────────────────────────────────────────────────── */}
        {selectedEvent && (
          <EventDetailPanel
            ev={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onAction={() => handleAction(selectedEvent)}
            isSubmitting={isSubmitting}
          />
        )}
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={showConfirm}
        title="Mark Schedule Completed"
        message={
          <>
            Mark <strong>&ldquo;{selectedEvent?.title}&rdquo;</strong> as completed?
            <br />
            <span className="text-xs text-zinc-400 mt-1 block font-mono">
              {selectedEvent?.date} · {formatTimeTo12H(selectedEvent?.startTime)} – {formatTimeTo12H(selectedEvent?.endTime)}
            </span>
          </>
        }
        onConfirm={handleConfirmDone}
        onCancel={() => setShowConfirm(false)}
      />

      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-8 py-6 shadow-2xl flex items-center gap-3 border border-zinc-100">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
            <span className="text-sm font-semibold text-zinc-700">Updating…</span>
          </div>
        </div>
      )}
    </div>
  );
}
