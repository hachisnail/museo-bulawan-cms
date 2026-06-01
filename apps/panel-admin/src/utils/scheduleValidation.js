import { timeStringToMinutes, countOverlappingEvents } from './scheduleUtils';

const SIX_AM  = timeStringToMinutes('06:00');
const SIX_PM  = timeStringToMinutes('18:00');
const MIN_DUR = 15;

function baseTimeValidation(startTime, endTime) {
  const s = timeStringToMinutes(startTime);
  const e = timeStringToMinutes(endTime);
  if (s < SIX_AM || e > SIX_PM)
    return 'Time must be between 6:00 AM and 6:00 PM.';
  if (s >= e)
    return 'Start time must be before end time.';
  if (e - s < MIN_DUR)
    return 'Duration must be at least 15 minutes.';
  return null;
}

function isFullDayDisabled(ev) {
  return ev.isSchedule && ev.availability === 'EXCLUSIVE' &&
    (ev.title === 'DATE_DISABLED' ||
      (ev.startTime === '00:00' && ev.endTime === '23:59'));
}

function overlapsRange(ev, startTime, endTime) {
  const s = timeStringToMinutes(startTime);
  const e = timeStringToMinutes(endTime);
  const es = timeStringToMinutes(ev.startTime);
  const ee = timeStringToMinutes(ev.endTime);
  return s < ee && es < e;
}

// ─── Schedule Creation ────────────────────────────────────────────────────────
// Schedules are NOT blocked by EXCLUSIVE events, only by max 10 overlap rule.

export function validateScheduleCreation({ date, startTime, endTime }, dayEvents) {
  const err = baseTimeValidation(startTime, endTime);
  if (err) return { isValid: false, error: err };

  const eventsOnDate = dayEvents.filter(e => e.date === date);
  const overlap = countOverlappingEvents(eventsOnDate, startTime, endTime);
  if (overlap >= 10)
    return { isValid: false, error: 'This time slot is fully booked (max 10 concurrent).' };

  return { isValid: true, error: null };
}

// ─── Date / Time-slot Disabling ───────────────────────────────────────────────

export function validateDateDisabling({ date, type, startTime, endTime }, dayEvents) {
  const eventsOnDate = dayEvents.filter(e => e.date === date);

  if (type === 'day') {
    const alreadyDisabled = eventsOnDate.find(isFullDayDisabled);
    if (alreadyDisabled)
      return { isValid: false, error: 'This date is already fully disabled.', warning: null };

    const existingExclusive = eventsOnDate.filter(e =>
      e.isSchedule && e.availability === 'EXCLUSIVE' && !isFullDayDisabled(e)
    );
    const warning = existingExclusive.length > 0
      ? `Note: ${existingExclusive.length} exclusive time slot(s) exist — they won't be affected.`
      : null;
    return { isValid: true, error: null, warning };
  }

  // type === 'time'
  const err = baseTimeValidation(startTime, endTime);
  if (err) return { isValid: false, error: err, warning: null };

  const alreadyDisabled = eventsOnDate.find(isFullDayDisabled);
  const warning = alreadyDisabled
    ? 'This date is already fully disabled; you can still add exclusive time blocks.'
    : null;

  const overlappingExclusive = eventsOnDate.find(e =>
    e.isSchedule && e.availability === 'EXCLUSIVE' &&
    !isFullDayDisabled(e) &&
    overlapsRange(e, startTime, endTime)
  );
  if (overlappingExclusive)
    return { isValid: false, error: 'This time slot overlaps with an existing reserved block.', warning };

  return { isValid: true, error: null, warning };
}

// ─── Appointment Booking (public-facing, kept for reference) ─────────────────

export function validateAppointmentBooking({ date, startTime, endTime, isFlexibleTime }, dayEvents) {
  if (isFlexibleTime) {
    const dayBlocked = dayEvents.find(e => e.date === date && isFullDayDisabled(e));
    if (dayBlocked)
      return { isValid: false, error: 'This date is unavailable. Please choose another.' };
    return { isValid: true, error: null };
  }

  const err = baseTimeValidation(startTime, endTime);
  if (err) return { isValid: false, error: err };

  const eventsOnDate = dayEvents.filter(e => e.date === date);

  const exclusiveConflict = eventsOnDate.find(e =>
    e.isSchedule && e.availability === 'EXCLUSIVE' && overlapsRange(e, startTime, endTime)
  );
  if (exclusiveConflict)
    return { isValid: false, error: 'This time slot is reserved for a special event.' };

  const overlap = countOverlappingEvents(eventsOnDate, startTime, endTime);
  if (overlap >= 1)
    return { isValid: false, error: 'This time slot is already booked.' };

  return { isValid: true, error: null };
}
