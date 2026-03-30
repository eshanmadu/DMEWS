"use client";

import { useState } from "react";
import Lock from "@/components/Lock";
import styles from "./MapLockFrame.module.css";

/**
 * Lock UI uses :checked (purple) as the "open" visual; unchecked (gray) reads as locked.
 * Map is frozen when the checkbox is unchecked — so mapFrozen === !checkboxChecked.
 */
export default function MapLockFrame({ children, className = "" }) {
  const [mapFrozen, setMapFrozen] = useState(true);

  return (
    <div className={`relative min-h-0 ${className}`}>
      <div
        className={styles.lockSlot}
        title={mapFrozen ? "Unlock map (pan & zoom)" : "Lock map (freeze)"}
      >
        <Lock
          size="sm"
          checked={!mapFrozen}
          onChange={(e) => setMapFrozen(!e.target.checked)}
          inputProps={{
            "aria-label": mapFrozen
              ? "Unlock map to allow pan and zoom"
              : "Lock map to freeze pan and zoom",
          }}
        />
      </div>
      <div
        className={
          mapFrozen
            ? "h-full min-h-0 pointer-events-none touch-none select-none [&_*]:pointer-events-none [&_*]:touch-none"
            : "h-full min-h-0"
        }
      >
        {children}
      </div>
    </div>
  );
}
