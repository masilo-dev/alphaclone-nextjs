/**
 * Email Templates for Meeting Confirmations
 */

export interface MeetingConfirmationData {
    recipientName: string;
    recipientEmail: string;
    meetingTitle: string;
    meetingDate: string;
    meetingTime: string;
    duration: number;
    joinLink: string;
    hostName: string;
    hostEmail: string;
    description?: string;
}

export const emailTemplates = {
    /**
     * Generate meeting confirmation email HTML
     */
    meetingConfirmation(data: MeetingConfirmationData): string {
        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%); padding: 32px; text-align: center;">
              <h1 style="margin: 0; color: white; font-size: 24px; font-weight: bold;">
                Meeting Confirmed ✓
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 16px;">
                Hi ${data.recipientName},
              </p>
              
              <p style="margin: 0 0 24px 0; color: #cbd5e1; font-size: 16px;">
                Your meeting with <strong style="color: white;">${data.hostName}</strong> has been confirmed.
              </p>
              
              <!-- Meeting Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; color: white; font-size: 18px;">
                      ${data.meetingTitle}
                    </h2>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">📅 Date:</td>
                        <td style="padding: 8px 0; color: white; font-size: 14px; text-align: right;">${data.meetingDate}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">🕐 Time:</td>
                        <td style="padding: 8px 0; color: white; font-size: 14px; text-align: right;">${data.meetingTime}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #94a3b8; font-size: 14px;">⏱️ Duration:</td>
                        <td style="padding: 8px 0; color: white; font-size: 14px; text-align: right;">${data.duration} minutes</td>
                      </tr>
                    </table>
                    
                    ${data.description ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #334155;">
                      <p style="margin: 0; color: #cbd5e1; font-size: 14px;">${data.description}</p>
                    </div>
                    ` : ''}
                  </td>
                </tr>
              </table>
              
              <!-- Join Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${data.joinLink}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                      Join Meeting
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0 0; color: #64748b; font-size: 12px; text-align: center;">
                Or copy this link: <a href="${data.joinLink}" style="color: #14b8a6; text-decoration: none;">${data.joinLink}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #0f172a; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px;">
                AlphaClone Systems - Enterprise Platform
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
    },

    /**
     * Generate calendar invite (.ics file content)
     */
    generateCalendarInvite(data: MeetingConfirmationData): string {
        const startDate = new Date(data.meetingDate + ' ' + data.meetingTime);
        const endDate = new Date(startDate.getTime() + data.duration * 60000);

        const formatDate = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AlphaClone Systems//Meeting//EN
BEGIN:VEVENT
UID:${Date.now()}@alphaclone.com
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${data.meetingTitle}
DESCRIPTION:Join meeting: ${data.joinLink}
LOCATION:${data.joinLink}
ORGANIZER;CN=${data.hostName}:mailto:${data.hostEmail}
ATTENDEE;CN=${data.recipientName}:mailto:${data.recipientEmail}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`;
    }
};
