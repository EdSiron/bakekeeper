"use client";
import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from "react";

const SOUND_OPTIONS = [
  { label: "🎀 Chime", value: "chime" },
  { label: "🍪 Ding", value: "ding" },
  { label: "🎂 Fanfare", value: "fanfare" },
  { label: "🔕 Silent", value: "silent" },
];

// ── Audio ─────────────────────────────────────────────────────────────────────
// Plays one cycle of the chosen sound, calls onEnd when it finishes.
// The caller loops by calling itself again inside onEnd.
function playSoundOnce(ctx: AudioContext, sound: string, onEnd: () => void) {
  if (sound === "silent") { setTimeout(onEnd, 2000); return; }
  const play = (freq: number, t: number, dur: number, gain = 0.4, type: OscillatorType = "sine") => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur);
  };
  const now = ctx.currentTime;
  let totalDur = 1.5;
  if (sound === "chime") {
    play(1047, now, 0.6); play(1319, now + 0.15, 0.6); play(1568, now + 0.3, 0.8); play(2093, now + 0.5, 1.0);
    totalDur = 1.8;
  } else if (sound === "ding") {
    play(880, now, 0.05, 0.5); play(880, now + 0.05, 0.8, 0.3); play(1100, now + 0.6, 0.6, 0.2);
    totalDur = 1.5;
  } else if (sound === "fanfare") {
    play(523, now, 0.2, 0.4); play(659, now + 0.15, 0.2, 0.4); play(784, now + 0.3, 0.2, 0.4);
    play(1047, now + 0.45, 0.5, 0.5); play(1319, now + 0.65, 0.8, 0.4);
    totalDur = 1.8;
  }
  setTimeout(onEnd, totalDur * 1000);
}

// ── Notifications ─────────────────────────────────────────────────────────────
function sendNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "bakekeeper-timer",   // replaces the previous one instead of stacking
      requireInteraction: true, // stays in notif bar until dismissed
    });
  } catch { /* silently ignore if blocked */ }
}

// ── Context type ──────────────────────────────────────────────────────────────
type TimerCtx = {
  inputMinutes: number;
  inputSeconds: number;
  setInputMinutes: (n: number) => void;
  setInputSeconds: (n: number) => void;
  timeLeft: number | null;
  running: boolean;
  done: boolean;
  sound: string;
  setSound: (s: string) => void;
  start: () => void;
  stop: () => void;
  reset: () => void;
  stopAlarm: () => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
  notifPermission: NotificationPermission | "unsupported";
  requestNotifPermission: () => void;
};

const TimerContext = createContext<TimerCtx | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function TimerProvider({ children }: { children: ReactNode }) {
  const [inputMinutes, setInputMinutes] = useState(10);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [sound, setSound] = useState("chime");
  const [visible, setVisible] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("unsupported");

  // endTimeRef: the absolute ms timestamp when the timer will hit zero.
  // This is the key fix — instead of counting ticks (which pauses when the
  // tab is backgrounded), we store when it should end and always compute
  // remaining = endTime - Date.now().
  const endTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Alarm loop refs
  const alarmLoopingRef = useRef(false);
  const alarmAudioCtxRef = useRef<AudioContext | null>(null);

  const totalSeconds = inputMinutes * 60 + inputSeconds;

  // ── Notification support ──────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifPermission("unsupported");
    } else {
      setNotifPermission(Notification.permission);
    }
  }, []);

  function requestNotifPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((p) => setNotifPermission(p));
  }

  // ── Alarm: looping sound ──────────────────────────────────────────────────
  const startAlarm = useCallback((soundType: string) => {
    alarmLoopingRef.current = true;
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    alarmAudioCtxRef.current = ctx;
    function loop() {
      if (!alarmLoopingRef.current) return;
      playSoundOnce(ctx, soundType, () => { if (alarmLoopingRef.current) loop(); });
    }
    loop();
  }, []);

  const stopAlarm = useCallback(() => {
    alarmLoopingRef.current = false;
    if (alarmAudioCtxRef.current) {
      try { alarmAudioCtxRef.current.close(); } catch { /* ignore */ }
      alarmAudioCtxRef.current = null;
    }
  }, []);

  // ── RAF tick — uses endTimeRef so it survives backgrounding ──────────────
  const tick = useCallback(() => {
    if (endTimeRef.current === null) return;
    const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
    setTimeLeft(remaining);
    if (remaining <= 0) {
      endTimeRef.current = null;
      setRunning(false);
      setDone(true);
      return; // don't schedule next frame
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (running) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [running, tick]);

  // When timer finishes → start looping alarm + send phone notification
  useEffect(() => {
    if (!done) return;
    startAlarm(sound);
    sendNotification("🎀 Bake Timer Done!", "Your timer has finished — check the oven! 🍞");
  }, [done, sound, startAlarm]);

  // Re-sync when tab becomes visible again (user switches back from another app)
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      if (!running || endTimeRef.current === null) return;
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        endTimeRef.current = null;
        setRunning(false);
        setDone(true);
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [running]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    // Snapshot remaining time so Resume works correctly
    if (endTimeRef.current !== null) {
      const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      endTimeRef.current = null;
    }
    setRunning(false);
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    endTimeRef.current = null;
    setRunning(false);
    setTimeLeft(null);
    setDone(false);
    stopAlarm();
  }, [stopAlarm]);

  const start = useCallback(() => {
    const secs = timeLeft !== null && timeLeft > 0 ? timeLeft : totalSeconds;
    if (secs <= 0) return;
    stopAlarm();
    setDone(false);
    setTimeLeft(secs);
    endTimeRef.current = Date.now() + secs * 1000;
    setRunning(true);
    // Nudge the user to allow notifications on first start
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().then((p) => setNotifPermission(p));
    }
  }, [timeLeft, totalSeconds, stopAlarm]);

  return (
    <TimerContext.Provider value={{
      inputMinutes, inputSeconds, setInputMinutes, setInputSeconds,
      timeLeft, running, done, sound, setSound,
      start, stop, reset, stopAlarm,
      visible, setVisible,
      notifPermission, requestNotifPermission,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}

// ── Floating Timer Widget ─────────────────────────────────────────────────────
export function FloatingTimer() {
  const {
    inputMinutes, inputSeconds, setInputMinutes, setInputSeconds,
    timeLeft, running, done, sound, setSound,
    start, stop, reset, stopAlarm,
    visible, setVisible,
    notifPermission, requestNotifPermission,
  } = useTimer();

  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 });
  const dragStart = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);

  // ── Mouse drag ────────────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    setDragging(true);
  }
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current) return;
      setPos({ x: dragStart.current.px - (e.clientX - dragStart.current.mx), y: dragStart.current.py - (e.clientY - dragStart.current.my) });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  // ── Touch drag (mobile) ───────────────────────────────────────────────────
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    dragStart.current = { mx: t.clientX, my: t.clientY, px: pos.x, py: pos.y };
    setDragging(true);
  }
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: TouchEvent) => {
      if (!dragStart.current) return;
      const t = e.touches[0];
      setPos({ x: dragStart.current.px - (t.clientX - dragStart.current.mx), y: dragStart.current.py - (t.clientY - dragStart.current.my) });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onUp); };
  }, [dragging]);

  if (!visible) return null;

  const display = timeLeft !== null ? timeLeft : inputMinutes * 60 + inputSeconds;
  const totalSecs = inputMinutes * 60 + inputSeconds;
  const mm = String(Math.floor(display / 60)).padStart(2, "0");
  const ss = String(display % 60).padStart(2, "0");
  const progress = timeLeft !== null && totalSecs > 0 ? timeLeft / totalSecs : 1;
  const R = 16;
  const circ = 2 * Math.PI * R;
  const dash = circ * progress;

  return (
    <div style={{ position: "fixed", right: `${pos.x}px`, bottom: `${pos.y}px`, zIndex: 9999, userSelect: "none" }}>
      <style>{`
        @keyframes timerPulse {
          from { box-shadow: 0 0 8px rgba(255,150,180,0.4); }
          to   { box-shadow: 0 0 22px rgba(255,150,180,0.85); }
        }
        @keyframes timerBounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        @keyframes alarmPop {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
      `}</style>

      {/* ── Collapsed pill ── */}
      {!expanded && (
        <button
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
          onClick={() => !dragging && setExpanded(true)}
          style={{
            display: "flex", alignItems: "center", gap: "7px",
            padding: "8px 14px 8px 10px", borderRadius: "999px",
            border: `2px solid ${done ? "#f5a8bc" : "rgba(245,168,188,0.5)"}`,
            background: done ? "#ffd1dc" : "rgba(255,246,231,0.95)",
            fontFamily: "'Mochibop', serif", color: "#7a4a33",
            fontSize: "13px", fontWeight: 700,
            cursor: dragging ? "grabbing" : "grab",
            boxShadow: done ? "0 4px 20px rgba(255,150,180,0.5)" : "0 4px 16px rgba(122,74,51,0.12)",
            animation: done ? "timerPulse 0.8s ease infinite alternate" : "none",
            backdropFilter: "blur(8px)",
            transition: "border-color 0.2s, background 0.2s",
          }}
        >
          <span style={{ fontSize: "16px", animation: done ? "timerBounce 0.6s ease infinite" : "none" }}>
            {done ? "🔔" : running ? "⏱️" : "⏳"}
          </span>
          <span style={{ letterSpacing: "1px" }}>
            {running || done || timeLeft !== null ? `${mm}:${ss}` : "Timer"}
          </span>
          {done && (
            <button
              onClick={(e) => { e.stopPropagation(); stopAlarm(); }}
              style={{
                marginLeft: "2px", padding: "2px 8px", borderRadius: "8px",
                background: "#fff", border: "1px solid #f5a8bc",
                fontFamily: "'Mochibop', serif", fontSize: "10px",
                color: "#7a4a33", cursor: "pointer", fontWeight: 700,
              }}
            >
              🔕 Stop
            </button>
          )}
        </button>
      )}

      {/* ── Expanded panel ── */}
      {expanded && (
        <div style={{
          background: "#fff6e7", border: "2px solid #ffd1dc",
          borderRadius: "24px", padding: "18px 18px 14px", width: "244px",
          boxShadow: "0 8px 32px rgba(122,74,51,0.18)",
          fontFamily: "'Mochibop', serif", color: "#7a4a33",
        }}>
          {/* Header / drag handle */}
          <div
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            style={{ cursor: dragging ? "grabbing" : "grab", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}
          >
            <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", opacity: 0.6 }}>
              🍰 Bake Timer
            </p>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => setExpanded(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#7a4a33", opacity: 0.5 }} title="Minimise">─</button>
              <button onClick={() => { setVisible(false); setExpanded(false); reset(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#7a4a33", opacity: 0.5 }} title="Close">✕</button>
            </div>
          </div>

          {/* Circle progress */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <div style={{ position: "relative", width: "88px", height: "88px" }}>
              <svg width="88" height="88" viewBox="0 0 40 40" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="20" cy="20" r={R} fill="none" stroke="#fde8ef" strokeWidth="3" />
                <circle
                  cx="20" cy="20" r={R} fill="none"
                  stroke={done ? "#f5a8bc" : "#ffd1dc"} strokeWidth="3"
                  strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 0.5s ease" }}
                />
              </svg>
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "17px", fontWeight: 700, letterSpacing: "1px",
                color: done ? "#e87ca0" : "#7a4a33",
              }}>
                {done ? "🎉" : `${mm}:${ss}`}
              </div>
            </div>

            {/* Done: show pulsing stop-alarm button */}
            {done && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: "#e87ca0" }}>Timer done! 🎀</p>
                <button
                  onClick={stopAlarm}
                  style={{
                    padding: "7px 20px", borderRadius: "14px",
                    background: "#ffd1dc", border: "2px solid #f5a8bc",
                    fontFamily: "'Mochibop', serif", color: "#7a4a33",
                    fontWeight: 700, fontSize: "12px", cursor: "pointer",
                    animation: "alarmPop 0.7s ease infinite",
                    boxShadow: "0 4px 14px rgba(255,150,180,0.45)",
                  }}
                >
                  🔕 Stop Alarm
                </button>
              </div>
            )}
          </div>

          {/* Time input — only when idle */}
          {!running && timeLeft === null && (
            <>
              {/* Quick presets */}
              <div style={{ display: "flex", gap: "5px", marginBottom: "8px", flexWrap: "wrap" }}>
                {[
                  { label: "10m", m: 10, s: 0 },
                  { label: "18m", m: 18, s: 0 },
                  { label: "15m", m: 15, s: 0 },
                  { label: "30m", m: 30, s: 0 },
                  { label: "45m", m: 45, s: 0 },
                  { label: "1h",  m: 60, s: 0 },
                ].map((p) => {
                  const active = inputMinutes === p.m && inputSeconds === p.s;
                  return (
                    <button
                      key={p.label}
                      onClick={() => { setInputMinutes(p.m); setInputSeconds(p.s); }}
                      style={{
                        padding: "4px 10px", borderRadius: "10px", border: "2px solid",
                        borderColor: active ? "#f5a8bc" : "#fde8ef",
                        background: active ? "#ffd1dc" : "#fff6e7",
                        fontFamily: "'Mochibop', serif", fontSize: "11px",
                        color: "#7a4a33", cursor: "pointer",
                        fontWeight: active ? 700 : 400,
                      }}
                    >
                      {p.label}{p.label === "10m" || p.label === "18m" ? " ⭐" : ""}
                    </button>
                  );
                })}
              </div>

              {/* Manual input */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <label style={{ fontSize: "9px", opacity: 0.5, textTransform: "uppercase", letterSpacing: "1px" }}>min</label>
                  <input type="number" min={0} max={99} value={inputMinutes}
                    onChange={(e) => setInputMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                    style={{ width: "50px", textAlign: "center", border: "2px solid #ffd1dc", borderRadius: "10px", padding: "4px 6px", fontFamily: "'Mochibop', serif", color: "#7a4a33", fontSize: "16px", fontWeight: 700, background: "#fff6e7", outline: "none" }} />
                </div>
                <span style={{ fontSize: "18px", fontWeight: 700, marginTop: "14px" }}>:</span>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <label style={{ fontSize: "9px", opacity: 0.5, textTransform: "uppercase", letterSpacing: "1px" }}>sec</label>
                  <input type="number" min={0} max={59} value={inputSeconds}
                    onChange={(e) => setInputSeconds(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    style={{ width: "50px", textAlign: "center", border: "2px solid #ffd1dc", borderRadius: "10px", padding: "4px 6px", fontFamily: "'Mochibop', serif", color: "#7a4a33", fontSize: "16px", fontWeight: 700, background: "#fff6e7", outline: "none" }} />
                </div>
              </div>
            </>
          )}

          {/* Sound selector */}
          <div style={{ marginBottom: "10px" }}>
            <button
              onClick={() => setShowSettings((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "10px", color: "#7a4a33", opacity: 0.6, fontFamily: "'Mochibop', serif", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
            >
              🎵 Sound: {SOUND_OPTIONS.find((s) => s.value === sound)?.label} {showSettings ? "▲" : "▼"}
            </button>
            {showSettings && (
              <div style={{ marginTop: "6px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
                {SOUND_OPTIONS.map((opt) => (
                  <button key={opt.value} onClick={() => { setSound(opt.value); setShowSettings(false); }}
                    style={{ padding: "3px 9px", borderRadius: "12px", border: "2px solid", borderColor: sound === opt.value ? "#f5a8bc" : "#fde8ef", background: sound === opt.value ? "#ffd1dc" : "#fff6e7", fontFamily: "'Mochibop', serif", fontSize: "11px", color: "#7a4a33", cursor: "pointer", fontWeight: sound === opt.value ? 700 : 400 }}>
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => {
                    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                    if (AudioCtx) { const ctx = new AudioCtx(); playSoundOnce(ctx, sound, () => {}); }
                  }}
                  style={{ padding: "3px 9px", borderRadius: "12px", border: "2px solid #fde8ef", background: "#fff6e7", fontFamily: "'Mochibop', serif", fontSize: "11px", color: "#7a4a33", cursor: "pointer" }}>
                  ▶ Test
                </button>
              </div>
            )}
          </div>

          {/* Notification permission row */}
          {notifPermission === "default" && (
            <button
              onClick={requestNotifPermission}
              style={{
                width: "100%", marginBottom: "10px", padding: "7px 10px",
                borderRadius: "12px", background: "#fff6e7", border: "2px solid #fde68a",
                fontFamily: "'Mochibop', serif", fontSize: "10px",
                color: "#92400e", cursor: "pointer", textAlign: "left",
              }}
            >
              🔔 Tap to allow phone notifications when done
            </button>
          )}
          {notifPermission === "granted" && (
            <p style={{ fontSize: "10px", color: "#16a34a", fontFamily: "'Mochibop', serif", marginBottom: "8px", opacity: 0.8 }}>
              ✅ Phone notifications enabled
            </p>
          )}
          {notifPermission === "denied" && (
            <p style={{ fontSize: "10px", color: "#dc2626", fontFamily: "'Mochibop', serif", marginBottom: "8px", opacity: 0.7 }}>
              🔕 Notifications blocked — enable in browser settings
            </p>
          )}

          {/* Controls */}
          <div style={{ display: "flex", gap: "6px" }}>
            {!running ? (
              <button
                onClick={start}
                disabled={inputMinutes * 60 + inputSeconds === 0 && timeLeft === null}
                style={{ flex: 1, padding: "8px", borderRadius: "12px", background: "#ffd1dc", border: "2px solid #f5a8bc", fontFamily: "'Mochibop', serif", color: "#7a4a33", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
              >
                ▶ {timeLeft !== null && timeLeft > 0 ? "Resume" : "Start"}
              </button>
            ) : (
              <button
                onClick={stop}
                style={{ flex: 1, padding: "8px", borderRadius: "12px", background: "#fde8ef", border: "2px solid #f5a8bc", fontFamily: "'Mochibop', serif", color: "#7a4a33", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
              >
                ⏸ Pause
              </button>
            )}
            <button
              onClick={reset}
              style={{ padding: "8px 12px", borderRadius: "12px", background: "#fff6e7", border: "2px solid #fde8ef", fontFamily: "'Mochibop', serif", color: "#7a4a33", fontSize: "13px", cursor: "pointer" }}
            >↺</button>
          </div>
        </div>
      )}
    </div>
  );
}