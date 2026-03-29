"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Siren, X, Loader2, LogIn } from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function HomeSosButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("dmews_token")
      : null;

  const close = useCallback(() => {
    setOpen(false);
    setFeedback(null);
    setMessage("");
  }, []);

  async function sendSos() {
    if (!token) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/sos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          sentFrom: "home",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: data?.message || t("sos.sendFailed"),
        });
      } else {
        setFeedback({ type: "ok", text: data?.message || t("sos.sent") });
        setMessage("");
        setTimeout(() => close(), 2200);
      }
    } catch {
      setFeedback({ type: "error", text: t("sos.networkError") });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {/* Fixed SOS — home page only (component mounted from page.jsx) */}
      <div className="pointer-events-none fixed bottom-6 right-4 z-[1050] sm:bottom-8 sm:right-6">
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setFeedback(null);
            }}
            className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-rose-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-red-900/40 ring-2 ring-white/90 transition hover:scale-[1.03] hover:from-red-500 hover:to-rose-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300"
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
              <Siren
                className="h-5 w-5 animate-pulse text-white"
                aria-hidden
              />
            </span>
            <span className="pr-1">{t("sos.button")}</span>
          </button>
          <p className="max-w-[11rem] text-right text-[10px] font-medium leading-tight text-slate-600 drop-shadow-sm">
            {t("sos.hint")}
          </p>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[5000] flex items-end justify-center p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-dialog-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            aria-label={t("sos.close")}
            onClick={close}
          />
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-200/80 bg-white shadow-2xl shadow-red-900/20">
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-red-600 to-rose-600 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20">
                  <Siren className="h-6 w-6" />
                </span>
                <div>
                  <h2 id="sos-dialog-title" className="font-oswald text-lg font-semibold">
                    {t("sos.dialogTitle")}
                  </h2>
                  <p className="text-xs text-red-100">{t("sos.dialogSubtitle")}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-white/90 transition hover:bg-white/15"
                aria-label={t("sos.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              {!token ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
                  <p className="font-medium">{t("sos.needLogin")}</p>
                  <p className="mt-2 text-xs text-amber-900/90">
                    {t("sos.needLoginDetail")}
                  </p>
                  <Link
                    href="/login?redirect=/"
                    onClick={close}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-600"
                  >
                    <LogIn className="h-4 w-4" />
                    {t("sos.goLogin")}
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600">{t("sos.confirmText")}</p>
                  <div>
                    <label
                      htmlFor="sos-message"
                      className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {t("sos.optionalMessage")}
                    </label>
                    <textarea
                      id="sos-message"
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={1000}
                      placeholder={t("sos.messagePlaceholder")}
                      className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-sky-400/0 transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-300/60"
                    />
                  </div>
                  {feedback && (
                    <div
                      className={`rounded-xl px-3 py-2 text-sm ${
                        feedback.type === "ok"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                          : "border border-red-200 bg-red-50 text-red-800"
                      }`}
                    >
                      {feedback.text}
                    </div>
                  )}
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {t("sos.cancel")}
                    </button>
                    <button
                      type="button"
                      disabled={sending}
                      onClick={sendSos}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-red-700 disabled:opacity-60"
                    >
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Siren className="h-4 w-4" />
                      )}
                      {sending ? t("sos.sending") : t("sos.sendNow")}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
