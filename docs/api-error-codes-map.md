# API Error Codes Map

This map covers the routes updated during the recent hardening pass.
Response envelope for errors is:

- `error: string`
- `code: string`
- `details?: object` (validation failures)

## CRM and Contact

- `POST /api/contact`
  - `VALIDATION_ERROR`

- `POST /api/leads/management`
  - `VALIDATION_ERROR`

## Email and Campaigns

- `POST /api/email/send`
  - `EMAIL_SUPPRESSED`
  - `SENDGRID_ERROR`
  - `RESEND_ERROR`

- `GET/POST/PATCH/DELETE /api/email/campaigns`
  - `VALIDATION_ERROR`
  - `CAMPAIGN_CONTACTS_FETCH_FAILED`
  - `CAMPAIGNS_FETCH_FAILED`
  - `CONTACTS_FETCH_FAILED`
  - `CAMPAIGN_RECIPIENTS_FETCH_FAILED`
  - `PREVIOUS_RECIPIENTS_FETCH_FAILED`
  - `RECIPIENTS_INSERT_FAILED`
  - `CAMPAIGN_CREATE_FAILED`
  - `CAMPAIGN_UPDATE_FAILED`
  - `CAMPAIGN_DELETE_FAILED`

- `POST /api/email/campaigns/send`
  - `VALIDATION_ERROR`
  - `CAMPAIGN_SEND_FAILED`

- `POST /api/sendgrid/send`
  - `VALIDATION_ERROR`

- `POST /api/resend/send`
  - `VALIDATION_ERROR`

- `GET/POST/DELETE /api/integrations/email-providers`
  - `VALIDATION_ERROR`
  - `INTEGRATION_FETCH_FAILED`
  - `INTEGRATION_UPSERT_FAILED`
  - `INTEGRATION_DELETE_FAILED`

- `POST /api/resend/connect`
  - `VALIDATION_ERROR`
  - `INTEGRATION_UPSERT_FAILED`

- `POST /api/resend/disconnect`
  - `VALIDATION_ERROR`
  - `INTEGRATION_UPDATE_FAILED`

- `POST /api/webhooks/email`
  - `UNAUTHORIZED` (invalid webhook token)

## Social and Messaging

- `POST /api/slack/resend`
  - `VALIDATION_ERROR`
  - `NOT_FOUND`
  - `INTEGRATION_NOT_FOUND`
  - `SLACK_API_ERROR`

- `POST /api/social/media/upload`
  - `STORAGE_UPLOAD_FAILED`
  - `MEDIA_DB_ERROR`

## Scraper

- `POST /api/scraper/search`
  - `VALIDATION_ERROR`

- `POST /api/scraper/affordable`
  - `VALIDATION_ERROR`

- `POST /api/scraper/email-discovery`
  - `VALIDATION_ERROR`

- `POST /api/scraper/deep-crawl`
  - `VALIDATION_ERROR`
  - `DEEP_CRAWL_FAILED`

- `POST /api/scraper/jobs/create`
  - `VALIDATION_ERROR`
  - `FORBIDDEN`
  - `LEAD_QUEUE_NOT_READY`
  - `LEAD_QUEUE_PERMISSION_DENIED`

- `GET /api/scraper/jobs/[id]`
  - `VALIDATION_ERROR`
  - `NOT_FOUND`

- `POST /api/scraper/jobs/[id]/step`
  - `VALIDATION_ERROR`
  - `NOT_FOUND`

## Invoices and Accounting

- `DELETE /api/invoices/[id]`
  - `VALIDATION_ERROR`
  - `NOT_FOUND`
  - `INVOICE_DELETE_FORBIDDEN`

- `POST /api/invoices/[id]/void`
  - `VALIDATION_ERROR`
  - `NOT_FOUND`
  - `ALREADY_VOID`

- `POST /api/cron/process-invoice-overdue-reminders`
  - `UNAUTHORIZED`
  - `CRON_FAILED`

## Notes for Frontend

- Treat `VALIDATION_ERROR` as field-level form feedback.
- Treat `NOT_FOUND` as stale/deleted resource.
- Treat `FORBIDDEN` and `UNAUTHORIZED` as auth/permission UI states.
- Treat all other codes as operation-specific failures and surface action-oriented retry messaging.
