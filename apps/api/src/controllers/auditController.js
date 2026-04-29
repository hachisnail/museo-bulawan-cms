import { auditService } from '../services/auditService.js';

export const listAuditLogs = async (req, res, next) => {
    try {
        const logs = await auditService.fetchAll(req.query);
        res.status(200).json({ status: 'success', data: logs });
    } catch (error) {
        next(error);
    }
};

export const exportAuditLogs = async (req, res, next) => {
    try {
        const { format = 'json', dateFrom, dateTo } = req.query;
        
        const content = await auditService.exportAuditLogs(format, dateFrom, dateTo);

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
            return res.send(content);
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.json');
            return res.send(content);
        }
    } catch (error) {
        next(error);
    }
};
