"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCalendar,
  FiCamera,
  FiCheck,
  FiClock,
  FiGift,
  FiSearch,
  FiStopCircle,
  FiUpload,
  FiUser,
  FiXCircle,
} from "react-icons/fi";
import type { IScannerControls } from "@zxing/browser";
import { api } from "@/lib/api-client";
import type { Campaign, CampaignSlot, EndUser, Voucher } from "@/types/voucher";

type Validation = {
  voucher: Voucher;
  user?: EndUser;
  slot?: CampaignSlot;
  campaign?: Campaign;
  business?: { name: string };
};

const statusPresentation: Record<Voucher["status"], { label: string; tone: "success" | "warning" | "danger"; icon: typeof FiCheck }> = {
  Issued: { label: "Valid & Confirmed", tone: "success", icon: FiCheck },
  Delivered: { label: "Valid & Confirmed", tone: "success", icon: FiCheck },
  Redeemed: { label: "Already Used", tone: "warning", icon: FiAlertTriangle },
  Expired: { label: "Invalid / Expired", tone: "danger", icon: FiXCircle },
  Cancelled: { label: "Invalid / Expired", tone: "danger", icon: FiXCircle },
  NoShow: { label: "Invalid / Expired", tone: "danger", icon: FiXCircle },
};

export default function StaffPage() {
  const [code, setCode] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Validation | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<CampaignSlot[]>([]);
  const [newSlotId, setNewSlotId] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const [scanning, setScanning] = useState(false);
  // No camera (typical on desktop) → hide "Scan QR" entirely and let upload fill
  // the row, instead of offering a button that only ever errors.
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [validationToast, setValidationToast] = useState<{
    id: number;
    message: string;
    tone: "error" | "success";
  } | null>(null);
  const [validationToastExiting, setValidationToastExiting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function showAdminToast(
    message: string,
    tone: "error" | "success" = "error",
  ) {
    setValidationToastExiting(false);
    setValidationToast({ id: Date.now(), message, tone });
  }

  async function validate(codeOrToken = code) {
    try {
      setResult(await api<Validation>("/api/staff/vouchers/validate", { method: "POST", body: JSON.stringify({ codeOrToken }) }));
    } catch (error) {
      setResult(null);
      const nextMessage =
        error instanceof Error ? error.message : "Unable to validate voucher.";
      showAdminToast(nextMessage);
    }
  }

  useEffect(() => {
    if (!validationToast) return;
    const fadeTimeout = window.setTimeout(
      () => setValidationToastExiting(true),
      3400,
    );
    const dismissTimeout = window.setTimeout(() => {
      setValidationToast(null);
      setValidationToastExiting(false);
    }, 4000);
    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(dismissTimeout);
    };
  }, [validationToast]);

  // Detect a video input once on mount. enumerateDevices reports the device kind
  // even before camera permission is granted, so this works pre-permission.
  useEffect(() => {
    let active = true;
    const media = navigator.mediaDevices;
    if (!media?.enumerateDevices) {
      setCameraAvailable(false);
      return;
    }
    media
      .enumerateDevices()
      .then((devices) => {
        if (active) {
          setCameraAvailable(
            devices.some((device) => device.kind === "videoinput"),
          );
        }
      })
      .catch(() => {
        if (active) setCameraAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!scanning || !videoRef.current) return;

    let cancelled = false;
    async function startCamera() {
      setScanMessage("Point the camera at the voucher QR code.");
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled || !videoRef.current) return;

        const reader = new BrowserQRCodeReader();
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (scanResult, _error, activeControls) => {
            if (!scanResult) return;
            const value = scanResult.getText().trim();
            activeControls.stop();
            scannerControlsRef.current = null;
            setCode(value);
            setScanning(false);
            setScanMessage("QR scanned successfully.");
            void validate(value);
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        scannerControlsRef.current = controls;
      } catch (error) {
        setScanning(false);
        setScanMessage(
          error instanceof Error && error.name === "NotAllowedError"
            ? "Camera permission was denied. Allow camera access or upload a QR image instead."
            : "Unable to start the camera. Upload a QR image instead.",
        );
      }
    }

    void startCamera();
    return () => {
      cancelled = true;
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
    };
    // validate intentionally uses the latest scanned value passed as an argument.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setScanning(false);
    setScanMessage("");
  }

  async function decodeUpload(file?: File) {
    if (!file) return;
    setScanMessage("Reading QR image...");
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
      const value = result.getText().trim();
      setCode(value);
      setScanMessage("QR image read successfully.");
      await validate(value);
    } catch {
      setScanMessage("No readable QR code was found in that image.");
    } finally {
      URL.revokeObjectURL(url);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  async function redeem() {
    const nextPurchaseAmount = purchaseAmount.trim()
      ? Number(purchaseAmount)
      : undefined;
    if (
      nextPurchaseAmount !== undefined &&
      (!Number.isFinite(nextPurchaseAmount) || nextPurchaseAmount < 0)
    ) {
      showAdminToast("Enter a valid purchase amount.");
      return;
    }

    try {
      setResult(
        await api<Validation>("/api/staff/vouchers/redeem", {
          method: "POST",
          body: JSON.stringify({
            codeOrToken: code,
            purchaseAmount: nextPurchaseAmount,
            note: note.trim() || undefined,
          })
        })
      );
      showAdminToast("Voucher marked as used successfully.", "success");
    } catch (error) {
      showAdminToast(
        error instanceof Error ? error.message : "Unable to redeem voucher.",
      );
    }
  }

  async function markNoShowAction() {
    try {
      await api("/api/staff/vouchers/no-show", {
        method: "POST",
        body: JSON.stringify({ codeOrToken: code }),
      });
      showAdminToast("Reservation marked as no-show.", "success");
      await validate(code);
    } catch (error) {
      showAdminToast(error instanceof Error ? error.message : "Unable to mark no-show.");
    }
  }

  async function rescheduleAction() {
    if (!newSlotId) {
      showAdminToast("Choose a new slot first.");
      return;
    }
    try {
      await api("/api/staff/reservations/reschedule", {
        method: "POST",
        body: JSON.stringify({ codeOrToken: code, newSlotId }),
      });
      showAdminToast("Reservation rescheduled.", "success");
      setNewSlotId("");
      await validate(code);
    } catch (error) {
      showAdminToast(error instanceof Error ? error.message : "Unable to reschedule.");
    }
  }

  // Load alternate slots when the current voucher belongs to a reschedule-enabled campaign.
  useEffect(() => {
    const slug = result?.campaign?.slug;
    if (!slug || !result?.campaign?.allowReschedule) {
      setRescheduleSlots([]);
      return;
    }
    let active = true;
    api<Array<CampaignSlot & { remainingPoolQuantity: number }>>(`/api/public/campaigns/${slug}/slots`)
      .then((slots) => {
        if (active) {
          setRescheduleSlots(
            slots.filter((slot) => slot.status === "active" && slot.remainingCapacity > 0 && slot.id !== result.slot?.id),
          );
        }
      })
      .catch(() => {
        if (active) setRescheduleSlots([]);
      });
    return () => {
      active = false;
    };
  }, [result?.campaign?.slug, result?.campaign?.allowReschedule, result?.slot?.id]);

  const presentation = result ? statusPresentation[result.voucher.status] : undefined;
  const canRedeem = result?.voucher.status === "Issued" || result?.voucher.status === "Delivered";
  const isRestaurant = result?.campaign?.mode === "restaurant";
  const canManageReservation = canRedeem && isRestaurant;

  return (
    <>
      <header className="admin-topbar">
        <div>
          <h1>Reservation / Order Validation</h1>
          <p className="muted">Validate by voucher code or QR token, then mark it as used.</p>
        </div>
      </header>

      <div className="admin-grid">
        <section className="panel span-6 staff-validation-panel">
          <h2>Validate Voucher</h2>
          <label className="field">
            <span>Voucher Code or QR Token</span>
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="BF20-15MAY-12PM-X7A8" />
          </label>
          <div
            className={`qr-input-actions ${cameraAvailable ? "" : "single"}`}
          >
            {cameraAvailable ? (
              <button
                className="button secondary qr-action"
                onClick={() => setScanning(true)}
                type="button"
              >
                <FiCamera aria-hidden="true" />
                Scan QR
              </button>
            ) : null}
            <button
              className="button secondary qr-action"
              onClick={() => uploadRef.current?.click()}
              type="button"
            >
              <FiUpload aria-hidden="true" />
              Upload QR Image
            </button>
            <input
              ref={uploadRef}
              accept="image/*"
              className="visually-hidden"
              onChange={(event) => void decodeUpload(event.target.files?.[0])}
              type="file"
            />
          </div>
          {scanning ? (
            <div className="qr-scanner">
              <video ref={videoRef} muted playsInline />
              <span className="qr-scanner-frame" aria-hidden="true" />
              <button
                aria-label="Stop QR scanner"
                className="qr-scanner-stop"
                onClick={stopScanner}
                type="button"
              >
                <FiStopCircle aria-hidden="true" />
                Stop scanning
              </button>
            </div>
          ) : null}
          {scanMessage ? (
            <p className="qr-scan-message" role="status">
              {scanMessage}
            </p>
          ) : null}
          <label className="field">
            <span>Purchase Amount (optional)</span>
            <input value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} type="number" />
          </label>
          <label className="field">
            <span className="field-label-row">
              <span>Internal Note (optional)</span>
              <small>{note.length}/500</small>
            </span>
            <textarea
              className="staff-note"
              maxLength={500}
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button className="button full staff-panel-action" disabled={!code} onClick={() => void validate()}>Validate</button>
        </section>

        <section className="panel span-6 staff-result-panel">
          <h2 className="staff-result-heading">Validation Result</h2>
          {result && presentation ? (
            <>
              {presentation.tone === "success" ? (
                <div className="confirmation-check staff-confirmation-check">
                  <Image
                    alt="Valid and confirmed"
                    height={76}
                    priority
                    src="/assets/confirmation-check.png"
                    width={76}
                  />
                </div>
              ) : result.voucher.status === "Redeemed" ? (
                <div className="confirmation-check staff-confirmation-check used-voucher-check">
                  <Image
                    alt="Voucher already used"
                    height={76}
                    priority
                    src="/assets/already-used-voucher.png"
                    width={76}
                  />
                </div>
              ) : (
                <div className={`checkmark ${presentation.tone}`}>
                  <presentation.icon aria-hidden="true" />
                </div>
              )}
              <h3 className="staff-result-status">{presentation.label}</h3>
              <div className="summary-list staff-result-summary">
                <div className="summary-row">
                  <span className="icon-box">
                    <FiUser aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Customer</strong>
                    <p className="muted">{result.user?.name || "Unknown"} · {result.user?.phone ?? "-"}</p>
                  </div>
                </div>
                <div className="summary-row">
                  <span className="icon-box">
                    <FiGift aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Benefit</strong>
                    <p className="muted">{result.voucher.displayLabel}</p>
                  </div>
                </div>
                <div className="summary-row">
                  <span className="icon-box">
                    <FiClock aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Selected Slot</strong>
                    <p className="muted">{result.slot ? `${result.slot.date} ${result.slot.startTime}-${result.slot.endTime}` : "-"}</p>
                  </div>
                </div>
                <div className="summary-row">
                  <span className="icon-box">
                    <FiCalendar aria-hidden="true" />
                  </span>
                  <div>
                    <strong>Expires</strong>
                    <p className="muted">{new Date(result.voucher.expiresAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <button className="button full staff-panel-action" disabled={!canRedeem} onClick={redeem}>Mark as Used</button>
              {canManageReservation ? (
                <div className="staff-reservation-actions">
                  <button className="button secondary full" onClick={markNoShowAction} type="button">
                    <FiStopCircle aria-hidden="true" />
                    Mark No-show
                  </button>
                  {result?.campaign?.allowReschedule ? (
                    <div className="staff-reschedule-row">
                      <select
                        aria-label="Move reservation to another slot"
                        className="field-select"
                        value={newSlotId}
                        onChange={(event) => setNewSlotId(event.target.value)}
                      >
                        <option value="">Move to another slot…</option>
                        {rescheduleSlots.map((slot) => (
                          <option key={slot.id} value={slot.id}>
                            {slot.date} {slot.startTime}-{slot.endTime} ({slot.remainingCapacity} left)
                          </option>
                        ))}
                      </select>
                      <button className="button secondary" disabled={!newSlotId} onClick={rescheduleAction} type="button">
                        Reschedule
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="staff-result-empty">
              <div className="staff-result-empty-content">
                <span className="staff-result-empty-icon">
                  <FiSearch aria-hidden="true" />
                </span>
                <p>Enter a voucher code or scan a QR code to look up a reservation.</p>
              </div>
            </div>
          )}
        </section>
      </div>
      {validationToast ? (
        <div
          className={`snackbar admin-snackbar ${validationToast.tone === "success" ? "success" : ""} ${validationToastExiting ? "snackbar-exit" : ""}`}
          role={validationToast.tone === "error" ? "alert" : "status"}
          aria-live={validationToast.tone === "error" ? "assertive" : "polite"}
        >
          {validationToast.tone === "success" ? (
            <FiCheck aria-hidden="true" />
          ) : (
            <FiXCircle aria-hidden="true" />
          )}
          {validationToast.message}
        </div>
      ) : null}
    </>
  );
}
