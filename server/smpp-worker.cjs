/*
 * Persistent SMPP worker.
 *
 * Why this exists: the SMSC whitelists a single client IP and permits one
 * concurrent bind. Vercel functions egress from a large shared pool with a
 * different address per invocation, so a bind from there is never answered —
 * it times out. SMPP also assumes a long-lived session, which a runtime that
 * freezes between requests cannot hold.
 *
 * So the bind lives here instead: one process, one session, on a host with the
 * whitelisted static IP. The app POSTs /messages over HTTP and this relays it.
 *
 *   node server/smpp-worker.cjs      (npm run start:smpp-worker)
 *
 * Required env:
 *   SMPP_WORKER_API_TOKEN        bearer token the app must present
 *   SMPP_DLR_CALLBACK_URL        app URL that receives delivery receipts
 *   SMPP_WORKER_CALLBACK_SECRET  bearer token this worker presents to that URL
 *   SMPP_HOST, SMPP_SYSTEM_ID, SMPP_PASSWORD
 *
 * Optional: SMPP_PORT (2775), SMPP_BIND_TYPE, SMPP_WORKER_PORT (8080),
 *   SMPP_SOURCE_ADDR[_SMART|_GLOBE], SMS_SENDER_ID, the TON/NPI pairs,
 *   SMPP_REGISTERED_DELIVERY, and the three timeouts.
 */
const http = require("http");
const smpp = require("smpp");

const port = Number(process.env.SMPP_WORKER_PORT || 8080);
const apiToken = required("SMPP_WORKER_API_TOKEN");
const callbackUrl = required("SMPP_DLR_CALLBACK_URL");
const callbackSecret = required("SMPP_WORKER_CALLBACK_SECRET");
const host = required("SMPP_HOST");
const systemId = required("SMPP_SYSTEM_ID");
const password = required("SMPP_PASSWORD");
const smppPort = Number(process.env.SMPP_PORT || 2775);

let sessionPromise = null;
let session = null;

function required(name) {
  const value = process.env[name];
  if (!value || value.startsWith("replace_with_")) throw new Error(`${name} must be configured.`);
  return value;
}

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

/**
 * The bind is paid once, at first use, and then reused for the process's
 * lifetime — the whole point of running outside serverless. Timeouts are
 * generous here for the same reason: nothing is waiting on a request budget.
 */
function getSession() {
  if (session) return Promise.resolve(session);
  if (sessionPromise) return sessionPromise;

  sessionPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resetSession();
      reject(new Error("SMPP bind timed out"));
    }, envNumber("SMPP_BIND_TIMEOUT_MS", 30000));

    const nextSession = smpp.connect(
      {
        url: `smpp://${host}:${smppPort}`,
        auto_enquire_link_period: envNumber("SMPP_ENQUIRE_LINK_MS", 10000),
        connectTimeout: envNumber("SMPP_CONNECT_TIMEOUT_MS", 30000),
        debug: process.env.SMPP_DEBUG === "true",
      },
      () => {
        const bind =
          process.env.SMPP_BIND_TYPE === "transmitter"
            ? nextSession.bind_transmitter.bind(nextSession)
            : nextSession.bind_transceiver.bind(nextSession);
        bind({ system_id: systemId, password }, (pdu) => {
          clearTimeout(timeout);
          if (pdu.command_status === 0) {
            session = nextSession;
            console.log("[SMPP worker] bound");
            resolve(nextSession);
            return;
          }
          resetSession();
          closeQuietly(nextSession);
          reject(new Error(`SMPP bind failed with command_status=${pdu.command_status ?? "unknown"}`));
        });
      },
    );

    // Delivery receipts arrive on this session, which is why the worker — not
    // the app — has to forward them.
    nextSession.on("deliver_sm", (pdu) => {
      void forwardDeliveryReceipt({
        providerMessageId: pdu.message_id ? String(pdu.message_id) : undefined,
        receiptedMessageId: pdu.receipted_message_id ? String(pdu.receipted_message_id) : undefined,
        messageState: pdu.message_state,
        shortMessage: normalizeShortMessage(pdu.short_message),
      });
      if (pdu.response) nextSession.send(pdu.response());
    });
    nextSession.on("enquire_link", (pdu) => {
      if (pdu.response) nextSession.send(pdu.response());
    });
    nextSession.on("close", () => {
      console.warn("[SMPP worker] session closed; will rebind on next send");
      resetSession();
    });
    nextSession.on("error", (error) => {
      resetSession();
      console.error("[SMPP worker] session error", error);
    });
  });
  return sessionPromise;
}

function resetSession() {
  session = null;
  sessionPromise = null;
}

function closeQuietly(target) {
  try {
    target.close();
  } catch {
    // Already closing; the SMSC releases the bind either way.
  }
}

// ---- Message segmentation ----
// Mirrors buildSmppMessageParts() in src/server/sms.ts. Kept in step by hand:
// this file is plain CJS run outside Next, so it cannot import the TypeScript.
// The voucher confirmation body exceeds one part, and the SMSC rejects the
// message_payload TLV, so UDH concatenation is the only route for long bodies.

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€";

function gsmSeptets(ch) {
  if (GSM_BASIC.includes(ch)) return 1;
  if (GSM_EXTENDED.includes(ch)) return 2;
  return null;
}

function isGsmSafe(message) {
  for (const ch of message) if (gsmSeptets(ch) === null) return false;
  return true;
}

function fitsSingleSmsPart(message) {
  let septets = 0;
  for (const ch of message) {
    const cost = gsmSeptets(ch);
    if (cost === null) return [...message].length <= 70;
    septets += cost;
  }
  return septets <= 160;
}

function buildUdhParts(chunks, dataCoding) {
  const total = chunks.length;
  const ref = Math.floor(Math.random() * 256);
  return chunks.map((chunk, i) => ({
    esm_class: 0x40,
    data_coding: dataCoding,
    short_message: { udh: Buffer.from([0x05, 0x00, 0x03, ref, total, i + 1]), message: chunk },
  }));
}

function splitGsmParts(message) {
  const chunks = [];
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

function splitUcs2Parts(message) {
  const chars = [...message];
  const chunks = [];
  for (let i = 0; i < chars.length; i += 67) chunks.push(chars.slice(i, i + 67).join(""));
  return buildUdhParts(chunks, 8);
}

function buildMessageParts(message) {
  if (fitsSingleSmsPart(message)) return [{ short_message: message }];
  return isGsmSafe(message) ? splitGsmParts(message) : splitUcs2Parts(message);
}

// ---- Sending ----

function submitOnePart(activeSession, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("SMPP submit_sm timed out")),
      envNumber("SMPP_SUBMIT_TIMEOUT_MS", 30000),
    );
    activeSession.submit_sm(params, (pdu) => {
      clearTimeout(timeout);
      if (pdu.command_status === 0) {
        resolve(pdu.message_id ? String(pdu.message_id) : undefined);
        return;
      }
      reject(new Error(`SMPP submit_sm failed with command_status=${pdu.command_status ?? "unknown"}`));
    });
  });
}

async function submitMessage(to, message) {
  const activeSession = await getSession();
  const baseParams = {
    source_addr: selectSourceAddress(to),
    source_addr_ton: envNumber("SMPP_SOURCE_ADDR_TON", 5),
    source_addr_npi: envNumber("SMPP_SOURCE_ADDR_NPI", 0),
    destination_addr: to,
    dest_addr_ton: envNumber("SMPP_DEST_ADDR_TON", 1),
    dest_addr_npi: envNumber("SMPP_DEST_ADDR_NPI", 1),
    registered_delivery: envNumber("SMPP_REGISTERED_DELIVERY", 1),
  };

  // The first part's message id represents the send, matching what the app
  // stores as provider_message_id and what DLRs are reconciled against.
  let firstMessageId;
  for (const part of buildMessageParts(message)) {
    const messageId = await submitOnePart(activeSession, { ...baseParams, ...part });
    if (firstMessageId === undefined) firstMessageId = messageId;
  }
  return firstMessageId;
}

async function forwardDeliveryReceipt(receipt) {
  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${callbackSecret}`, "Content-Type": "application/json" },
      body: JSON.stringify(receipt),
    });
    if (!response.ok) console.error(`[SMPP worker] DLR callback failed with HTTP ${response.status}`);
  } catch (error) {
    console.error("[SMPP worker] DLR callback failed", error);
  }
}

function normalizeShortMessage(value) {
  if (!value) return "";
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (typeof value === "object" && value.message) {
    return Buffer.isBuffer(value.message) ? value.message.toString("utf8") : String(value.message);
  }
  return String(value);
}

// PH SMSCs require Smart/Globe traffic to originate from a sender ID registered
// for that carrier. Mirrors selectSmppSourceAddress() in src/server/sms.ts.
const SMART_PREFIXES = new Set([
  "63907", "63908", "63909", "63910", "63911", "63912", "63913", "63914", "63918", "63919",
  "63920", "63921", "63928", "63929", "63930", "63938", "63939", "63946", "63947", "63948",
  "63949", "63950", "63951", "63961", "63963", "63968", "63970", "63981", "63989", "63998", "63999",
]);
const GLOBE_PREFIXES = new Set([
  "63905", "63906", "63915", "63916", "63917", "63926", "63927", "63935", "63936", "63937",
  "63945", "63953", "63954", "63955", "63956", "63957", "63958", "63959", "63965", "63966",
  "63967", "63975", "63976", "63977", "63978", "63979", "63995", "63996", "63997",
]);

function selectSourceAddress(phone) {
  const prefix = String(phone).replace(/\D/g, "").slice(0, 5);
  if (SMART_PREFIXES.has(prefix) && process.env.SMPP_SOURCE_ADDR_SMART) {
    return process.env.SMPP_SOURCE_ADDR_SMART;
  }
  if (GLOBE_PREFIXES.has(prefix) && process.env.SMPP_SOURCE_ADDR_GLOBE) {
    return process.env.SMPP_SOURCE_ADDR_GLOBE;
  }
  return process.env.SMPP_SOURCE_ADDR || process.env.SMS_SENDER_ID || "VoucherHunt";
}

// ---- HTTP ----

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

const server = http
  .createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      return sendJson(response, 200, { ok: true, bound: Boolean(session) });
    }
    if (request.method !== "POST" || request.url !== "/messages") {
      return sendJson(response, 404, { error: "Not found" });
    }
    if (request.headers.authorization !== `Bearer ${apiToken}`) {
      return sendJson(response, 401, { error: "Unauthorized" });
    }

    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000) request.destroy();
    });
    request.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        if (typeof payload.to !== "string" || typeof payload.message !== "string" || !payload.to || !payload.message) {
          return sendJson(response, 400, { success: false, error: "A recipient and message are required." });
        }
        const providerMessageId = await submitMessage(payload.to, payload.message);
        return sendJson(response, 200, { success: true, provider_message_id: providerMessageId });
      } catch (error) {
        console.error("[SMPP worker] send failed", error);
        return sendJson(response, 502, {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  });

// Only serve when run as a process. Requiring this file (the parity test does)
// must not bind a port or hold the event loop open.
if (require.main === module) {
  server.listen(port, "0.0.0.0", () => console.log(`[SMPP worker] listening on port ${port}`));
}

// Segmentation is hand-ported from src/server/sms.ts because this file is plain
// CJS run outside Next. Exported so tests/unit/smpp-worker-parity.test.ts can
// pin the two implementations together.
module.exports = { __test: { buildMessageParts, fitsSingleSmsPart, selectSourceAddress } };
