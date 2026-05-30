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
function serializeSchedule(row) {
    if (!row) return null;
    return {
        ...row,
        schedule_id: row.id,
        date: row.date instanceof Date
            ? row.date.toISOString().split('T')[0]
            : String(row.date),
        start_time: formatTime(row.start_time),
        end_time:   formatTime(row.end_time),
    };
}

// ─── GET /api/v1/schedules ────────────────────────────────────────────────────
export const getSchedules = async (req, res, next) => {
    try {
        const { date } = req.query;
        let rows;

        if (date) {
            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
            }
            rows = await db.query(
                'SELECT * FROM schedules WHERE date = ? ORDER BY start_time ASC',
                [date]
            );
        } else {
            rows = await db.query('SELECT * FROM schedules ORDER BY date ASC, start_time ASC');
        }

        return res.json(rows.map(serializeSchedule));
    } catch (err) {
        next(err);
    }
};

// ─── GET /api/v1/schedules/:id ────────────────────────────────────────────────
export const getScheduleById = async (req, res, next) => {
    try {
        const [row] = await db.query('SELECT * FROM schedules WHERE id = ?', [req.params.id]);
        if (!row) return res.status(404).json({ message: 'Schedule not found.' });
        return res.json(serializeSchedule(row));
    } catch (err) {
        next(err);
    }
};

// ─── POST /api/v1/schedules ───────────────────────────────────────────────────
export const createSchedule = async (req, res, next) => {
    try {
        const { title, description, date, start_time, end_time, availability } = req.body;

        if (!title || !date || !start_time || !end_time || !availability) {
            return res.status(400).json({ message: 'Please fill in all required fields.' });
        }
        if (!['SHARED', 'EXCLUSIVE'].includes(availability)) {
            return res.status(400).json({ message: 'Invalid availability type.' });
        }

        const id = ulid();
        const createdBy = req.user?.id ?? null;

        await db.query(
            `INSERT INTO schedules (id, title, description, date, start_time, end_time, availability, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
            [id, title.trim(), description?.trim() || null, date, start_time, end_time, availability, createdBy]
        );

        appEvents.emit('db_change', { resource: 'Schedule', action: 'create', id });

        return res.status(201).json({ message: 'Schedule created successfully.', id });
    } catch (err) {
        next(err);
    }
};

// ─── PATCH /api/v1/schedules/:id/status ──────────────────────────────────────
export const updateScheduleStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value.' });
        }

        const [existing] = await db.query('SELECT id FROM schedules WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ message: 'Schedule not found.' });

        await db.query('UPDATE schedules SET status = ? WHERE id = ?', [status, id]);

        appEvents.emit('db_change', { resource: 'Schedule', action: 'update', id, status });

        return res.json({ message: 'Schedule status updated.' });
    } catch (err) {
        next(err);
    }
};

// ─── DELETE /api/v1/schedules/:id ────────────────────────────────────────────
export const deleteSchedule = async (req, res, next) => {
    try {
        const { id } = req.params;

        const [existing] = await db.query('SELECT id FROM schedules WHERE id = ?', [id]);
        if (!existing) return res.status(404).json({ message: 'Schedule not found.' });

        await db.query('DELETE FROM schedules WHERE id = ?', [id]);

        appEvents.emit('db_change', { resource: 'Schedule', action: 'delete', id });

        return res.json({ message: 'Schedule deleted.' });
    } catch (err) {
        next(err);
    }
};
