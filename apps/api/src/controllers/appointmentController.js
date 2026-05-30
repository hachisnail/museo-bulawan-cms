import { ulid } from 'ulidx';
import { db } from '../config/db.js';
import { appEvents } from '../utils/eventBus.js';

// ─── Helper: normalize TIME values from mariadb (can be string, Date, or BigInt)
function formatTime(t) {
    if (t === null || t === undefined) return null;
    if (typeof t === 'string') return t.substring(0, 5); // "09:00:00" → "09:00"
    if (typeof t === 'bigint') {
        const ms = Number(t);
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (t instanceof Date) {
        return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
    }
    return String(t).substring(0, 5);
}

// ─── Helper: serialize a DB row for the frontend ──────────────────────────────
function serializeAppointment(row) {
    if (!row) return null;

    const name = row.visitor_name || '';
    const spaceIdx = name.indexOf(' ');
    const firstName = spaceIdx >= 0 ? name.substring(0, spaceIdx) : name;
    const lastName  = spaceIdx >= 0 ? name.substring(spaceIdx + 1) : '';

    return {
        ...row,
        appointment_id: row.id,
        start_time: formatTime(row.start_time),
        end_time:   formatTime(row.end_time),
        preferred_date: row.preferred_date instanceof Date
            ? row.preferred_date.toISOString().split('T')[0]
            : String(row.preferred_date),
        request_letter_files: (() => {
            if (!row.request_letter_files) return [];
            if (Array.isArray(row.request_letter_files)) return row.request_letter_files;
            try { return JSON.parse(row.request_letter_files); } catch { return []; }
        })(),
        // Nested compatibility objects expected by the frontend utilities
        Visitor: {
            first_name:   firstName,
            last_name:    lastName,
            email:        row.visitor_email,
            phone:        row.visitor_phone,
            organization: row.organization,
        },
        AppointmentStatus: {
            status:        row.status,
            present_count: row.present_count,
        },
    };
}

// ─── GET /api/v1/appointments ─────────────────────────────────────────────────
export const getAppointments = async (req, res, next) => {
    try {
        const rows = await db.query(
            'SELECT * FROM appointments ORDER BY created_at DESC'
        );
        return res.json(rows.map(serializeAppointment));
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/v1/appointments/:id ─────────────────────────────────────────────
export const getAppointmentById = async (req, res, next) => {
    try {
        const [row] = await db.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ message: 'Appointment not found.' });
        return res.json(serializeAppointment(row));
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/v1/appointments ────────────────────────────────────────────────
export const createAppointment = async (req, res, next) => {
    try {
        const {
            visitor_name,
            visitor_email,
            visitor_phone,
            organization,
            purpose_of_visit,
            preferred_date,
            start_time,
            end_time,
            population_count,
            additional_notes,
            request_letter_files,
            status,
        } = req.body;

        if (!visitor_name || !visitor_email || !purpose_of_visit || !preferred_date || !population_count) {
            return res.status(400).json({ message: 'Missing required appointment fields.' });
        }

        const id = ulid();
        const initialStatus = status || 'PENDING';

        await db.query(
            `INSERT INTO appointments
                (id, visitor_name, visitor_email, visitor_phone, organization,
                 purpose_of_visit, preferred_date, start_time, end_time,
                 population_count, additional_notes, request_letter_files, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                visitor_name.trim(),
                visitor_email.trim(),
                visitor_phone?.trim() || null,
                organization?.trim() || null,
                purpose_of_visit.trim(),
                preferred_date,
                start_time || null,
                end_time || null,
                parseInt(population_count, 10) || 1,
                additional_notes?.trim() || null,
                JSON.stringify(request_letter_files || []),
                initialStatus,
            ]
        );

        appEvents.emit('db_change', { resource: 'Appointment', action: 'create', id });

        return res.status(201).json({ message: 'Appointment created successfully.', id, appointment_id: id });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/v1/appointments/:id/status ────────────────────────────────────
export const updateAppointmentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, present_count, message_to_visitor } = req.body;

        const VALID_STATUSES = ['PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'FAILED'];
        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const [existing] = await db.query('SELECT id FROM appointments WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ message: 'Appointment not found.' });

        const updates = ['status = ?', 'updated_at = NOW()'];
        const values  = [status];

        if (present_count !== undefined && present_count !== null) {
            updates.push('present_count = ?');
            values.push(parseInt(present_count, 10) || 0);
        }
        if (message_to_visitor !== undefined) {
            updates.push('message_to_visitor = ?');
            values.push(message_to_visitor?.trim() || null);
        }

        values.push(id);
        await db.query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, values);

        appEvents.emit('db_change', { resource: 'Appointment', action: 'update', id, status });
        // Also emit AppointmentStatus so the schedule page refreshes
        appEvents.emit('db_change', { resource: 'AppointmentStatus', action: 'update', id, status });

        return res.json({ message: 'Appointment status updated.' });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/v1/appointments/:id ─────────────────────────────────────────
export const deleteAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [existing] = await db.query('SELECT id FROM appointments WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ message: 'Appointment not found.' });

        await db.query('DELETE FROM appointments WHERE id = ?', [id]);
        appEvents.emit('db_change', { resource: 'Appointment', action: 'delete', id });

        return res.json({ message: 'Appointment deleted.' });
    } catch (err) {
        next(err);
    }
};
