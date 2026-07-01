"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api-client";
import type { Campaign, CampaignSlot, EndUser, Voucher } from "@/types/voucher";

type Validation = {
  voucher: Voucher;
  user?: EndUser;
  slot?: CampaignSlot;
  campaign?: Campaign;
  business?: { name: string };
};

const nav = ["Dashboard", "Campaigns", "Slots", "Vouchers", "Attempts / Hunt Logs", "Referrals & Shares", "Reservations", "Analytics", "Users", "Settings", "Audit Logs"];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="logo-tile small">%</div>
        <div>
          <strong>BizFlow</strong>
          <div style={{ fontSize: ".72rem", opacity: 0.76 }}>Admin</div>
        </div>
      </div>
      {nav.map((item) => (
        <Link className={`nav-item ${item === "Reservations" ? "active" : ""}`} href={item === "Dashboard" ? "/dashboard" : "/staff"} key={item}>
          <span>▣</span>
          {item}
        </Link>
      ))}
    </aside>
  );
}

export default function StaffPage() {
  const [code, setCode] = useState("");
  const [staffName, setStaffName] = useState("Jane Admin");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Validation | null>(null);
  const [message, setMessage] = useState("");

  async function validate() {
    setMessage("");
    try {
      setResult(await api<Validation>("/api/staff/vouchers/validate", { method: "POST", body: JSON.stringify({ codeOrToken: code }) }));
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : "Unable to validate voucher.");
    }
  }

  async function redeem() {
    setMessage("");
    try {
      setResult(
        await api<Validation>("/api/staff/vouchers/redeem", {
          method: "POST",
          body: JSON.stringify({ codeOrToken: code, staffName, purchaseAmount: Number(purchaseAmount || 0), note })
        })
      );
      setMessage("Voucher marked as used.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to redeem voucher.");
    }
  }

  return (
    <main className="admin-shell">
      <Sidebar />
      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>Reservation / Order Validation</h1>
            <p className="muted">Validate by voucher code, QR token, or customer phone number.</p>
          </div>
          <div className="admin-rule-strip">
            <div className="rule-chip"><span className="icon-box">✓</span> Valid & Confirmed</div>
            <div className="rule-chip"><span className="icon-box">!</span> Already Used</div>
            <div className="rule-chip"><span className="icon-box">×</span> Invalid / Expired</div>
          </div>
        </header>

        <div className="admin-grid">
          <section className="panel span-4">
            <div className="tabs" style={{ marginBottom: 16 }}>
              <button className="tab active" type="button">Validate by Voucher Code</button>
              <button className="tab" type="button">Validate by QR Scan</button>
            </div>
            <label className="field">
              <span>Enter Voucher Code</span>
              <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="BF20-15MAY-12PM-X7A8" />
            </label>
            <label className="field">
              <span>User Phone Optional</span>
              <input placeholder="+1 555 123 4567" />
            </label>
            <label className="field">
              <span>Campaign</span>
              <select defaultValue="camp_july_dinner">
                <option value="camp_july_dinner">July Dinner Voucher Hunt</option>
                <option value="camp_8pm_drop">8PM Shopping Voucher Drop</option>
              </select>
            </label>
            <label className="field">
              <span>Staff Name</span>
              <input value={staffName} onChange={(event) => setStaffName(event.target.value)} />
            </label>
            <label className="field">
              <span>Purchase Amount</span>
              <input value={purchaseAmount} onChange={(event) => setPurchaseAmount(event.target.value)} type="number" />
            </label>
            <label className="field">
              <span>Internal Note</span>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <button className="button full" onClick={validate}>Validate</button>
            {message ? <p className="alert" style={{ marginTop: 12 }}>{message}</p> : null}
          </section>

          <section className="panel span-4">
            <h2>Reservation Details</h2>
            {result ? (
              <div className="summary-list">
                <div className="summary-row">
                  <span className="icon-box">U</span>
                  <div>
                    <strong>User Name</strong>
                    <p className="muted">{result.user?.name ?? "Unknown"}</p>
                  </div>
                </div>
                <div className="summary-row">
                  <span className="icon-box">#</span>
                  <div>
                    <strong>Booking ID</strong>
                    <p className="muted">{result.voucher.id}</p>
                  </div>
                </div>
                <div className="summary-row">
                  <span className="icon-box">C</span>
                  <div>
                    <strong>Voucher</strong>
                    <p className="muted">{result.voucher.displayLabel}</p>
                  </div>
                </div>
                <div className="summary-row">
                  <span className="icon-box">T</span>
                  <div>
                    <strong>Reservation Time</strong>
                    <p className="muted">{result.slot?.date} {result.slot?.startTime}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">Validated reservation details will appear here.</p>
            )}
          </section>

          <section className="panel span-4" style={{ textAlign: "center" }}>
            <h2>Validation Result</h2>
            {result ? (
              <>
                <div className={`checkmark ${result.voucher.status === "Redeemed" ? "" : ""}`}>✓</div>
                <h2>{result.voucher.status === "Redeemed" ? "Already Used" : "Valid & Confirmed"}</h2>
                <p className="muted">
                  Voucher is {result.voucher.status === "Redeemed" ? "already redeemed" : "valid and can be used"} for this reservation.
                </p>
                <div className="summary-list" style={{ textAlign: "left", margin: "18px 0" }}>
                  <div className="summary-row">
                    <span className="icon-box">V</span>
                    <div>
                      <strong>Voucher</strong>
                      <p className="muted">{result.voucher.displayLabel}</p>
                    </div>
                  </div>
                  <div className="summary-row">
                    <span className="icon-box">S</span>
                    <div>
                      <strong>Status</strong>
                      <p className="muted">{result.voucher.status}</p>
                    </div>
                  </div>
                </div>
                <button className="button full" disabled={result.voucher.status !== "Issued"} onClick={redeem}>
                  Mark as Used
                </button>
                <button className="button secondary full" style={{ marginTop: 10 }} type="button">
                  Cancel
                </button>
              </>
            ) : (
              <div className="info-card">
                <p className="muted">No voucher selected.</p>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
