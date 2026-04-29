/**
 * Task Email Templates
 */

export interface TaskEmailData {
    recipientName: string;
    taskTitle: string;
    taskDescription?: string;
    dueDate?: string;
    priority?: 'low' | 'medium' | 'high';
    actionUrl: string;
    workspaceName: string;
    assignerName?: string;
    commentText?: string;
    commenterName?: string;
}

const baseHtml = (content: string, workspaceName: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; margin-top: 40px; margin-bottom: 40px;}
    .header { background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%); padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: white; font-size: 24px; font-weight: bold; }
    .content { padding: 32px; }
    .text { margin: 0 0 24px 0; color: #cbd5e1; font-size: 16px; line-height: 1.5; }
    .card { background-color: #0f172a; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .card h2 { margin: 0 0 16px 0; color: white; font-size: 18px; }
    .row { margin-bottom: 8px; color: #94a3b8; font-size: 14px; }
    .val { color: white; float: right; font-weight: 500;}
    .btn-container { text-align: center; padding: 16px 0; }
    .btn { display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #14b8a6 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; }
    .footer { padding: 24px; background-color: #0f172a; text-align: center; border-top: 1px solid #334155; }
    .footer-text { margin: 0 0 8px 0; color: #64748b; font-size: 12px; }
    .priority-high { color: #ef4444; }
    .priority-medium { color: #f97316; }
    .priority-low { color: #14b8a6; }
  </style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p class="footer-text">${workspaceName}</p>
      <p style="margin: 0; color: #475569; font-size: 11px;">This is an automated notification. Please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;

function getPriorityStyle(priority?: string) {
    if (priority === 'high') return 'priority-high';
    if (priority === 'medium') return 'priority-medium';
    return 'priority-low';
}

function formatDate(dateString?: string) {
    if (!dateString) return 'No due date';
    try {
        return new Date(dateString).toLocaleDateString();
    } catch {
        return dateString;
    }
}

export const taskEmailTemplates = {
    taskAssigned(data: TaskEmailData): string {
        const content = `
        <div class="header">
          <h1>New Task Assigned</h1>
        </div>
        <div class="content">
          <p class="text">Hi ${data.recipientName},</p>
          <p class="text">${data.assignerName ? `<strong>${data.assignerName}</strong> has assigned` : 'You have been assigned'} a new task in <strong>${data.workspaceName}</strong>.</p>
          
          <div class="card">
            <h2>${data.taskTitle}</h2>
            ${data.priority ? `<div class="row">Priority <span class="val ${getPriorityStyle(data.priority)}">${data.priority.toUpperCase()}</span></div>` : ''}
            <div class="row">Due Date <span class="val">${formatDate(data.dueDate)}</span></div>
            ${data.taskDescription ? `<div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #334155;"><p style="margin: 0; color: #cbd5e1; font-size: 14px;">${data.taskDescription}</p></div>` : ''}
          </div>
          
          <div class="btn-container">
            <a href="${data.actionUrl}" class="btn">View Task</a>
          </div>
        </div>
        `;
        return baseHtml(content, data.workspaceName);
    },

    taskDueSoon(data: TaskEmailData): string {
        const content = `
        <div class="header">
          <h1>Task Due Soon</h1>
        </div>
        <div class="content">
          <p class="text">Hi ${data.recipientName},</p>
          <p class="text">This is a reminder that a task assigned to you is due soon.</p>
          
          <div class="card">
            <h2>${data.taskTitle}</h2>
            ${data.priority ? `<div class="row">Priority <span class="val ${getPriorityStyle(data.priority)}">${data.priority.toUpperCase()}</span></div>` : ''}
            <div class="row">Due Date <span class="val">${formatDate(data.dueDate)}</span></div>
          </div>
          
          <div class="btn-container">
            <a href="${data.actionUrl}" class="btn">View Task</a>
          </div>
        </div>
        `;
        return baseHtml(content, data.workspaceName);
    },

    taskOverdue(data: TaskEmailData): string {
        const content = `
        <div class="header" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);">
          <h1>Task Overdue</h1>
        </div>
        <div class="content">
          <p class="text">Hi ${data.recipientName},</p>
          <p class="text">A task assigned to you is now past its due date.</p>
          
          <div class="card">
            <h2>${data.taskTitle}</h2>
            ${data.priority ? `<div class="row">Priority <span class="val ${getPriorityStyle(data.priority)}">${data.priority.toUpperCase()}</span></div>` : ''}
            <div class="row">Due Date <span class="val priority-high">${formatDate(data.dueDate)}</span></div>
          </div>
          
          <div class="btn-container">
            <a href="${data.actionUrl}" class="btn">Update Task</a>
          </div>
        </div>
        `;
        return baseHtml(content, data.workspaceName);
    },

    taskCompleted(data: TaskEmailData): string {
        const content = `
        <div class="header" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%);">
          <h1>Task Completed ✓</h1>
        </div>
        <div class="content">
          <p class="text">Hi ${data.recipientName},</p>
          <p class="text">A task you created or are watching has been marked as completed.</p>
          
          <div class="card">
            <h2 style="text-decoration: line-through; color: #94a3b8;">${data.taskTitle}</h2>
          </div>
          
          <div class="btn-container">
            <a href="${data.actionUrl}" class="btn">View Task</a>
          </div>
        </div>
        `;
        return baseHtml(content, data.workspaceName);
    },

    taskComment(data: TaskEmailData): string {
        const content = `
        <div class="header">
          <h1>New Task Comment</h1>
        </div>
        <div class="content">
          <p class="text">Hi ${data.recipientName},</p>
          <p class="text"><strong>${data.commenterName || 'Someone'}</strong> left a comment on the task <strong>${data.taskTitle}</strong>.</p>
          
          <div class="card" style="background-color: #1e293b; border: 1px solid #334155;">
            <p style="margin: 0; color: #e2e8f0; font-size: 15px; font-style: italic;">"${data.commentText}"</p>
          </div>
          
          <div class="btn-container">
            <a href="${data.actionUrl}" class="btn">Reply</a>
          </div>
        </div>
        `;
        return baseHtml(content, data.workspaceName);
    }
};
