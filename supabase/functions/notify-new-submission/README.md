# Aprils Signature — Submission Notifications

This Edge Function sends a notification when a quote request, training registration, or enquiry is received.

## What is automatic

The public website stores the submission in Supabase first. The notification function then sends the business notification to the configured email address and/or WhatsApp Business destination.

## Required Supabase secrets

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` automatically.

Add these secrets in Supabase Edge Function secrets:

- `RESEND_API_KEY`
- `NOTIFY_EMAIL_FROM` — for example `Aprils Signature <notifications@aprilssignature.com>`
- `NOTIFY_EMAIL_FALLBACK` — optional
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_TEMPLATE_NAME`
- `META_WHATSAPP_TEMPLATE_LANGUAGE` — normally `en_US`
- `NOTIFY_WHATSAPP_FALLBACK` — optional

The function reads the current business email and WhatsApp number from `contact_settings`, so changing them in Admin → Contact Information updates future notifications.

## Deploy

Deploy this function as:

`notify-new-submission`

Then create a Supabase Database Webhook:

- Table: `public.notifications`
- Event: `INSERT`
- Method: `POST`
- Target: `notify-new-submission`

Do not put any provider secret, Meta access token, Resend key, or service-role key in the website JavaScript.

## WhatsApp requirement

Automatic WhatsApp delivery requires an approved WhatsApp Business/Meta Cloud API setup and a template that is approved for the message type being sent. A normal `wa.me` link cannot send an unattended server notification.
