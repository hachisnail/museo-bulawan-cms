import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/authContext';
import { useSSE } from '../hooks/useSSE';
import { normalizeStatus, formatTimeTo12H } from '../utils/scheduleUtils';
import {
  ArrowLeft, Mail, Phone, Building2, Calendar, Clock,
  Users, FileText, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getVisitorName(a) {
  if (a.Visitor?.first_name || a.Visitor?.last_name) {
    return `${a.Visitor.first_name || ''} ${a.Visitor.last_name || ''}`.trim();
  }
  return a.visitor_name || 'Unknown Visitor';
}

function getApptStatus(a) {
  return normalizeStatus(a.AppointmentStatus?.status || a.status || '');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, mono, highlight }) {
  return (
    <div className="flex gap-3 items-start">
      {icon}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</div>
        <div className={`text-sm mt-0.5 ${mono ? 'font-mono' : 'font-medium'} ${highlight ? 'text-green-600 font-bold' : 'text-zinc-900'}`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ children, active, danger, onClick, disabled }) {
  const base = 'py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm border transition-all';
  const activeStyle = danger
    ? 'bg-red-500 text-white border-red-500 shadow-md'
    : 'bg-zinc-900 text-white border-zinc-900 shadow-md';
  const inactiveStyle = danger
    ? 'bg-white text-zinc-600 border-zinc-200 hover:border-red-400 hover:text-red-600'
    : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400 hover:text-zinc-900';
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${active ? activeStyle : inactiveStyle} disabled:opacity-40 disabled:cursor-not-allowed`}>
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const map = {
    PENDING:   { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Pending Review' },
    APPROVED:  { cls: 'bg-blue-50 text-blue-700 border-blue-200',       label: 'Approved / Upcoming' },
    COMPLETED: { cls: 'bg-green-50 text-green-700 border-green-200',    label: 'Completed' },
    REJECTED:  { cls: 'bg-red-50 text-red-700 border-red-200',          label: 'Declined' },
    FAILED:    { cls: 'bg-red-50 text-red-700 border-red-200',          label: 'Cancelled' },
    CANCELLED: { cls: 'bg-zinc-50 text-zinc-700 border-zinc-200',       label: 'Cancelled' },
  };
  const entry = map[status] ?? { cls: 'bg-zinc-50 text-zinc-600 border-zinc-200', label: status };
  return (
    <span className={`border px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-widest ${entry.cls}`}>
      {entry.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { apiFetch } = useAuth();
  const { events: sseEvents } = useSSE('*');

  const [rawData, setRawData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [action, setAction] = useState(null); // 'approve' | 'decline' | 'arrive' | 'cancel'
  const [message, setMessage] = useState('');
  const [presentCount, setPresentCount] = useState('');

  // ── Data Fetch ──────────────────────────────────────────────────────────────

  const fetchDetail = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/appointments/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRawData(await res.json());
      setError(null);
    } catch {
      setError('Failed to load appointment details.');
    } finally {
      setIsLoading(false);
    }
  }, [id, apiFetch]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  // ── SSE Refresh ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sseEvents.length) return;
    const res = sseEvents[0]?.resource;
    if (res === 'Appointment' || res === 'AppointmentStatus') fetchDetail();
  }, [sseEvents, fetchDetail]);

  // ── Auto-action from navigation state (e.g., Schedule → "Mark Done") ────────

  useEffect(() => {
    if (!rawData || !location.state?.autoAction) return;
    const st = getApptStatus(rawData);
    if (location.state.autoAction === 'arrive' && st === 'APPROVED') {
      setAction('arrive');
    }
    window.history.replaceState({}, document.title);
  }, [rawData, location.state]);

  // ── Submit Action ───────────────────────────────────────────────────────────

  const handleAction = async () => {
    if (!action) return;
    const statusMap = { approve: 'APPROVED', decline: 'REJECTED', arrive: 'COMPLETED', cancel: 'FAILED' };
    const body = { status: statusMap[action] };
    if (message) body.message_to_visitor = message;
    if (action === 'arrive') body.present_count = parseInt(presentCount, 10);

    setIsSubmitting(true);
    try {
      const res = await apiFetch(`/api/v1/appointments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAction(null);
      setMessage('');
      setPresentCount('');
      await fetchDetail();
    } catch {
      // Keep action open so the admin can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading / Error states ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !rawData) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-sm text-zinc-600">{error || 'Appointment not found.'}</p>
        <button onClick={() => navigate('/appointments')} className="text-xs text-[#D4AF37] hover:underline">
          Go back to list
        </button>
      </div>
    );
  }

  // ── Derived display fields ───────────────────────────────────────────────────

  const visitorName    = getVisitorName(rawData);
  const status         = getApptStatus(rawData);
  const isPending      = status === 'PENDING';
  const isApproved     = status === 'APPROVED';
  const isTerminal     = !isPending && !isApproved;

  const visitorEmail   = rawData.Visitor?.email    || rawData.visitor_email || '—';
  const visitorPhone   = rawData.Visitor?.phone    || rawData.visitor_phone || '—';
  const organization   = rawData.organization      || rawData.Visitor?.organization || null;
  const purposeOfVisit = rawData.purpose_of_visit  || '—';
  const populationCount = rawData.population_count ?? '—';
  const additionalNotes = rawData.additional_notes || null;
  const presentCountRecorded = rawData.present_count ?? null;

  const preferredDate = rawData.preferred_date?.split('T')[0];
  const preferredTime = rawData.preferred_time
    ? rawData.preferred_time
    : (rawData.start_time && rawData.end_time)
      ? `${formatTimeTo12H(rawData.start_time.substring(0, 5))} – ${formatTimeTo12H(rawData.end_time.substring(0, 5))}`
      : 'Flexible';

  // Request letter files (stored as JSON array or raw array)
  let requestFiles = [];
  try {
    if (rawData.request_letter_files) {
      requestFiles = Array.isArray(rawData.request_letter_files)
        ? rawData.request_letter_files
        : JSON.parse(rawData.request_letter_files);
    }
  } catch { /* ignore parse errors */ }

  const needsDocSection = requestFiles.length > 0 ||
    ['School Field Trip', 'Research Paper', 'Photography or Media Projects'].includes(purposeOfVisit);

  // ── Render ───────────────────────────────────────────────────────────────────

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
            <h1 className="text-2xl font-serif text-black uppercase tracking-widest">Appointment Details</h1>
            <p className="text-xs text-zinc-400 mt-1 font-mono tracking-wide">{id}</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex-1 overflow-auto pt-6 flex gap-6 min-h-0">

        {/* ── Left Column — Details ─────────────────────────────────────────── */}
        <div className="flex-1 space-y-6 min-w-0">
          <div className="bg-white border border-zinc-200 rounded-sm shadow-sm p-6">
            {/* Visitor Name + Purpose */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-3xl font-serif text-zinc-900">{visitorName}</h2>
                {rawData.created_at && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Submitted {new Date(rawData.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-sm px-3 py-1.5 whitespace-nowrap ml-4">
                {purposeOfVisit}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8">
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">
                  Contact Information
                </h3>
                <InfoRow
                  icon={<Mail className="w-4 h-4 text-zinc-400 mt-0.5" />}
                  label="Email Address"
                  value={visitorEmail}
                />
                <InfoRow
                  icon={<Phone className="w-4 h-4 text-zinc-400 mt-0.5" />}
                  label="Phone Number"
                  value={visitorPhone}
                />
                {organization && (
                  <InfoRow
                    icon={<Building2 className="w-4 h-4 text-zinc-400 mt-0.5" />}
                    label="Organization"
                    value={organization}
                  />
                )}
              </div>

              {/* Visit Details */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 border-b border-zinc-100 pb-2">
                  Visit Details
                </h3>
                <InfoRow
                  icon={<Calendar className="w-4 h-4 text-zinc-400 mt-0.5" />}
                  label="Preferred Date"
                  value={preferredDate
                    ? new Date(preferredDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                    : '—'}
                />
                <InfoRow
                  icon={<Clock className="w-4 h-4 text-zinc-400 mt-0.5" />}
                  label="Preferred Time"
                  value={preferredTime}
                  mono
                />
                <InfoRow
                  icon={<Users className="w-4 h-4 text-zinc-400 mt-0.5" />}
                  label="Population Count"
                  value={`${populationCount} Visitors`}
                />
                {status === 'COMPLETED' && presentCountRecorded !== null && (
                  <InfoRow
                    icon={<CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />}
                    label="Visitors Present"
                    value={`${presentCountRecorded} Arrived`}
                    highlight
                  />
                )}
              </div>
            </div>

            {/* Notes */}
            {additionalNotes && (
              <div className="mt-8 pt-6 border-t border-zinc-100">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-2">Additional Notes</div>
                <div className="p-4 bg-zinc-50 border border-zinc-100 rounded-sm text-sm text-zinc-700 leading-relaxed italic">
                  "{additionalNotes}"
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column — Actions + Docs ─────────────────────────────────── */}
        <div className="w-[400px] flex-shrink-0 flex flex-col gap-6">

          {/* Admin Action Panel */}
          {(isPending || isApproved) && (
            <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden flex flex-col">
              <div className="px-5 py-4 bg-zinc-950 text-white border-b border-zinc-900 relative">
                <div className="absolute left-0 top-0 w-1 h-full bg-[#D4AF37]" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Administrator Actions</h3>
              </div>

              <div className="p-5 flex-1 flex flex-col bg-zinc-50/50">
                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {isPending && (
                    <>
                      <ActionBtn active={action === 'approve'} onClick={() => setAction(a => a === 'approve' ? null : 'approve')}>
                        Approve
                      </ActionBtn>
                      <ActionBtn active={action === 'decline'} danger onClick={() => setAction(a => a === 'decline' ? null : 'decline')}>
                        Decline
                      </ActionBtn>
                    </>
                  )}
                  {isApproved && (
                    <>
                      <ActionBtn active={action === 'arrive'} onClick={() => setAction(a => a === 'arrive' ? null : 'arrive')}>
                        Visitor Arrived
                      </ActionBtn>
                      <ActionBtn active={action === 'cancel'} danger onClick={() => setAction(a => a === 'cancel' ? null : 'cancel')}>
                        Cancel Visit
                      </ActionBtn>
                    </>
                  )}
                </div>

                {/* Action form */}
                {action ? (
                  <div className="space-y-4 flex-1 flex flex-col">
                    {action === 'arrive' && (
                      <div className="p-4 bg-white border border-zinc-200 rounded-sm shadow-sm">
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4">
                          Attendance Verification
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Expected</div>
                            <div className="text-xl font-bold text-zinc-900">{populationCount}</div>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest text-[#D4AF37] font-bold mb-1 block">
                              Actually Present *
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={presentCount}
                              onChange={e => setPresentCount(e.target.value)}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-sm px-3 py-2 text-sm font-medium focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50"
                              placeholder="Count"
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => setPresentCount(String(populationCount))}
                          className="w-full py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-200 rounded-sm hover:bg-zinc-100 transition-colors"
                        >
                          Mark All Present
                        </button>
                      </div>
                    )}

                    <div className="flex-1 flex flex-col">
                      <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 mb-1.5 block">
                        Message to Visitor (Optional)
                      </label>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={4}
                        className="w-full flex-1 min-h-[100px] bg-white border border-zinc-200 rounded-sm p-3 text-sm resize-none focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37]/50"
                        placeholder="Add a message to be sent via email..."
                      />
                    </div>

                    <button
                      onClick={handleAction}
                      disabled={isSubmitting || (action === 'arrive' && !presentCount)}
                      className={`w-full py-3 text-[11px] font-bold uppercase tracking-widest rounded-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 ${
                        action === 'decline' || action === 'cancel'
                          ? 'bg-red-500 hover:bg-red-600 text-white'
                          : 'bg-[#D4AF37] hover:bg-[#b3932f] text-zinc-900'
                      }`}
                    >
                      {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Confirm Action
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center text-zinc-400 p-6 border-2 border-dashed border-zinc-200 rounded-sm">
                    <CheckCircle2 className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs uppercase tracking-widest">Select an action above to proceed</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resolution card (for completed / rejected / failed) */}
          {isTerminal && (
            <div className="bg-white border border-zinc-200 rounded-sm shadow-sm p-5 space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">Resolution</h3>
              <StatusBadge status={status} />
              {presentCountRecorded !== null && (
                <div className="flex items-center gap-2 text-sm text-zinc-600 pt-1">
                  <Users className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>
                    <span className="font-bold text-zinc-900">{presentCountRecorded}</span> out of {populationCount} visitors arrived
                  </span>
                </div>
              )}
              {rawData.message_to_visitor && (
                <div className="pt-3 border-t border-zinc-100">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">
                    Message Sent to Visitor
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed italic">"{rawData.message_to_visitor}"</p>
                </div>
              )}
            </div>
          )}

          {/* Attached Documents */}
          {needsDocSection && (
            <div className="bg-white border border-zinc-200 rounded-sm shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 bg-zinc-50/50">
                <FileText className="w-4 h-4 text-zinc-400" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">Attached Documents</h3>
              </div>
              <div className="p-4 space-y-2">
                {requestFiles.length > 0 ? (
                  requestFiles.map((file, i) => {
                    const fileName = typeof file === 'string' ? file.split('/').pop() : `Document ${i + 1}`;
                    const fileUrl  = typeof file === 'string' ? file : null;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 border border-zinc-100 rounded-sm bg-zinc-50 hover:bg-zinc-100 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                          <span className="text-sm text-zinc-700 truncate font-medium">{fileName}</span>
                        </div>
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-3 text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] hover:text-[#b3932f] flex-shrink-0"
                          >
                            View
                          </a>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-400 border-2 border-dashed border-zinc-200 rounded-sm">
                    <FileText className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs">No documents attached yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
