import { ulid } from 'ulidx';
import Ajv from 'ajv';
import { db } from '../config/db.js';
import { appEvents } from '../utils/eventBus.js';
import { definitionService } from '../services/form/definitionService.js';

// ─── AJV setup for schema validation ──────────────────────────────────────────
const ajv = new Ajv({ strict: false });
ajv.addFormat('textarea', { validate: () => true });
ajv.addFormat('file', { validate: () => true });

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

        // ── Step 1: Always run manual field validation (fast, specific error messages) ──
        if (!visitor_name?.trim())
            return res.status(400).json({ message: 'Visitor name is required.' });
        if (!visitor_email?.trim())
            return res.status(400).json({ message: 'Visitor email is required.' });
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(visitor_email.trim()))
            return res.status(400).json({ message: 'Visitor email is not a valid email address.' });
        if (!purpose_of_visit?.trim())
            return res.status(400).json({ message: 'Purpose of visit is required.' });
        if (!preferred_date)
            return res.status(400).json({ message: 'Preferred date is required.' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(preferred_date))
            return res.status(400).json({ message: 'Preferred date must be in YYYY-MM-DD format.' });
        if (!population_count || parseInt(population_count, 10) < 1)
            return res.status(400).json({ message: 'Population count must be at least 1.' });
        if (start_time && end_time && start_time >= end_time)
            return res.status(400).json({ message: 'Start time must be before end time.' });

        // ── Step 2: AJV schema validation from form_definitions (best-effort) ──────
        try {
            const definition = await definitionService.getFormDefinition('appointment-booking');
            if (definition?.schema && Object.keys(definition.schema).length > 0) {
                const validate = ajv.compile(definition.schema);
                const valid = validate(req.body);
                if (!valid) {
                    return res.status(400).json({
                        message: `Validation failed: ${ajv.errorsText(validate.errors)}`
                    });
                }
            }
        } catch {
            // form_definitions not reachable — manual validation above already passed, proceed.
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
