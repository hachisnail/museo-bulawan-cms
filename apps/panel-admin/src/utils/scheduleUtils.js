// ─── Date & Time Helpers ──────────────────────────────────────────────────────

export function getLocalDateString(dateObj) {
  const d = new Date(dateObj);
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}

export function timeStringToMinutes(str) {
  if (!str || str === 'Flexible') return 0;
  const [h, m] = str.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function formatTimeTo12H(str) {
  if (!str || str === 'Flexible') return str || '—';
  const [h, m] = str.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function convertTo24Hour(timeStr) {
  if (!timeStr) return '09:00';
  const hasAMPM = /am|pm/i.test(timeStr);
  if (!hasAMPM) {
    const [h, m] = timeStr.split(':');
    return `${String(parseInt(h, 10)).padStart(2, '0')}:${String(parseInt(m || '0', 10)).padStart(2, '0')}`;
  }
  const isPM = /pm/i.test(timeStr);
  const clean = timeStr.replace(/am|pm/gi, '').trim();
  const [hStr, mStr] = clean.split(':');
  let hour = parseInt(hStr, 10);
  const minute = parseInt(mStr || '0', 10);
  if (isPM && hour < 12) hour += 12;
  if (!isPM && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function countOverlappingEvents(events, startTime, endTime) {
  const newStart = timeStringToMinutes(startTime);
  const newEnd = timeStringToMinutes(endTime);
  return events.filter(ev => {
    const s = timeStringToMinutes(ev.startTime);
    const e = timeStringToMinutes(ev.endTime);
    return newStart < e && s < newEnd;
  }).length;
}

// ─── Status Normalization ─────────────────────────────────────────────────────

const STATUS_MAP = {
  APPROVED: 'APPROVED', CONFIRMED: 'APPROVED',
  PENDING: 'PENDING', TO_REVIEW: 'PENDING', TOREVIEWING: 'PENDING',
  COMPLETED: 'COMPLETED', DONE: 'COMPLETED',
  REJECTED: 'REJECTED', DECLINED: 'REJECTED',
  FAILED: 'FAILED', CANCELLED: 'CANCELLED', CANCELED: 'CANCELLED',
};

export function normalizeStatus(raw = '') {
  return STATUS_MAP[raw.toUpperCase().replace(/\s+/g, '_')] ?? raw.toUpperCase();
}

// ─── API Data → Flat Event Shape ──────────────────────────────────────────────

/**
 * Converts a raw backend schedule into a flat event object used internally.
 */
export function normalizeSchedule(s) {
  const isDisabledDay = s.title === 'DATE_DISABLED';
  return {
    id: `schedule-${s.schedule_id}`,
    schedule_id: s.schedule_id,
    title: s.title || 'Unnamed Schedule',
    description: s.description || '',
    date: s.date?.split('T')[0],
    startTime: s.start_time || '00:00',
    endTime: s.end_time || '23:59',
    availability: isDisabledDay ? 'EXCLUSIVE' : (s.availability || 'SHARED'),
    status: s.status || 'ACTIVE',
    isSchedule: true,
    isAppointment: false,
    isDisabledDay,
    isDone: s.status === 'COMPLETED',
    isActive: s.status !== 'COMPLETED',
  };
}

/**
 * Converts a raw backend appointment into a flat event object used internally.
 */
export function normalizeAppointment(a) {
  const status = normalizeStatus(a.AppointmentStatus?.status || '');
  const hasFlexibleTime = !a.start_time && !a.end_time;

  let startTime = '09:00';
  let endTime = '10:00';

  if (!hasFlexibleTime) {
    if (a.start_time && a.end_time) {
      startTime = a.start_time.substring(0, 5);
      endTime = a.end_time.substring(0, 5);
    } else if (a.preferred_time && typeof a.preferred_time === 'string' && a.preferred_time.includes('-')) {
      const [s, e] = a.preferred_time.split('-').map(t => t.trim());
      startTime = convertTo24Hour(s);
      endTime = e ? convertTo24Hour(e) : (() => {
        const h = parseInt(startTime.split(':')[0], 10);
        const m = parseInt(startTime.split(':')[1], 10);
        return `${String((h + 1) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      })();
    }
  }

  const visitorName = a.Visitor
    ? `${a.Visitor.first_name || ''} ${a.Visitor.last_name || ''}`.trim()
    : 'Unknown Visitor';

  return {
    id: `appointment-${a.appointment_id}`,
    appointment_id: a.appointment_id,
    title: a.purpose_of_visit || 'Visitor Appointment',
    description: a.additional_notes || '',
    date: a.preferred_date?.split('T')[0],
    startTime: hasFlexibleTime ? 'Flexible' : startTime,
    endTime: hasFlexibleTime ? '' : endTime,
    organizer: visitorName,
    numPeople: a.population_count ?? 1,
    status,
    isSchedule: false,
    isAppointment: true,
    hasFlexibleTime,
    isDone: status === 'COMPLETED',
    isActive: status === 'APPROVED',
    availability: 'SHARED',
  };
}

// ─── FullCalendar Event Converters ────────────────────────────────────────────

const FC_COLORS = {
  appointment: { bg: 'rgba(99,102,241,0.12)', border: '#6366f1', text: '#3730a3' },
  shared:      { bg: 'rgba(212,175,55,0.15)',  border: '#D4AF37',  text: '#78600a' },
  exclusive:   { bg: 'rgba(244,63,94,0.12)',   border: '#f43f5e',  text: '#9f1239' },
  disabled:    { bg: 'rgba(239,68,68,0.08)',   border: '#ef4444',  text: '#7f1d1d' },
};

/**
 * Converts a flat event into a FullCalendar event object.
 * @param {Object} ev - Flat event (from normalizeSchedule or normalizeAppointment)
 * @param {string} forDate - YYYY-MM-DD to anchor the time (in case ev.date is different)
 */
export function toFCEvent(ev, forDate) {
  const date = forDate || ev.date;
  if (!date) return null;

  const isFlexible = ev.hasFlexibleTime || ev.startTime === 'Flexible';
  if (ev.isAppointment && isFlexible) return null; // Flexible appts excluded from timeline

  let colors;
  if (ev.isAppointment) colors = FC_COLORS.appointment;
  else if (ev.isDisabledDay) colors = FC_COLORS.disabled;
  else if (ev.availability === 'EXCLUSIVE') colors = FC_COLORS.exclusive;
  else colors = FC_COLORS.shared;

  return {
    id: ev.id,
    title: ev.isAppointment ? (ev.organizer || ev.title) : ev.title,
    start: `${date}T${ev.startTime}:00`,
    end:   `${date}T${ev.endTime}:00`,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    textColor: colors.text,
    extendedProps: { ...ev },
  };
}
