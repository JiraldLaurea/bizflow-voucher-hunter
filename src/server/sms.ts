// Provider-agnostic SMS sending layer.
// Configure via environment variables:
//   SMS_PROVIDER=movider|twilio|infobip|clicksend|mock (defaults to mock)
//   SMS_API_KEY, SMS_API_SECRET, SMS_SENDER_ID

export type SmsResult = {
  success: boolean;
  providerMessageId?: string;
  error?: string;
};

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "mock";

  if (provider === "movider") return sendViaMovider(phone, message);
  if (provider === "twilio") return sendViaTwilio(phone, message);
  if (provider === "infobip") return sendViaInfobip(phone, message);
  if (provider === "clicksend") return sendViaClickSend(phone, message);

  // Mock provider: logs the message and always succeeds. Used for local/demo.
  console.log(`[SMS MOCK] To: ${phone}\n${message}\n`);
  return { success: true, providerMessageId: `mock_${Date.now()}` };
}

// ---- Movider (Philippines) ----
// Docs: https://developer.movider.co
// Env vars: SMS_API_KEY, SMS_API_SECRET, SMS_SENDER_ID (optional, defaults to "BizFlow")

async function sendViaMovider(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.SMS_API_KEY;
  const apiSecret = process.env.SMS_API_SECRET;
  const from = process.env.SMS_SENDER_ID ?? "BizFlow";

  if (!apiKey || !apiSecret) {
    return { success: false, error: "Movider credentials not configured (SMS_API_KEY, SMS_API_SECRET)" };
  }

  const body = new URLSearchParams({
    api_key: apiKey,
    api_secret: apiSecret,
    to: phone,
    text: message,
    from
  });

  try {
    const res = await fetch("https://api.movider.co/v1/sms", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });

    // Movider's /v1/sms response indicates success by returning a message_id
    // for each recipient in phone_number_list; failures come back as a
    // top-level `error` array (e.g. [{ code, message }]), not a status field.
    const data = (await res.json()) as {
      phone_number_list?: Array<{ message_id?: string }>;
      error?: Array<{ code?: number | string; message?: string }> | string;
      error_text?: string;
    };

    const rawErr = Array.isArray(data.error)
      ? data.error.map((e) => `${e.code ?? ""}:${e.message ?? ""}`).join("; ")
      : typeof data.error === "string"
        ? data.error
        : undefined;

    if (!res.ok || rawErr) {
      return { success: false, error: rawErr ?? data.error_text ?? `Movider HTTP ${res.status}: ${JSON.stringify(data)}` };
    }

    const result = data.phone_number_list?.[0];
    if (result?.message_id) {
      return { success: true, providerMessageId: result.message_id };
    }

    return { success: false, error: `Movider: no message_id in response: ${JSON.stringify(data)}` };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ---- Twilio ----

async function sendViaTwilio(phone: string, message: string): Promise<SmsResult> {
  const accountSid = process.env.SMS_API_KEY;
  const authToken = process.env.SMS_API_SECRET;
  const from = process.env.SMS_SENDER_ID ?? process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return { success: false, error: "Twilio credentials not configured" };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({ To: phone, From: from, Body: message });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body
    });
    const data = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) return { success: false, error: data.message ?? "Twilio error" };
    return { success: true, providerMessageId: data.sid };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ---- Infobip ----

async function sendViaInfobip(phone: string, message: string): Promise<SmsResult> {
  const apiKey = process.env.SMS_API_KEY;
  const baseUrl = process.env.INFOBIP_BASE_URL;
  const sender = process.env.SMS_SENDER_ID ?? "BizFlow";

  if (!apiKey || !baseUrl) {
    return { success: false, error: "Infobip credentials not configured" };
  }

  try {
    const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: `App ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        messages: [{ from: sender, destinations: [{ to: phone }], text: message }]
      })
    });
    const data = (await res.json()) as {
      messages?: Array<{ messageId?: string; status?: { groupName?: string; description?: string } }>;
    };
    if (!res.ok) return { success: false, error: "Infobip error" };
    const msg = data.messages?.[0];
    return {
      success: msg?.status?.groupName !== "REJECTED",
      providerMessageId: msg?.messageId,
      error: msg?.status?.groupName === "REJECTED" ? msg.status?.description : undefined
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// ---- ClickSend ----

async function sendViaClickSend(phone: string, message: string): Promise<SmsResult> {
  const username = process.env.SMS_API_KEY;
  const apiKey = process.env.SMS_API_SECRET;
  const sender = process.env.SMS_SENDER_ID ?? "BizFlow";

  if (!username || !apiKey) {
    return { success: false, error: "ClickSend credentials not configured" };
  }

  try {
    const res = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages: [{ source: "sdk", body: message, to: phone, from: sender }]
      })
    });
    const data = (await res.json()) as { data?: { messages?: Array<{ message_id?: string; status?: string }> } };
    if (!res.ok) return { success: false, error: "ClickSend error" };
    const msg = data.data?.messages?.[0];
    return { success: msg?.status === "SUCCESS", providerMessageId: msg?.message_id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
