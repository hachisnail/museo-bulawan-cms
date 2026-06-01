import React from 'react';
import InternalForm from './InternalForm';
import ExternalForm from './ExternalForm';
import { validateAppointmentBooking } from '../../utils/scheduleValidation';

/**
 * FormRenderer Dispatcher
 *
 * Automatically chooses between Internal (Staff/System) and External (Public/Visitor)
 * implementations based on the 'variant' prop or 'compact' flag.
 *
 * Injects an appointment-aware customFetch that transparently runs schedule
 * conflict validation before any form submit that contains a visitDate field —
 * without touching useFormLogic, ExternalForm, or InternalForm.
 */
const FormRenderer = (props) => {
    const { variant, compact, apiBaseUrl = '', customFetch: baseFetch = fetch } = props;

    // ── Appointment conflict check — fetch interceptor ───────────────────────
    // Intercepts POST calls to */submit. If the submitted data contains a
    // visitDate field, validates it against the schedule API before forwarding.
    // On conflict, returns a fake 422 Response that useFormLogic handles
    // naturally via its existing error path (result.error → setError).
    const appointmentAwareFetch = async (url, options = {}) => {
        const isSubmit =
            options?.method === 'POST' &&
            typeof url === 'string' &&
            url.endsWith('/submit');

        if (isSubmit && options?.body instanceof FormData) {
            try {
                const raw = options.body.get('data');
                const submittedData = raw ? JSON.parse(raw) : {};
                const visitDate = submittedData.visitDate;

                if (visitDate) {
                    const startTime = submittedData.startTime || null;
                    const endTime   = submittedData.endTime   || null;
                    const isFlexible = !startTime && !endTime;

                    const schRes = await baseFetch(`${apiBaseUrl}/api/v1/schedules?date=${visitDate}`);
                    if (schRes.ok) {
                        const rawSchedules = await schRes.json();
                        const dayEvents = rawSchedules.map(s => ({
                            date:         s.date?.split('T')[0],
                            startTime:    s.start_time?.substring(0, 5) || '00:00',
                            endTime:      s.end_time?.substring(0, 5)   || '23:59',
                            availability: s.availability || 'SHARED',
                            isSchedule:   true,
                            title:        s.title,
                        }));

                        const result = validateAppointmentBooking(
                            { date: visitDate, startTime, endTime, isFlexibleTime: isFlexible },
                            dayEvents
                        );

                        if (!result.isValid) {
                            // Return a fake failed Response — useFormLogic's existing
                            // error handling picks this up as: throw new Error(result.error)
                            return new Response(
                                JSON.stringify({ error: result.error }),
                                { status: 422, headers: { 'Content-Type': 'application/json' } }
                            );
                        }
                    }
                }
            } catch {
                // Schedule API unreachable or parse error — let the server decide.
            }
        }

        return baseFetch(url, options);
    };
    // ────────────────────────────────────────────────────────────────────────

    // Default to 'internal' if compact is true, otherwise 'external'
    const finalVariant = variant || (compact ? 'internal' : 'external');

    // Spread all original props but replace customFetch with the interceptor
    const enhancedProps = { ...props, customFetch: appointmentAwareFetch };

    if (finalVariant === 'internal') {
        return <InternalForm {...enhancedProps} />;
    }

    return <ExternalForm {...enhancedProps} />;
};

export default FormRenderer;
