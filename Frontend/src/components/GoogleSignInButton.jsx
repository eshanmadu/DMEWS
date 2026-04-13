"use client";

import { useEffect, useId, useRef, useState } from "react";

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

function loadGoogleScript() {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-gsi="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")));
      return;
    }

    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.dataset.googleGsi = "1";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(s);
  });
}

export function GoogleSignInButton({
  onIdToken,
  disabled = false,
  text = "continue_with",
}) {
  const containerId = useId();
  const renderedRef = useRef(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      setError(null);
      if (!CLIENT_ID) {
        setError("Google sign-in is not configured.");
        return;
      }
      try {
        await loadGoogleScript();
        if (!mounted) return;
        if (!window.google?.accounts?.id) {
          setError("Google sign-in is not available.");
          return;
        }

        if (renderedRef.current) return;
        renderedRef.current = true;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (resp) => {
            const token = resp?.credential;
            if (token) onIdToken?.(token);
          },
        });

        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = "";
        window.google.accounts.id.renderButton(el, {
          theme: "outline",
          size: "large",
          width: "360",
          text,
        });
      } catch (e) {
        setError(e?.message || "Failed to initialize Google sign-in.");
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [containerId, onIdToken, text]);

  return (
    <div className={disabled ? "pointer-events-none opacity-60" : ""}>
      <div id={containerId} />
      {error && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </div>
      )}
    </div>
  );
}

