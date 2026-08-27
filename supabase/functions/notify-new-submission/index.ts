import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normaliseWhatsApp(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "233" + digits.slice(1);
  if (digits && !digits.startsWith("233") && digits.length >= 9) digits = "233" + digits;
  return digits;
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const body = await request.json();
    const sourceTable = String(body?.source_table || "").trim();
    const sourceId = String(body?.source_id || "").trim();
    const customerPhone = String(body?.customer_phone || "").trim();
    const customerEmail = String(body?.customer_email || "").trim().toLowerCase();
    if (!sourceTable) throw new Error("Notification source is missing.");
    if (!["quote_requests", "training_registrations", "enquiries"].includes(sourceTable)) throw new Error("Invalid notification source.");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false } },
    );

    const { data: record, error: recordError } = await supabase
      .from("notifications")
      .select("id,event_type,source_table,source_id,customer_name,phone,whatsapp,email,details,created_at")
      .eq("source_table", sourceTable)
      .eq("source_id", sourceId || "__no_source_id__")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let notification = record;
    if (!notification && !sourceId) {
      const recent = await supabase.from("notifications")
        .select("id,event_type,source_table,source_id,customer_name,phone,whatsapp,email,details,created_at")
        .eq("source_table", sourceTable)
        .or(`phone.eq.${customerPhone},email.eq.${customerEmail}`)
        .gte("created_at", new Date(Date.now()-120000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      if (!recent.error) notification = recent.data?.[0] || null;
    }
    if (recordError && sourceId) throw recordError;

    // Do not depend solely on a database trigger. If an installation has not
    // created the notification trigger yet, build the notification record
    // directly from the newly submitted request.
    if (!notification && sourceId) {
      const allowedColumns = sourceTable === "training_registrations"
        ? "id,full_name,phone,whatsapp,email,location,course,message,created_at"
        : sourceTable === "quote_requests"
          ? "id,full_name,phone,whatsapp,email,location,service,journey,created_at"
          : "id,full_name,phone,whatsapp,email,subject,message,created_at";
      const sourceResult = await supabase.from(sourceTable).select(allowedColumns).eq("id", sourceId).maybeSingle();
      if (sourceResult.error) throw sourceResult.error;
      const source = sourceResult.data;
      if (source) {
        const details = sourceTable === "quote_requests"
          ? (() => { try { return JSON.parse(source.journey || "{}"); } catch (_) { return { details: source.journey || "" }; } })()
          : {
              location: source.location || "",
              course: source.course || "",
              subject: source.subject || "",
              message: source.message || ""
            };
        const inserted = await supabase.from("notifications").insert({
          event_type: sourceTable === "training_registrations" ? "Training Registration" : sourceTable === "quote_requests" ? "Order / Quote Request" : "Enquiry",
          source_table: sourceTable,
          source_id: sourceId,
          customer_name: source.full_name || "Customer",
          phone: source.phone || "",
          whatsapp: source.whatsapp || "",
          email: source.email || "",
          details,
        }).select("id,event_type,source_table,source_id,customer_name,phone,whatsapp,email,details,created_at").maybeSingle();
        if (inserted.error) throw inserted.error;
        notification = inserted.data || null;
      }
    }

    if (!notification) throw new Error("Notification record not found.");

    const { data: contact } = await supabase
      .from("contact_settings")
      .select("email,whatsapp,phone,business_name")
      .limit(1)
      .maybeSingle();

    const businessName = contact?.business_name || "Aprils Signature";
    const destinationEmail = contact?.email || Deno.env.get("NOTIFY_EMAIL_FALLBACK") || "";
    const destinationWhatsApp = normaliseWhatsApp(contact?.whatsapp || contact?.phone || Deno.env.get("NOTIFY_WHATSAPP_FALLBACK") || "");
    const details = typeof notification.details === "object" ? notification.details : {};
    const message = [
      `${businessName} — ${notification.event_type}`,
      `Customer: ${notification.customer_name || "Customer"}`,
      `Phone: ${notification.phone || "—"}`,
      `WhatsApp: ${notification.whatsapp || "—"}`,
      `Email: ${notification.email || "—"}`,
      `Details: ${JSON.stringify(details)}`,
      `Received: ${notification.created_at || new Date().toISOString()}`,
    ].join("\n");

    const results: Record<string, unknown> = {};
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && destinationEmail) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("NOTIFY_EMAIL_FROM") || "Aprils Signature <onboarding@resend.dev>",
          to: [destinationEmail], subject: `${businessName} — ${notification.event_type}`, text: message,
        }),
      });
      results.email = { ok: emailResponse.ok, status: emailResponse.status };
    } else results.email = { skipped: true, reason: "Email provider is not configured" };

    const waToken = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN");
    const waPhoneId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID");
    const templateName = Deno.env.get("META_WHATSAPP_TEMPLATE_NAME");
    const templateLanguage = Deno.env.get("META_WHATSAPP_TEMPLATE_LANGUAGE") || "en_US";
    if (waToken && waPhoneId && destinationWhatsApp && templateName) {
      const waResponse = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}/messages`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${waToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: destinationWhatsApp, type: "template",
          template: { name: templateName, language: { code: templateLanguage }, components: [
            { type: "body", parameters: [
              { type: "text", text: notification.event_type },
              { type: "text", text: notification.customer_name || "Customer" },
              { type: "text", text: notification.phone || "—" },
            ] }
          ] }
        }),
      });
      results.whatsapp = { ok: waResponse.ok, status: waResponse.status };
    } else results.whatsapp = { skipped: true, reason: "WhatsApp provider/template is not configured" };

    await supabase.from("notifications").update({ status: "sent" }).eq("id", notification.id);
    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ ok: false, error: String(error?.message || error) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
