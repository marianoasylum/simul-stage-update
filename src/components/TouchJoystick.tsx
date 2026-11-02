/**
 * Virtual Touch / Mouse Joystick & Look Controller
 * Provides:
 * 1. Dedicated on-screen Virtual Joystick & D-Pad on bottom-left for effortless mobile/desktop movement.
 * 2. Full-screen drag-to-look for mouse and touch.
 * 3. Immediate window focus handling for iframe keyboards (WASD, Arrows).
 */
import React, { useRef, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Move } from 'lucide-react';

interface Props {
  onMove: (forward: number, right: number) => void;
  onLook: (deltaX: number, deltaY: number) => void;
  disabled?: boolean;
}

export const TouchJoystick: React.FC<Props> = ({ onMove, onLook, disabled }) => {
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const [isDraggingStick, setIsDraggingStick] = useState(false);
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);

  // Look drag refs
  const isLookingRef = useRef(false);
  const lookPointerIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef({ x: 0, y: 0 });

  const maxRadius = 38; // Joystick max travel distance in pixels

  // Helper to ensure window in iframe has focus
  const ensureFocus = () => {
    if (typeof window !== 'undefined' && window.focus) {
      window.focus();
    }
  };

  // --- 1. Virtual Joystick Thumbstick Drag Handling ---
  const handleStickPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    ensureFocus();
    e.stopPropagation();
    activePointerIdRef.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingStick(true);
    updateStickPos(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingStick || e.pointerId !== activePointerIdRef.current || disabled) return;
    updateStickPos(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId === activePointerIdRef.current) {
      activePointerIdRef.current = null;
      setIsDraggingStick(false);
      setStickOffset({ x: 0, y: 0 });
      onMove(0, 0);
    }
  };

  const updateStickPos = (clientX: number, clientY: number) => {
    if (!joystickBaseRef.current) return;
    const rect = joystickBaseRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);

    const stickX = Math.cos(angle) * clampedDist;
    const stickY = Math.sin(angle) * clampedDist;

    setStickOffset({ x: stickX, y: stickY });

    // Normalized move: -stickY / maxRadius for forward, stickX / maxRadius for right
    const normForward = -(stickY / maxRadius);
    const normRight = stickX / maxRadius;
    onMove(normForward, normRight);
  };

  // --- 2. Quick Directional Tap / Hold Buttons ---
  const handleDirectionPress = (forward: number, right: number) => {
    if (disabled) return;
    ensureFocus();
    onMove(forward, right);
  };

  const handleDirectionRelease = () => {
    onMove(0, 0);
  };

  // --- 3. Screen Drag-to-Look (Mouse & Touch on viewport background) ---
  const handleLookPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    ensureFocus();
    // Do not trigger look if clicking interactive UI elements or buttons
    const target = e.target as HTMLElement | null;
    if (target && target.closest('button, input, select, textarea, a, [role="button"], .interactive-control')) {
      return;
    }
    isLookingRef.current = true;
    lookPointerIdRef.current = e.pointerId;
    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookPointerMove = (e: React.PointerEvent) => {
    if (!isLookingRef.current || e.pointerId !== lookPointerIdRef.current) return;
    const dx = (e.clientX - lastLookPosRef.current.x) * 0.0035;
    const dy = (e.clientY - lastLookPosRef.current.y) * 0.0035;
    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
    onLook(dx, dy);
  };

  const handleLookPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId === lookPointerIdRef.current) {
      isLookingRef.current = false;
      lookPointerIdRef.current = null;
    }
  };

  // Reset when disabled
  useEffect(() => {
    if (disabled) {
      setStickOffset({ x: 0, y: 0 });
      setIsDraggingStick(false);
      onMove(0, 0);
    }
  }, [disabled, onMove]);

  return (
    <>
      {/* Background Free Look Surface for Mouse and Touch drag */}
      <div
        className="absolute inset-0 z-20 touch-none select-none"
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerUp}
      />

      {/* On-Screen Virtual Joystick Controller (Bottom-Left) */}
      {!disabled && (
        <div className="fixed bottom-24 left-4 sm:left-6 z-40 select-none touch-none interactive-control pointer-events-auto">
          <div
            ref={joystickBaseRef}
            className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-950/75 border-2 border-cyan-500/50 backdrop-blur-md shadow-2xl flex items-center justify-center p-2"
          >
            {/* Directional Pad Buttons (Top, Bottom, Left, Right) */}
            {/* Up / Forward */}
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); handleDirectionPress(1, 0); }}
              onPointerUp={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              onPointerLeave={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              className="absolute top-1 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 flex items-center justify-center border border-cyan-500/40 shadow transition-all cursor-pointer"
              title="Adelante (W / Flecha Arriba)"
            >
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>

            {/* Down / Backward */}
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); handleDirectionPress(-1, 0); }}
              onPointerUp={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              onPointerLeave={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 flex items-center justify-center border border-cyan-500/40 shadow transition-all cursor-pointer"
              title="Atrás (S / Flecha Abajo)"
            >
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>

            {/* Left / Move Left */}
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); handleDirectionPress(0, -1); }}
              onPointerUp={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              onPointerLeave={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 flex items-center justify-center border border-cyan-500/40 shadow transition-all cursor-pointer"
              title="Izquierda (A / Flecha Izquierda)"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>

            {/* Right / Move Right */}
            <button
              type="button"
              onPointerDown={(e) => { e.stopPropagation(); handleDirectionPress(0, 1); }}
              onPointerUp={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              onPointerLeave={(e) => { e.stopPropagation(); handleDirectionRelease(); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800/90 hover:bg-cyan-500/30 active:bg-cyan-500 text-cyan-300 flex items-center justify-center border border-cyan-500/40 shadow transition-all cursor-pointer"
              title="Derecha (D / Flecha Derecha)"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </button>

            {/* Center Dynamic Draggable Thumbstick Knob */}
            <div
              onPointerDown={handleStickPointerDown}
              onPointerMove={handleStickPointerMove}
              onPointerUp={handleStickPointerUp}
              onPointerCancel={handleStickPointerUp}
              style={{
                transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
              }}
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-tr from-cyan-400 via-cyan-500 to-blue-500 border-2 border-white shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform ${
                isDraggingStick ? 'duration-0 scale-105 shadow-cyan-400/60' : 'duration-150'
              }`}
            >
              <Move className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950 stroke-[2.5]" />
            </div>
          </div>
          <p className="text-[10px] font-bold text-center text-cyan-400/90 mt-1 uppercase tracking-wider drop-shadow">
            Moverse
          </p>
        </div>
      )}
    </>
  );
};
