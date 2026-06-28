import { useState, useEffect, useRef } from "react";
export default function OffRouteWarning({ graceSeconds = 420, show, onDismiss }) {
  const [remaining, setRemaining] = useState(graceSeconds);
  const [reported, setReported] = useState(false);
  const audioCtxRef = useRef(null);
  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => audioCtxRef.current?.close();
  }, []);
  useEffect(() => {
    if (!show) return;
    setRemaining(graceSeconds);
    setReported(false);
  }, [show, graceSeconds]);
  useEffect(() => {
    if (!show) return;
    if (remaining <= 0) {
      setReported(true);
      return;
    }
    const timer = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining, show]);
  useEffect(() => {
    if (!show) return;
    if (remaining <= 0 || remaining > graceSeconds - 1) return;
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = "sine";
    gain.gain.value = 0.15;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }, [remaining, graceSeconds, show]);
  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };
  const progress = Math.max(0, remaining / graceSeconds);
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="card p-6 mx-4 max-w-sm w-full shadow-modal text-center animate-slide-up">
        {reported ? (
          <>
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-lg font-bold text-warning mb-2">Reporte Generado</h2>
            <p className="text-sm text-gray-400 mb-4">
              Se ha enviado un reporte al administrador por permanecer fuera de ruta.
            </p>
            <button
              onClick={() => onDismiss?.()}
              className="btn-primary w-full"
            >
              Entendido
            </button>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4 animate-pulse">🚨</div>
            <h2 className="text-lg font-bold text-alert mb-2">¡FUERA DE RUTA!</h2>
            <p className="text-sm text-gray-400 mb-4">
              Usted está fuera de su ruta, por favor ingrese a su ruta
            </p>
            <div className="relative w-20 h-20 mx-auto mb-4">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="#1e293b" strokeWidth="5" />
                <circle
                  cx="36" cy="36" r="30"
                  fill="none"
                  stroke={progress > 0.5 ? "#22d3ee" : progress > 0.2 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="5"
                  strokeDasharray={`${2 * Math.PI * 30 * progress} ${2 * Math.PI * 30 * (1 - progress)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-xl font-bold text-white">{formatTime(remaining)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Tiempo antes de generar reporte automático
            </p>
            <button
              onClick={() => onDismiss?.()}
              className="btn-ghost w-full text-xs"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
