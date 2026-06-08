import { env } from '../config/env.js';

/**
 * Builds standard structured email template for appointments.
 * Handles approved guidelines, completed feedback links, and custom messages.
 */
export const buildAppointmentEmail = ({
    appointmentId,
    visitorName = 'Valued Visitor',
    status,
    preferredDate,
    startTime,
    endTime,
    purpose,
    populationCount = 1,
    presentCount = null,
    message = ''
}) => {
    const safeMessage = String(message || '').trim();
    const preferredTime = (startTime && endTime) ? `${startTime} - ${endTime}` : 'Flexible';

    let subject = 'Appointment Update - Museo Bulawan';
    let statusBannerColor = '#3E2F1C';
    let statusBannerText = 'Appointment Update';
    let statusMessage = 'Thank you for your appointment request with Museo Bulawan.';

    if (status === 'APPROVED') {
        subject = 'Appointment APPROVED - Museo Bulawan';
        statusBannerColor = '#4CAF50';
        statusBannerText = '✓ Appointment APPROVED';
        statusMessage = 'We are pleased to inform you that your appointment request has been <strong style="color: #4CAF50;">APPROVED</strong>. We look forward to welcoming you!';
    } else if (status === 'REJECTED') {
        subject = 'Appointment REJECTED - Museo Bulawan';
        statusBannerColor = '#F44336';
        statusBannerText = '✗ Appointment REJECTED';
        statusMessage = 'We regret to inform you that your appointment request has been <strong style="color: #F44336;">REJECTED</strong>.';
    } else if (status === 'FAILED') {
        subject = 'Appointment CANCELLED - Museo Bulawan';
        statusBannerColor = '#F44336';
        statusBannerText = '✗ Appointment CANCELLED';
        statusMessage = 'Your appointment has been marked as <strong style="color: #F44336;">CANCELLED</strong> (No-show).';
    } else if (status === 'COMPLETED') {
        subject = 'Visit COMPLETED - Museo Bulawan';
        statusBannerColor = '#4CAF50';
        statusBannerText = '✓ Visit COMPLETED';
        statusMessage = 'Your visit has been marked as <strong style="color: #4CAF50;">COMPLETED</strong>. Thank you for visiting Museo Bulawan!';
    }

    // Construct feedback URL if completed and ID is present
    let feedbackSection = '';
    if (status === 'COMPLETED' && appointmentId) {
        const encodedId = Buffer.from(String(appointmentId)).toString('base64');
        const feedbackUrl = `${env.frontendUrl}/feedback/appointment/${encodedId}`;
        feedbackSection = `
            <div style="text-align:center;margin:20px 0">
                <a href="${feedbackUrl}" style="display:inline-block;background:#4CAF50;color:white;padding:15px 40px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px">📝 Share Your Feedback</a>
                <p style="margin:12px 0 0 0;font-size:13px;color:#666">Your feedback helps us improve. Share your experience!</p>
            </div>
        `;
    }

    // Visitor Guidelines for Approved Status
    const guidelinesSection = status === 'APPROVED' ? `
        <div style="background:#FBF6EC;border:1px solid #D9B868;padding:15px;margin:15px 0">
            <h3 style="margin:0 0 10px 0;color:#C19A3D;font-size:14px;text-align:center">📋 Visitor Guidelines</h3>
            <p style="margin:0;font-size:13px;line-height:1.8">
                🚫 No videography/photography of artifacts<br>
                🚫 No touching exhibits<br>
                🐾 No pets<br>
                📝 Registration required<br>
                🔇 Keep voices low<br>
                🚫 No running or floor sitting<br>
                🚭 No smoking
            </p>
        </div>
    ` : '';

    const detailsSection = (status === 'APPROVED' || status === 'COMPLETED') ? `
        <div style="background:#FBF6EC;border:1px solid #D9B868;margin:15px 0;padding:15px">
            <h3 style="margin:0 0 8px 0;font-size:15px;color:#C19A3D">📅 Appointment Details</h3>
            <p style="margin:5px 0;font-size:14px">
                <b>Date:</b> ${preferredDate}<br>
                <b>Time:</b> ${preferredTime}<br>
                <b>Purpose:</b> ${purpose}<br>
                <b>Visitors:</b> ${populationCount}
                ${presentCount !== null ? `<br><b>Attended:</b> ${presentCount}` : ''}
            </p>
        </div>
    ` : '';

    const messageSection = safeMessage ? `
        <div style="background:#FFF9E8;border-left:3px solid #E8C26A;padding:15px;margin:15px 0">
            <h4 style="margin:0 0 5px 0;color:#C19A3D;font-size:14px">📨 Message:</h4>
            <p style="margin:0;color:#665332;font-size:14px">${safeMessage}</p>
        </div>
    ` : '';

    const html = `
        <div style="font-family:serif;background:#fff;color:#333;padding:20px 0">
            <div style="max-width:600px;margin:0 auto;border:1px solid #E8C26A;border-radius:8px">
                <div style="background:#3E2F1C;text-align:center;padding:20px">
                    <h2 style="margin:0;font-size:20px;color:#E8C26A">Museo Bulawan</h2>
                    <p style="margin:5px 0 0;font-size:13px;color:#F5E7C1">Preserving the Heritage of Camarines Norte</p>
                </div>
                <div style="padding:25px">
                    <p>Dear <b>${visitorName}</b>,</p>
                    <p style="line-height:1.6">${statusMessage}</p>
                    ${detailsSection}
                    ${guidelinesSection}
                    ${feedbackSection}
                    ${messageSection}
                    <p style="color:#826723;font-size:14px;margin:15px 0 0 0">Thank you for your interest in Museo Bulawan!</p>
                    <p style="margin:10px 0 0 0;color:#3D3525">Best regards,<br><b style="color:#C19A3D">The Museo Bulawan Team</b></p>
                </div>
                <div style="background:#F5E7C1;text-align:center;padding:15px;font-size:12px;color:#665332">
                    <p style="margin:0 0 8px 0"><a href="https://museobulawan.online" style="color:#85621A">museobulawan.online</a></p>
                    <p style="margin:0 0 8px 0">
                        <span style="margin:0 8px"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="FB" width="20" height="20" style="vertical-align:middle"/> <a href="https://facebook.com/museobulawancn" style="color:#3E2F1C">Facebook</a></span> | 
                        <span style="margin:0 8px"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="IG" width="20" height="20" style="vertical-align:middle"/> <a href="https://instagram.com/museobulawanofficial" style="color:#3E2F1C">Instagram</a></span> | 
                        <span style="margin:0 8px"><img src="https://cdn-icons-png.flaticon.com/512/3046/3046121.png" alt="TT" width="20" height="20" style="vertical-align:middle"/> <a href="https://tiktok.com/@museobulawan" style="color:#3E2F1C">TikTok</a></span> | 
                        <span style="margin:0 8px"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" alt="YT" width="20" height="20" style="vertical-align:middle"/> <a href="https://youtube.com/@museobulawanofficial" style="color:#3E2F1C">YouTube</a></span>
                    </p>
                    <p style="margin:0 0 8px 0;font-size:11px">📧 museobulawanmis@gmail.com | 📍 Camarines Norte Provincial Capitol Grounds, Daet</p>
                    <p style="font-size:11px;color:#A09068;margin:5px 0 0 0">&copy; ${new Date().getFullYear()} Museo Bulawan. Automated message, do not reply.</p>
                </div>
            </div>
        </div>
    `;

    return { subject, html };
};
