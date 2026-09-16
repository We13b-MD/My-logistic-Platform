import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useNavigationAudio
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides:
 * 1. Text-to-Speech audio directions using native window.speechSynthesis
 * 2. Mobile screen wake-lock using navigator.wakeLock to keep screen ON
 * 3. Mute/Unmute audio controls for the driver
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function useNavigationAudio(isNavigating: boolean) {
    const [isMuted, setIsMuted] = useState(false);
    const [isWakeLocked, setIsWakeLocked] = useState(false);
    const wakeLockRef = useRef<any>(null);
    const lastSpokenRef = useRef<string>("");

    // ───────────────────────────────────────────────────────────────────────────
    // 1. Screen Wake Lock (Keeps display ON while on active navigation)
    // ───────────────────────────────────────────────────────────────────────────
    const requestWakeLock = useCallback(async () => {
        if ("wakeLock" in navigator && isNavigating) {
            try {
                wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
                setIsWakeLocked(true);

                wakeLockRef.current.addEventListener("release", () => {
                    setIsWakeLocked(false);
                });
            } catch (err: any) {
                console.warn("Screen wake lock request failed:", err.message);
            }
        }
    }, [isNavigating]);

    const releaseWakeLock = useCallback(async () => {
        if (wakeLockRef.current) {
            try {
                await wakeLockRef.current.release();
                wakeLockRef.current = null;
                setIsWakeLocked(false);
            } catch (err: any) {
                console.warn("Screen wake lock release failed:", err.message);
            }
        }
    }, []);

    useEffect(() => {
        if (isNavigating) {
            requestWakeLock();

            // Re-acquire lock if user switches back to browser tab
            const handleVisibilityChange = () => {
                if (document.visibilityState === "visible" && isNavigating) {
                    requestWakeLock();
                }
            };

            document.addEventListener("visibilitychange", handleVisibilityChange);
            return () => {
                document.removeEventListener("visibilitychange", handleVisibilityChange);
                releaseWakeLock();
            };
        } else {
            releaseWakeLock();
        }
    }, [isNavigating, requestWakeLock, releaseWakeLock]);

    // ───────────────────────────────────────────────────────────────────────────
    // 2. Speech Synthesis (Spoken Turn Directions)
    // ───────────────────────────────────────────────────────────────────────────
    const speak = useCallback(
        (text: string, force: boolean = false) => {
            if (isMuted && !force) return;
            if (!("speechSynthesis" in window)) return;
            if (!text || text.trim() === "") return;

            // Prevent repetitive spam of the exact same instruction
            if (lastSpokenRef.current === text && !force) return;
            lastSpokenRef.current = text;

            // Cancel any ongoing phrase so directions stay real-time
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;  // Natural conversational speed
            utterance.pitch = 1.0;
            utterance.lang = "en-US";

            window.speechSynthesis.speak(utterance);
        },
        [isMuted]
    );

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            if (next && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
            }
            return next;
        });
    }, []);

    return {
        speak,
        isMuted,
        toggleMute,
        isWakeLocked,
    };
}
