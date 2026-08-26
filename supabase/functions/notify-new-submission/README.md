# notify-new-submission

This function receives a Supabase Database Webhook for a newly-created `public.notificatis` row and sends the business notification through server-side providers

## Secrets / environment variables

Supabase automatically provides:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Add these secrets:

- `RESEND_API_KEY`
- `NOTIFY_EMAIL_FROM` (example: `Aprils Signature <notifications@your-domain>`)
- `NOTIFY_EMAIL_FALLBACK` (optional)
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_TEMPLATE_NAME`
- `META_WHATSAPP_TEMPLATE_LANGUAGE` (default `en_US`)
- `NOTIFY_WHATSAPP_FALLBACK` (optional)

The function also reads the current website email/WhatsApp number from `contact_settings`, so changing those values in Admin → Contact Information updates future notifications.

## Webhook

Create a Supabase Database Webhook:

- Table: `public.notifications`
- Event: `INSERT`
- Method: `POST`
- Target: this Edge Function

Do not expose the function's service-role credentials to the browser.
