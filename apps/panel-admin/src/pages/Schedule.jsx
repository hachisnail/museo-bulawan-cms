import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getLocalDateString(date) {
  const d = new Date(date);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

function formatTimeTo12H(timeStr) {
  if (!timeStr || timeStr === 'Flexible') return timeStr || '—';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const TODAY = getLocalDateString(new Date());
const MOCK_EVENTS = [
  {
    id: 'schedule-1',
    title: 'Morning Tour Slot',
    start: `${TODAY}T09:00:00`,
    end: `${TODAY}T11:00:00`,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: '#D4AF37',
    textColor: '#78600a',
    extendedProps: { type: 'schedule', availability: 'SHARED', status: 'ACTIVE', isSchedule: true, description: 'General morning tour availability.' },
  },
  {
    id: 'schedule-2',
    title: 'Afternoon Reserved Block',
    start: `${TODAY}T13:00:00`,
    end: `${TODAY}T15:00:00`,
    backgroundColor: 'rgba(244,63,94,0.12)', // rose
    borderColor: '#f43f5e',
    textColor: '#9f1239',
    extendedProps: { type: 'schedule', availability: 'EXCLUSIVE', status: 'ACTIVE', isSchedule: true, description: 'Exclusive block for private event.' },
  },
  {
    id: 'appointment-1',
    title: 'Juan dela Cruz',
    start: `${TODAY}T09:30:00`,
    end: `${TODAY}T10:30:00`,
    backgroundColor: 'rgba(99,102,241,0.12)', // indigo
    borderColor: '#6366f1',
    textColor: '#3730a3',
    extendedProps: {
      type: 'appointment', isAppointment: true, status: 'APPROVED',
      organizer: 'Juan dela Cruz', purpose: 'School Field Trip',
      numPeople: '45 visitors', description: 'Group from Bulawan Elementary.',
    },
  },
  {
    id: 'appointment-2',
    title: 'Maria Santos',
    start: `${TODAY}T14:00:00`,
    end: `${TODAY}T15:00:00`,
    backgroundColor: 'rgba(99,102,241,0.12)',
    borderColor: '#6366f1',
    textColor: '#3730a3',
    extendedProps: {
      type: 'appointment', isAppointment: true, status: 'APPROVED',
      organizer: 'Maria Santos', purpose: 'Heritage Research',
      numPeople: '3 visitors', description: 'Researcher visit for artifact documentation.',
    },
  },
];

const MOCK_TODAY_TOURS = [
  { id: 'schedule-1', title: 'Morning Tour Slot', organizer: 'Schedule', startTime: '09:00', endTime: '11:00', isSchedule: true, isDone: false, hasFlexibleTime: false },
  { id: 'appointment-1', title: 'School Field Trip', organizer: 'Juan dela Cruz', startTime: '09:30', endTime: '10:30', isAppointment: true, isDone: false, hasFlexibleTime: false, numPeople: '45 visitors' },
  { id: 'schedule-2', title: 'Afternoon Reserved Block', organizer: 'Schedule', startTime: '13:00', endTime: '15:00', isSchedule: true, isDone: false, hasFlexibleTime: false },
  { id: 'appointment-2', title: 'Heritage Research', organizer: 'Maria Santos', startTime: '14:00', endTime: '15:00', isAppointment: true, isDone: true, hasFlexibleTime: false, numPeople: '3 visitors' },
];

// ─── Event Content Renderer ───────────────────────────────────────────────────
function renderEventContent(info) {
  const { type, organizer, purpose, numPeople } = info.event.extendedProps;
  const isAppt = type === 'appointment';
  const color = info.event.textColor || '#78600a';

  return (
    <div style={{ padding: '4px 8px', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ color, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {isAppt ? (organizer || info.event.title) : info.event.title}
      </div>
      {isAppt && purpose && (
        <div style={{ color, fontSize: '10px', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{purpose}</div>
      )}
      {numPeople && (
        <div style={{ color, fontSize: '10px', opacity: 0.7 }}>{numPeople}</div>
      )}
    </div>
  );
}

// ─── Live Clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 text-center shadow-lg transform transition-transform hover:scale-[1.02]">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10"></div>
      <div className="relative z-10">
        <div className="font-mono text-3xl font-bold text-white tracking-widest drop-shadow-md">
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-[#D4AF37] mt-2 font-medium">
          {time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
    </div>
  );
}

// ─── Tour Item ────────────────────────────────────────────────────────────────
function TourItem({ tour, isSelected, onSelect }) {
  const isAppt = tour.isAppointment;
  const isExcl = !isAppt && tour.availability === 'EXCLUSIVE';
  const accentColor = isAppt ? '#6366f1' : isExcl ? '#f43f5e' : '#D4AF37';
  const subtitle = isAppt ? tour.title : null;
  return (
    <div
      onClick={() => onSelect(tour)}
      className={`group flex items-start gap-4 p-4 cursor-pointer transition-all duration-300 border-l-4 ${isSelected ? 'bg-white border-[#D4AF37] shadow-md' : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm hover:border-zinc-300'}`}
    >
      <div style={{ width: '4px', height: '100%', minHeight: '32px', backgroundColor: accentColor, borderRadius: '4px', flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-bold uppercase tracking-wider truncate transition-colors ${isSelected ? 'text-zinc-900' : 'text-zinc-600 group-hover:text-zinc-900'}`}>
            {isAppt ? tour.organizer : tour.title}
          </span>
          {tour.isDone && (
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex-shrink-0 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Done
            </span>
          )}
        </div>
        {subtitle && (
          <div className={`text-[11px] truncate mt-1 transition-colors ${isSelected ? 'text-zinc-500' : 'text-zinc-400 group-hover:text-zinc-500'}`}>{subtitle}</div>
        )}
        <div className={`flex items-center gap-1.5 text-[10px] font-mono mt-2 transition-colors ${isSelected ? 'text-zinc-500' : 'text-zinc-400'}`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {tour.hasFlexibleTime ? 'Flexible' : `${formatTimeTo12H(tour.startTime)} – ${formatTimeTo12H(tour.endTime)}`}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({ event, onMarkDone, onMarkScheduleDone }) {
  if (!event) return (
    <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3 p-6 text-center bg-white rounded-xl shadow-sm border border-zinc-200">
      <div className="w-16 h-16 rounded-full bg-zinc-50 flex items-center justify-center mb-2 shadow-inner">
        <svg className="w-8 h-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
      </div>
      <span className="text-sm font-bold uppercase tracking-widest text-zinc-500">No event selected</span>
      <span className="text-xs text-zinc-400 leading-relaxed">Click an event on the calendar or in the list to view details</span>
    </div>
  );
  const props = event.extendedProps || event;
  const isAppt = props.isAppointment || props.type === 'appointment';
  const isExclusive = props.availability === 'EXCLUSIVE';
  const isDone = props.isDone || props.status === 'COMPLETED';

  return (
    <div className="p-6 space-y-6 flex flex-col h-full bg-white rounded-xl shadow-sm border border-zinc-200">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#D4AF37] mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span>
          {isAppt ? 'Appointment' : isExclusive ? 'Exclusive Block' : 'Schedule'}
        </div>
        <h3 className="text-xl font-serif font-bold text-zinc-900 leading-tight">
          {isAppt ? (props.organizer || event.title) : event.title}
        </h3>
        {isAppt && props.purpose && <p className="text-sm text-zinc-500 mt-1">{props.purpose}</p>}
      </div>

      <div className="space-y-4 text-sm flex-1">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Time</span>
          <span className="text-zinc-800 font-mono bg-zinc-50 py-1.5 px-3 rounded-md border border-zinc-100 inline-block w-fit">
            {formatTimeTo12H(event.startTime || getLocalDateString(event.start)?.slice(11, 16))} – {formatTimeTo12H(event.endTime || getLocalDateString(event.end)?.slice(11, 16))}
          </span>
        </div>
        {isAppt && props.numPeople && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Visitors</span>
            <span className="text-zinc-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              {props.numPeople}
            </span>
          </div>
        )}
        {!isAppt && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Type</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border w-fit ${isExclusive ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`}>
              {isExclusive ? 'Exclusive' : 'Shared'}
            </span>
          </div>
        )}
        {props.description && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold">Notes</span>
            <span className="text-zinc-600 text-sm leading-relaxed bg-zinc-50 p-3 rounded-md border border-zinc-100">{props.description}</span>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-zinc-100 mt-auto">
        {isDone ? (
          <div className="flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-3 rounded-md text-xs font-bold uppercase tracking-widest border border-emerald-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            Completed
          </div>
        ) : (
          <button
            onClick={isAppt ? onMarkDone : onMarkScheduleDone}
            className="w-full py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white text-xs font-bold uppercase tracking-widest rounded-md shadow-md hover:shadow-lg hover:-translate-y-0.5 hover:from-[#D4AF37] hover:to-[#c29d2b] transition-all duration-300"
          >
            Mark as Done
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ open, title, message, onConfirm, onCancel, danger }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity" onClick={onCancel} />
      <div className="relative bg-white border border-zinc-200 rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all scale-100 opacity-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-100">
          <h3 className="text-base font-serif font-bold uppercase tracking-widest text-zinc-900">{title}</h3>
        </div>
        <div className="px-6 py-6 text-sm text-zinc-600 leading-relaxed">{message}</div>
        <div className="px-6 py-5 bg-zinc-50 rounded-b-xl flex gap-3 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${danger ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700' : 'bg-gradient-to-r from-zinc-900 to-zinc-800 text-white hover:from-[#D4AF37] hover:to-[#c29d2b]'}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Schedule() {
  const navigate = useNavigate();
  const calendarRef = useRef(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedTour, setSelectedTour] = useState(null);
  const [events] = useState(MOCK_EVENTS);
  const [todayTours] = useState(MOCK_TODAY_TOURS);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentView, setCurrentView] = useState('timeGridDay');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  }, []);

  const handleEventClick = useCallback((info) => {
    const ev = info.event;
    setSelectedTour(null);
    setSelectedEvent({
      id: ev.id,
      title: ev.title,
      start: ev.start,
      end: ev.end,
      startTime: ev.start ? `${String(ev.start.getHours()).padStart(2, '0')}:${String(ev.start.getMinutes()).padStart(2, '0')}` : '',
      endTime: ev.end ? `${String(ev.end.getHours()).padStart(2, '0')}:${String(ev.end.getMinutes()).padStart(2, '0')}` : '',
      extendedProps: ev.extendedProps,
    });
  }, []);

  const handleTourSelect = useCallback((tour) => {
    if (selectedTour?.id === tour.id) {
      setSelectedTour(null);
      setSelectedEvent(null);
    } else {
      setSelectedTour(tour);
      setSelectedEvent({
        id: tour.id,
        title: tour.title,
        startTime: tour.startTime,
        endTime: tour.endTime,
        extendedProps: tour,
      });
    }
  }, [selectedTour]);

  const handleMarkDone = () => {
    if (!selectedEvent) return;
    const isAppt = selectedEvent.extendedProps?.isAppointment || selectedEvent.extendedProps?.type === 'appointment';
    if (isAppt) {
      navigate('/schedule/attendance');
    } else {
      setShowConfirm(true);
    }
  };

  const handleConfirmDone = () => {
    setShowConfirm(false);
    showToast('Schedule marked as completed.');
    setSelectedEvent(null);
  };

  const goToDate = (dir) => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    dir === 'prev' ? api.prev() : api.next();
    setSelectedDate(api.getDate());
  };

  const switchView = (view) => {
    calendarRef.current?.getApi()?.changeView(view);
    setCurrentView(view);
  };

  const dateLabel = selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="h-full flex flex-col gap-6" style={{ height: 'calc(100vh - 3.5rem)' }}>

      {/* ── Toast ── */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white text-xs font-medium px-6 py-4 rounded-md shadow-xl border border-zinc-700 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
          <svg className="w-5 h-5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          {toastMsg}
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          {/* Removed redundant SCHEDULE h1, only displaying the stylized date */}
          <h2 className="text-2xl font-serif text-zinc-900 tracking-wide">{dateLabel}</h2>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-[0.15em] font-medium">Manage daily museum events and tours</p>
        </div>
        <button
          onClick={() => navigate('/schedule/add')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white text-xs font-bold uppercase tracking-widest rounded-md shadow-md hover:shadow-lg hover:-translate-y-0.5 hover:from-[#D4AF37] hover:to-[#c29d2b] transition-all duration-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
          Add Schedule
        </button>
      </div>

      {/* ── Main Grid ── */}
      <div className="flex-1 flex gap-6 min-h-0">

        {/* Left Column */}
        <div className="flex flex-col gap-6 w-80 flex-shrink-0">

          {/* Live Clock */}
          <LiveClock />

          {/* Today's Tours */}
          <div className="bg-zinc-50/50 rounded-xl border border-zinc-200 flex flex-col flex-1 min-h-0 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-200 bg-white flex-shrink-0 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-500">Today's Tours</div>
              <div className="text-[10px] font-bold bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{todayTours.length}</div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 custom-scrollbar bg-white/50">
              {todayTours.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest">No tours today</div>
              ) : (
                todayTours.map(tour => (
                  <TourItem key={tour.id} tour={tour} isSelected={selectedTour?.id === tour.id} onSelect={handleTourSelect} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center — FullCalendar */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* View Toolbar */}
          <div className="flex items-center justify-between flex-shrink-0 bg-white p-2 rounded-xl shadow-sm border border-zinc-200">
            <div className="flex items-center gap-1.5 pl-2">
              <button onClick={() => goToDate('prev')} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
              </button>
              <button onClick={() => { calendarRef.current?.getApi()?.today(); setSelectedDate(new Date()); }} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-all">Today</button>
              <button onClick={() => goToDate('next')} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
            <div className="flex gap-1 bg-zinc-100 p-1 rounded-lg">
              {[{ key: 'timeGridDay', label: 'Day' }, { key: 'timeGridWeek', label: 'Week' }, { key: 'dayGridMonth', label: 'Month' }].map(v => (
                <button key={v.key} onClick={() => switchView(v.key)}
                  className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${currentView === v.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Container */}
          <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden relative p-1">
            <style>{`
              .fc { height: 100%; font-family: inherit; }
              .fc-theme-standard td, .fc-theme-standard th { border-color: #f4f4f5; }
              .fc-theme-standard .fc-scrollgrid { border-color: transparent; }
              .fc-col-header-cell { background: #fafafa; padding: 12px 0 !important; }
              .fc-col-header-cell-cushion { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #52525b; text-decoration: none !important; }
              .fc-timegrid-slot-label-cushion { font-size: 11px; color: #a1a1aa; font-family: monospace; padding-right: 8px; }
              .fc-timegrid-now-indicator-line { border-color: #D4AF37; border-width: 2px; }
              .fc-timegrid-now-indicator-arrow { border-top-color: #D4AF37; border-bottom-color: #D4AF37; }
              .fc-daygrid-day-number { font-size: 13px; font-weight: 500; color: #52525b; text-decoration: none !important; padding: 8px; }
              .fc-daygrid-day.fc-day-today { background: rgba(212,175,55,0.03) !important; }
              .fc-day-today .fc-daygrid-day-number { color: #D4AF37; font-weight: 800; background: rgba(212,175,55,0.1); border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; margin: 4px; padding: 0; }
              .fc-daygrid-event { border-radius: 4px; margin-top: 2px; transition: transform 0.2s; }
              .fc-daygrid-event:hover { transform: translateY(-1px); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
              .fc-timegrid-event { border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important; transition: transform 0.2s, box-shadow 0.2s; border-width: 1px; border-left-width: 4px; }
              .fc-timegrid-event:hover { transform: translateY(-1px); box-shadow: 0 4px 6px rgba(0,0,0,0.08) !important; z-index: 10 !important; }
              .fc-timegrid-event .fc-event-main { padding: 0; }
              .fc-event-title { font-size: 11px; display: none; }
              .fc-toolbar { display: none !important; }
              .fc-timegrid-slot-minor { border-top-style: dashed !important; border-color: #f4f4f5 !important; }
              .fc-scrollgrid-sync-inner { scrollbar-width: thin; scrollbar-color: #e4e4e7 transparent; }
              .fc-v-event { border: 1px solid currentColor; }
              .custom-scrollbar::-webkit-scrollbar { width: 6px; }
              .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
              .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e4e4e7; border-radius: 20px; }
            `}</style>
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="timeGridDay"
              initialDate={new Date()}
              events={events}
              eventContent={renderEventContent}
              eventClick={handleEventClick}
              dateClick={(info) => setSelectedDate(new Date(info.date))}
              datesSet={(info) => setSelectedDate(info.start)}
              slotMinTime="06:00:00"
              slotMaxTime="18:00:00"
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              height="100%"
              allDaySlot={false}
              nowIndicator={true}
              scrollTime="08:00:00"
              headerToolbar={false}
            />
          </div>
        </div>

        {/* Right Column — Detail Panel */}
        <div className="w-80 flex-shrink-0 flex flex-col min-h-0">
          <DetailPanel
            event={selectedEvent}
            onMarkDone={handleMarkDone}
            onMarkScheduleDone={() => setShowConfirm(true)}
          />
        </div>
      </div>

      <ConfirmModal
        open={showConfirm}
        title="Mark Schedule Completed"
        message={`Are you sure you want to mark "${selectedEvent?.title}" as completed? This action cannot be undone.`}
        onConfirm={handleConfirmDone}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
