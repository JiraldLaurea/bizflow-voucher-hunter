// Provider-agnostic SMS sending layer.
// Configure via environment variables:
//   SMS_PROVIDER=smpp|movider|twilio|infobip|clicksend|mock (defaults to mock)
//   SMS_API_KEY, SMS_API_SECRET, SMS_SENDER_ID

import { recordSmsDeliveryReceipt } from "@/server/sms-delivery-receipts";

export type SmsResult = {
  success: boolean;
  providerMessageId?: string;
  error?: string;
};

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "mock";

  if (provider === "smpp") return sendViaSmpp(phone, message);
  if (provider === "movider") return sendViaMovider(phone, message);
  if (provider === "twilio") return sendViaTwilio(phone, message);
  if (provider === "infobip") return sendViaInfobip(phone, message);
  if (provider === "clicksend") return sendViaClickSend(phone, message);

  // Mock provider: logs the message and always succeeds. Used for local/demo.
  console.log(`[SMS MOCK] To: ${phone}\n${message}\n`);
  return { success: true, providerMessageId: `mock_${Date.now()}` };
}

// ---- SMPP (direct SMSC / local Philippine aggregator) ----
// Binds a long-lived SMPP session (reused across sends) and issues submit_sm.
// Env vars: SMPP_HOST, SMPP_PORT (2775), SMPP_SYSTEM_ID, SMPP_PASSWORD,
//   SMPP_BIND_TYPE (transceiver|transmitter), plus optional per-carrier sender
//   IDs and TON/NPI/timeout tuning (see .env.example).

type SmppPdu = {
  command?: string;
  command_status?: number;
  message_id?: string | Buffer;
  message_state?: number | string;
  receipted_message_id?: string | Buffer;
  short_message?: unknown;
  response?: (options?: Record<string, unknown>) => unknown;
};

type SmppSession = {
  bind_transceiver: (options: Record<string, unknown>, callback: (pdu: SmppPdu) => void) => void;
  bind_transmitter: (options: Record<string, unknown>, callback: (pdu: SmppPdu) => void) => void;
  submit_sm: (options: Record<string, unknown>, callback: (pdu: SmppPdu) => void) => void;
  send: (pdu: unknown) => void;
  close: () => void;
  destroy: () => void;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
};

type SmppModule = {
  connect: (options: Record<string, unknown>, callback: () => void) => SmppSession;
};

let smppSessionPromise: Promise<SmppSession> | null = null;
let smppSession: SmppSession | null = null;

async function sendViaSmpp(phone: string, message: string): Promise<SmsResult> {
  const host = process.env.SMPP_HOST;
  const port = process.env.SMPP_PORT ?? "2775";
  const systemId = process.env.SMPP_SYSTEM_ID;
  const password = process.env.SMPP_PASSWORD;
  const bindType = process.env.SMPP_BIND_TYPE ?? "transceiver";

  if (!host || !systemId || !password) {
    return { success: false, error: "SMPP credentials not configured (SMPP_HOST, SMPP_SYSTEM_ID, SMPP_PASSWORD)" };
  }

  try {
    const session = await getSmppSession({ host, port, systemId, password, bindType });
    const baseParams = {
      source_addr: selectSmppSourceAddress(phone),
      source_addr_ton: getEnvNumber("SMPP_SOURCE_ADDR_TON", 5),
      source_addr_npi: getEnvNumber("SMPP_SOURCE_ADDR_NPI", 0),
      destination_addr: phone,
      dest_addr_ton: getEnvNumber("SMPP_DEST_ADDR_TON", 1),
      dest_addr_npi: getEnvNumber("SMPP_DEST_ADDR_NPI", 1),
      registered_delivery: getEnvNumber("SMPP_REGISTERED_DELIVERY", 1)
    };

    // A single short_message caps at 254 octets and the SMSC rejects the
    // message_payload TLV, so longer bodies are split into UDH-concatenated parts
    // and submitted in sequence. The first part's message id represents the send.
    const parts = buildSmppMessageParts(message);
    let firstMessageId: string | undefined;
    for (const part of parts) {
      const pdu = await submitOnePart(session, { ...baseParams, ...part });
      if (pdu.command_status !== 0) {
        return { success: false, error: `SMPP submit_sm failed with command_status=${pdu.command_status ?? "unknown"}` };
      }
      if (firstMessageId === undefined && pdu.message_id) firstMessageId = String(pdu.message_id);
    }
    return { success: true, providerMessageId: firstMessageId };
  } catch (error) {
    resetSmppSession();
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function getSmppSession(options: { host: string; port: string; systemId: string; password: string; bindType: string }) {
  if (smppSession) return Promise.resolve(smppSession);
  if (smppSessionPromise) return smppSessionPromise;

  smppSessionPromise = new Promise<SmppSession>((resolve, reject) => {
    // Loaded lazily via require so the native TCP dependency is pulled in only
    // when SMPP is the active provider (and never bundled into the client).
    const smpp = require("smpp") as SmppModule;
    const timeout = setTimeout(() => {
      resetSmppSession();
      reject(new Error("SMPP bind timed out"));
    }, getEnvNumber("SMPP_BIND_TIMEOUT_MS", 30000));

    const session = smpp.connect(
      {
        url: `smpp://${options.host}:${options.port}`,
        auto_enquire_link_period: getEnvNumber("SMPP_ENQUIRE_LINK_MS", 10000),
        connectTimeout: getEnvNumber("SMPP_CONNECT_TIMEOUT_MS", 30000),
        debug: process.env.SMPP_DEBUG === "true"
      },
      () => {
        const bindOptions = {
          system_id: options.systemId,
          password: options.password
        };
        const bind =
          options.bindType === "transmitter" ? session.bind_transmitter.bind(session) : session.bind_transceiver.bind(session);

        bind(bindOptions, (pdu) => {
          clearTimeout(timeout);
          if (pdu.command_status === 0) {
            smppSession = session;
            return resolve(session);
          }
          resetSmppSession();
          // Free the TCP socket of a session that connected but never bound, so
          // the SMSC does not keep counting it against a single-bind account.
          closeQuietly(session);
          reject(new Error(`SMPP bind failed with command_status=${pdu.command_status ?? "unknown"}`));
        });
      }
    );

    // Inbound delivery receipts (DLRs): persist the final delivery state and ACK
    // so the SMSC does not resend, then keep the link alive on enquire_link.
    session.on("deliver_sm", (pdu: unknown) => {
      const deliverPdu = pdu as SmppPdu;
      void recordSmsDeliveryReceipt({
        providerMessageId: deliverPdu.message_id ? String(deliverPdu.message_id) : null,
        messageState: deliverPdu.message_state,
        receiptedMessageId: deliverPdu.receipted_message_id,
        shortMessage: deliverPdu.short_message
      }).catch((error) => {
        console.error("[SMPP DLR] Unable to record delivery receipt", error);
      });
      if (deliverPdu.response) session.send(deliverPdu.response());
    });
    session.on("enquire_link", (pdu: unknown) => {
      const enquirePdu = pdu as SmppPdu;
      if (enquirePdu.response) session.send(enquirePdu.response());
    });
    session.on("close", () => resetSmppSession());
    session.on("error", (error) => {
      resetSmppSession();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });

  return smppSessionPromise;
}

function resetSmppSession() {
  const stale = smppSession;
  smppSession = null;
  smppSessionPromise = null;
  // Close the previously-bound session so the SMSC releases its bind; otherwise a
  // reconnect can be rejected with ESME_ALREADYBOUND on single-bind accounts.
  if (stale) closeQuietly(stale);
}

function closeQuietly(session: SmppSession) {
  try {
    session.close();
  } catch {
    // Session may already be closing/destroyed; nothing to do.
  }
}

function getEnvNumber(key: string, fallback: number) {
  const value = Number(process.env[key]);
  return Number.isFinite(value) ? value : fallback;
}

// GSM 03.38 default alphabet: basic characters cost one septet, extension-table
// characters cost two. Anything outside both forces UCS-2 (two bytes/char).
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";

// True when the message fits a single SMS part, so it can ride in short_message.
// GSM single part = 160 septets; UCS-2 single part = 70 characters. Exported for
// tests: routing long bodies away from short_message avoids the 254-octet cap.
// Septet cost of a character in the GSM 03.38 alphabet, or null if it is not
// representable in GSM (which forces the whole message to UCS-2).
function gsmSeptets(ch: string): number | null {
  if (GSM_BASIC.includes(ch)) return 1;
  if (GSM_EXTENDED.includes(ch)) return 2;
  return null;
}

function isGsmSafe(message: string) {
  for (const ch of message) if (gsmSeptets(ch) === null) return false;
  return true;
}

export function fitsSingleSmsPart(message: string) {
  let septets = 0;
  for (const ch of message) {
    const cost = gsmSeptets(ch);
    if (cost === null) return [...message].length <= 70; // non-GSM char -> UCS-2 (70/part)
    septets += cost;
  }
  return septets <= 160;
}

// Builds the per-part submit_sm payload fields. A single-part message rides
// inline in short_message with the library's auto-detected encoding. A longer
// message is split into UDH-concatenated parts: GSM (153 septets/part) when the
// text is GSM-safe — the cheaper path — otherwise UCS-2 (67 chars/part). Both are
// byte-aligned as node-smpp emits them, so prepending the 6-byte concatenation
// header needs no 7-bit fill-bit handling.
export function buildSmppMessageParts(message: string): Array<Record<string, unknown>> {
  if (fitsSingleSmsPart(message)) {
    return [{ short_message: message }];
  }
  return isGsmSafe(message) ? splitGsmParts(message) : splitUcs2Parts(message);
}

// GSM multipart: pack up to 153 septets per part (extension chars cost 2), never
// splitting an escaped extension char across parts. data_coding 0 = GSM.
function splitGsmParts(message: string): Array<Record<string, unknown>> {
  const chunks: string[] = [];
  let current = "";
  let septets = 0;
  for (const ch of message) {
    const cost = gsmSeptets(ch) ?? 1;
    if (septets + cost > 153) {
      chunks.push(current);
      current = "";
      septets = 0;
    }
    current += ch;
    septets += cost;
  }
  if (current) chunks.push(current);
  return buildUdhParts(chunks, 0);
}

// UCS-2 multipart: 67 UTF-16 chars per part leaves room for the UDH in 140 octets.
function splitUcs2Parts(message: string): Array<Record<string, unknown>> {
  const chars = [...message];
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += 67) {
    chunks.push(chars.slice(i, i + 67).join(""));
  }
  return buildUdhParts(chunks, 8);
}

function buildUdhParts(chunks: string[], dataCoding: number): Array<Record<string, unknown>> {
  const total = chunks.length;
  const ref = Math.floor(Math.random() * 256); // concatenation reference (shared across parts)
  return chunks.map((chunk, i) => ({
    esm_class: 0x40, // UDH indicator
    data_coding: dataCoding,
    // UDH: length(05) | IEI(00 = concatenated, 8-bit ref) | IEDL(03) | ref | total | seq
    short_message: { udh: Buffer.from([0x05, 0x00, 0x03, ref, total, i + 1]), message: chunk }
  }));
}

// Submits one PDU and resolves with its response (or a synthetic timeout PDU),
// so parts can be awaited sequentially.
function submitOnePart(session: SmppSession, params: Record<string, unknown>): Promise<SmppPdu> {
  return new Promise<SmppPdu>((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ command_status: -1 }); // surfaces as a submit failure with an unknown status
    }, getEnvNumber("SMPP_SUBMIT_TIMEOUT_MS", 30000));
    session.submit_sm(params, (pdu) => {
      clearTimeout(timeout);
      resolve(pdu);
    });
  });
}

// Picks the sender ID registered for the recipient's carrier when configured;
// PH SMSCs commonly require Smart/Globe traffic to originate from a matching
// registered sender. Falls back to a single default sender otherwise.
function selectSmppSourceAddress(phone: string) {
  const smartSender = process.env.SMPP_SOURCE_ADDR_SMART;
  const globeSender = process.env.SMPP_SOURCE_ADDR_GLOBE;
  const defaultSender = process.env.SMPP_SOURCE_ADDR ?? process.env.SMS_SENDER_ID ?? "BizFlow";

  if (smartSender && isLikelySmartNumber(phone)) return smartSender;
  if (globeSender && isLikelyGlobeNumber(phone)) return globeSender;
  return defaultSender;
}

function isLikelySmartNumber(phone: string) {
  const prefix = phone.replace(/\D/g, "").slice(0, 5);
  return [
    "63907", "63908", "63909", "63910", "63911", "63912", "63913", "63914",
    "63918", "63919", "63920", "63921", "63928", "63929", "63930", "63938",
    "63939", "63946", "63947", "63948", "63949", "63950", "63951", "63961",
    "63963", "63968", "63970", "63981", "63989", "63998", "63999"
  ].includes(prefix);
}

function isLikelyGlobeNumber(phone: string) {
  const prefix = phone.replace(/\D/g, "").slice(0, 5);
  return [
    "63905", "63906", "63915", "63916", "63917", "63926", "63927", "63935",
    "63936", "63937", "63945", "63953", "63954", "63955", "63956", "63957",
    "63958", "63959", "63965", "63966", "63967", "63975", "63976", "63977",
    "63978", "63979", "63995", "63996", "63997"
  ].includes(prefix);
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
