import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

function getLocalDateString(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

const MOCK_DAY_EVENTS = [
  { id: 's1', title: 'Morning Tour Slot', startTime: '09:00', endTime: '11:00', isSchedule: true, availability: 'SHARED', status: 'ACTIVE' },
  { id: 'a1', title: 'School Field Trip', startTime: '09:30', endTime: '10:30', isAppointment: true, organizer: 'Juan dela Cruz', numPeople: '45 visitors' },
];
const MOCK_CAL_EVENTS = [
  { date: getLocalDateString(new Date()), count: 2 }
];

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="fixed top-6 right-6 z-50 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white text-xs font-medium px-6 py-4 rounded-md shadow-xl border border-zinc-700 flex items-center gap-3 animate-in slide-in-from-top-2 fade-in duration-300">
      <svg className="w-5 h-5 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      {msg}
    </div>
  );
}

function ConfirmModal({ open, title, children, onConfirm, onCancel, confirmDisabled, confirmLabel = 'Confirm', danger }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm transition-opacity" onClick={onCancel} />
      <div className="relative bg-white border border-zinc-200 rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all scale-100 opacity-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-100">
          <h3 className="text-base font-serif font-bold uppercase tracking-widest text-zinc-900">{title}</h3>
        </div>
        <div className="px-6 py-6 text-sm text-zinc-600 leading-relaxed space-y-2">{children}</div>
        <div className="px-6 py-5 bg-zinc-50 rounded-b-xl flex gap-3 justify-end">
          <button onClick={onCancel} className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={confirmDisabled}
            className={`px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded-md shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-sm disabled:cursor-not-allowed ${danger ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700' : 'bg-gradient-to-r from-zinc-900 to-zinc-800 text-white hover:from-[#D4AF37] hover:to-[#c29d2b]'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 ml-0.5">{children}</label>;
}
function TextInput({ value, onChange, placeholder, disabled }) {
  return (
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed" />
  );
}
function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 focus:bg-white transition-all resize-none" />
  );
}
function TimeInput({ value, onChange, label, min = '06:00', max = '18:00' }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input type="time" value={value} min={min} max={max} onChange={e => onChange(e.target.value)}
        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 text-sm text-zinc-800 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/20 focus:bg-white transition-all font-mono" />
    </div>
  );
}

export default function ScheduleAdd() {
  const navigate = useNavigate();
  const calRef = useRef(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [mode, setMode] = useState('add');       // 'add' | 'close'
  const [closeType, setCloseType] = useState('day'); // 'day' | 'time'
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [reason, setReason] = useState('');
  const [closeTitle, setCloseTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [canConfirm, setCanConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    setIsDirty(title !== '' || desc !== '' || startTime !== '' || endTime !== '');
  }, [title, desc, startTime, endTime]);

  const switchMode = (m) => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Discard them?')) return;
    }
    setMode(m); setTitle(''); setDesc(''); setReason(''); setCloseTitle(''); setStartTime(''); setEndTime(''); setIsDirty(false);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) { showToast('Title is required'); return; }
    if (!startTime || !endTime) { showToast('Please select start and end times'); return; }
    if (startTime >= endTime) { showToast('End time must be after start time'); return; }
    setShowAddConfirm(true);
  };

  const handleCloseSubmit = (e) => {
    e.preventDefault();
    if (closeType === 'time' && (!startTime || !endTime)) { showToast('Please select start and end times'); return; }
    if (closeType === 'time' && startTime >= endTime) { showToast('End time must be after start time'); return; }
    setCountdown(5); setCanConfirm(false); setShowCloseConfirm(true);
    const iv = setInterval(() => setCountdown(p => { if (p <= 1) { clearInterval(iv); setCanConfirm(true); return 0; } return p - 1; }), 1000);
  };

  const confirmAdd = async () => {
    setIsLoading(true); setShowAddConfirm(false);
    await new Promise(r => setTimeout(r, 800));
    setIsLoading(false);
    showToast('Schedule added successfully!');
    setTitle(''); setDesc(''); setStartTime(''); setEndTime(''); setIsDirty(false);
  };

  const confirmClose = async () => {
    setIsLoading(true); setShowCloseConfirm(false);
    await new Promise(r => setTimeout(r, 800));
    setIsLoading(false);
    showToast(closeType === 'day' ? 'Date disabled successfully!' : 'Time slot closed successfully!');
    setReason(''); setCloseTitle(''); setStartTime(''); setEndTime(''); setIsDirty(false);
  };

  const dateLabel = selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const existingDisabledDay = false; // TODO: check from real data

  return (
    <div className="flex flex-col gap-6" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <Toast msg={toast} />

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-zinc-900 tracking-wide">Configure Dates & Times</h2>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-[0.15em] font-medium">Add new blocks or set dates as unavailable</p>
        </div>
        <button onClick={() => navigate('/schedule')}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-zinc-200 text-zinc-600 text-xs font-bold uppercase tracking-widest rounded-md hover:border-zinc-300 hover:text-zinc-900 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
          Back to Schedule
        </button>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">

        {/* Left — Calendar */}
        <div className="col-span-5 bg-white rounded-xl shadow-sm border border-zinc-200 flex flex-col min-h-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 flex-shrink-0 bg-zinc-50/50">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">Select Date to Edit</div>
            <div className="text-lg font-serif font-bold text-zinc-800 mt-1">{dateLabel}</div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden p-4">
            <style>{`
              .fc { height: 100%; font-family: inherit; }
              .fc-toolbar { display:none !important; }
              .fc-theme-standard td,.fc-theme-standard th { border-color: #f4f4f5; }
              .fc-theme-standard .fc-scrollgrid { border-color: transparent; }
              .fc-col-header-cell-cushion { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.15em; color:#52525b; padding: 12px 0; text-decoration:none !important; }
              .fc-daygrid-day-number { font-size:13px; font-weight:500; color:#52525b; text-decoration:none !important; padding: 8px; }
              .fc-daygrid-day.fc-day-today { background:rgba(212,175,55,.03) !important; }
              .fc-day-today .fc-daygrid-day-number { color:#D4AF37; font-weight:800; background:rgba(212,175,55,.1); border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; margin:4px; padding:0; }
              .fc-daygrid-day-frame { cursor: pointer; transition: background-color 0.2s; }
              .fc-daygrid-day-frame:hover { background-color: #fafafa; }
              .add-sched-selected-day .fc-daygrid-day-frame { background: rgba(212,175,55,.08) !important; }
              .add-sched-selected-day .fc-daygrid-day-top { border-radius: 4px; }
              .add-sched-selected-day .fc-daygrid-day-number { color: #92750a; font-weight: 700; }
            `}</style>
            <FullCalendar
              ref={calRef}
              plugins={[dayGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={false}
              height="100%"
              dateClick={(info) => setSelectedDate(new Date(info.date))}
              dayCellClassNames={(arg) => getLocalDateString(arg.date) === getLocalDateString(selectedDate) ? ['add-sched-selected-day'] : []}
              events={MOCK_CAL_EVENTS.map(e => ({
                start: e.date, allDay: true, display: 'background',
                backgroundColor: 'rgba(212,175,55,0.15)',
              }))}
              showNonCurrentDates={false}
            />
          </div>
        </div>

        {/* Middle — Day Events */}
        <div className="col-span-3 bg-white rounded-xl shadow-sm border border-zinc-200 flex flex-col min-h-0 overflow-hidden">
          <div className="px-6 py-5 border-b border-zinc-100 flex-shrink-0 bg-zinc-50/50">
            <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">Events Overview</div>
            <div className="text-lg font-serif font-bold text-zinc-800 mt-1">{dateLabel}</div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {MOCK_DAY_EVENTS.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 uppercase tracking-widest font-medium">No events scheduled</div>
            ) : MOCK_DAY_EVENTS.map(ev => {
              const isAppt = ev.isAppointment;
              const isExcl = ev.availability === 'EXCLUSIVE';
              const accent = isAppt ? '#6366f1' : isExcl ? '#f43f5e' : '#D4AF37';
              const tagCls = isAppt ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : isExcl ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-[#92750a] bg-[#D4AF37]/10 border-[#D4AF37]/30';
              return (
                <div key={ev.id} onClick={() => setSelectedSchedule(ev)}
                  className={`group p-4 cursor-pointer transition-all duration-300 flex gap-3 ${selectedSchedule?.id === ev.id ? 'bg-[#D4AF37]/5' : 'hover:bg-zinc-50'}`}>
                  <div style={{ width: '4px', backgroundColor: accent, borderRadius: '4px', flexShrink: 0, alignSelf: 'stretch' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-800 truncate">{isAppt ? ev.organizer : ev.title}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border flex-shrink-0 ${tagCls}`}>{isAppt ? 'Appt' : isExcl ? 'Excl' : 'Shared'}</span>
                    </div>
                    {isAppt && <div className="text-[11px] text-zinc-500 truncate mt-1">{ev.title}</div>}
                    <div className="text-[11px] font-mono text-zinc-500 mt-2 bg-zinc-100 inline-block px-2 py-0.5 rounded-sm">{fmt12(ev.startTime)} – {fmt12(ev.endTime)}</div>
                    {isAppt && ev.numPeople && <div className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>{ev.numPeople}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Selected event detail preview */}
          {selectedSchedule && (
            <div className="border-t border-zinc-200 p-5 bg-zinc-50 flex-shrink-0">
              <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400 mb-2">Event Preview</div>
              <div className="text-sm font-bold text-zinc-800">{selectedSchedule.isAppointment ? selectedSchedule.organizer : selectedSchedule.title}</div>
              {selectedSchedule.isAppointment && <div className="text-xs text-zinc-500 mt-1">{selectedSchedule.title}</div>}
              <div className="text-xs font-mono text-zinc-600 mt-2">{fmt12(selectedSchedule.startTime)} – {fmt12(selectedSchedule.endTime)}</div>
            </div>
          )}
        </div>

        {/* Right — Form */}
        <div className="col-span-4 bg-white rounded-xl shadow-sm border border-zinc-200 flex flex-col min-h-0 overflow-y-auto relative">
          <div className="flex-shrink-0 bg-white sticky top-0 z-10">
            {/* Mode tabs */}
            <div className="flex border-b border-zinc-200">
              <button onClick={() => switchMode('add')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${mode === 'add' ? 'bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shadow-inner' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'}`}>
                Add Schedule
              </button>
              <button onClick={() => switchMode('close')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all duration-300 ${mode === 'close' ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-inner' : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'}`}>
                Close Date
              </button>
            </div>
          </div>

          <div className="flex-1 p-6 space-y-6">
            <div>
              <div className="text-xl font-serif font-bold text-zinc-900">
                {mode === 'add' ? 'New Schedule Block' : `Manage Closure`}
              </div>
              <div className="text-xs font-medium uppercase tracking-[0.15em] text-[#D4AF37] mt-1">{dateLabel}</div>
            </div>

            {/* Add Schedule mode */}
            {mode === 'add' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="p-4 mb-6 border border-[#D4AF37]/30 bg-[#D4AF37]/5 rounded-lg space-y-2 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-[#92750a] mb-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Guidelines
                  </div>
                  {['Operating hours: 6:00 AM – 6:00 PM', 'Minimum duration: 15 minutes', 'Added schedules allow visitor appointments'].map(r => (
                    <div key={r} className="text-xs text-[#92750a] flex gap-2 items-start"><span className="text-[10px] mt-0.5 opacity-60">●</span><span>{r}</span></div>
                  ))}
                </div>
                <form onSubmit={handleAddSubmit} className="space-y-5">
                  <div><FieldLabel>Schedule Title *</FieldLabel><TextInput value={title} onChange={setTitle} placeholder="e.g. Morning Heritage Tour" /></div>
                  <div><FieldLabel>Description</FieldLabel><TextArea value={desc} onChange={setDesc} placeholder="Optional detailed description…" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <TimeInput value={startTime} onChange={setStartTime} label="Start Time" />
                    <TimeInput value={endTime} onChange={setEndTime} label="End Time" />
                  </div>
                  <div className="pt-2 border-t border-zinc-100 flex items-center gap-2 text-[11px] text-zinc-500 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#D4AF37]"></span>
                    This block will be open for shared appointments
                  </div>
                  <button type="submit" disabled={isLoading}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 hover:from-[#D4AF37] hover:to-[#c29d2b] transition-all duration-300 disabled:opacity-50 disabled:transform-none">
                    {isLoading ? 'Saving...' : 'Add Schedule to Calendar'}
                  </button>
                </form>
              </div>
            )}

            {/* Close a Date mode */}
            {mode === 'close' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {/* Sub-type tabs */}
                <div className="flex bg-zinc-100 p-1 rounded-lg mb-6 shadow-inner">
                  <button onClick={() => setCloseType('day')}
                    className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${closeType === 'day' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}>
                    Full Day
                  </button>
                  <button onClick={() => setCloseType('time')}
                    className={`flex-1 py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-md transition-all duration-300 ${closeType === 'time' ? 'bg-white text-rose-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-800'}`}>
                    Time Slot
                  </button>
                </div>

                {existingDisabledDay && closeType === 'day' && (
                  <div className="p-4 mb-5 border border-amber-200 bg-amber-50 rounded-lg text-xs font-medium text-amber-800 flex items-start gap-2">
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    This date is already completely blocked.
                  </div>
                )}

                <div className="p-4 mb-6 border border-rose-200 bg-rose-50 rounded-lg space-y-2 shadow-sm">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-rose-700 mb-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Warning
                  </div>
                  {[
                    closeType === 'day' ? 'Closes entire date (24 hours)' : 'Closes specific hours only',
                    'Does not affect already-scheduled appointments',
                  ].map(r => (
                    <div key={r} className="text-xs text-rose-700 flex gap-2 items-start"><span className="text-[10px] mt-0.5 opacity-60">●</span><span>{r}</span></div>
                  ))}
                </div>

                <form onSubmit={handleCloseSubmit} className="space-y-5">
                  {closeType === 'time' && (
                    <div><FieldLabel>Block Title *</FieldLabel><TextInput value={closeTitle} onChange={setCloseTitle} placeholder="e.g. Facility Maintenance" /></div>
                  )}
                  <div>
                    <FieldLabel>{closeType === 'day' ? 'Reason for Closure' : 'Description'}</FieldLabel>
                    <TextArea value={reason} onChange={setReason} placeholder={closeType === 'day' ? 'Why is this date unavailable?' : 'Optional details…'} />
                  </div>
                  {closeType === 'time' && (
                    <div className="grid grid-cols-2 gap-4">
                      <TimeInput value={startTime} onChange={setStartTime} label="Start Time" />
                      <TimeInput value={endTime} onChange={setEndTime} label="End Time" />
                    </div>
                  )}
                  <button type="submit" disabled={isLoading}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-rose-500 to-rose-600 text-white text-xs font-bold uppercase tracking-widest rounded-lg shadow-md hover:shadow-lg hover:-translate-y-0.5 hover:from-rose-600 hover:to-rose-700 transition-all duration-300 disabled:opacity-50 disabled:transform-none">
                    {isLoading ? 'Processing…' : closeType === 'day' ? 'Block Entire Day' : 'Block Time Slot'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add confirm modal */}
      <ConfirmModal open={showAddConfirm} title="Confirm Schedule Details" onConfirm={confirmAdd} onCancel={() => setShowAddConfirm(false)}>
        <p className="font-medium text-zinc-800">You are about to add a new schedule block:</p>
        <div className="mt-4 p-4 bg-zinc-50 rounded-lg border border-zinc-100 space-y-2 text-sm">
          <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-16 mt-0.5">Title</span> <span className="font-medium text-zinc-900">{title}</span></div>
          <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-16 mt-0.5">Date</span> <span className="text-zinc-700">{dateLabel}</span></div>
          <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-16 mt-0.5">Time</span> <span className="text-zinc-700 font-mono">{fmt12(startTime)} – {fmt12(endTime)}</span></div>
          {desc && <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 w-16 mt-0.5">Desc</span> <span className="text-zinc-600 text-xs mt-0.5 leading-relaxed">{desc}</span></div>}
        </div>
      </ConfirmModal>

      {/* Close confirm modal with countdown */}
      <ConfirmModal open={showCloseConfirm} title={closeType === 'day' ? 'Block Entire Date' : 'Block Time Slot'}
        onConfirm={canConfirm ? confirmClose : undefined} onCancel={() => setShowCloseConfirm(false)}
        confirmDisabled={!canConfirm} confirmLabel={canConfirm ? 'Confirm Block' : `Wait ${countdown}s`} danger>
        <div className="text-rose-600 font-bold text-sm mb-4">⚠️ This action will prevent new appointments during this block.</div>
        <div className="p-4 bg-rose-50 rounded-lg border border-rose-100 space-y-2 text-sm">
          <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 w-16 mt-0.5">Date</span> <span className="font-medium text-rose-900">{dateLabel}</span></div>
          {closeType === 'time' && <>
            <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 w-16 mt-0.5">Time</span> <span className="text-rose-800 font-mono">{fmt12(startTime)} – {fmt12(endTime)}</span></div>
            {closeTitle && <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 w-16 mt-0.5">Title</span> <span className="text-rose-800">{closeTitle}</span></div>}
          </>}
          {closeType === 'day' && <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 w-16 mt-0.5">Coverage</span> <span className="text-rose-800 font-medium">All Day (24h)</span></div>}
          {reason && <div className="flex items-start gap-3"><span className="text-[10px] font-bold uppercase tracking-widest text-rose-400 w-16 mt-0.5">Reason</span> <span className="text-rose-700 text-xs mt-0.5 leading-relaxed">{reason}</span></div>}
        </div>
        {!canConfirm && (
          <div className="mt-5 flex items-center gap-3 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Review details carefully. Please wait {countdown}s...
          </div>
        )}
      </ConfirmModal>
    </div>
  );
}
