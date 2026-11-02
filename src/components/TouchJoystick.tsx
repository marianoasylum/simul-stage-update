/**
 * Floating Dynamic Virtual Touch Controller
 * Appears ONLY when the user's finger touches the screen, and disappears immediately upon release.
 * - Left side of the screen: Floating movement thumbstick with directional feedback.
 * - Right side of the screen: Smooth first-person drag-to-look camera rotation.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  onMove: (forward: number, right: number) => void;
  onLook: (deltaX: number, deltaY: number) => void;
  disabled?: boolean;
}

export const TouchJoystick: React.FC<Props> = ({ onMove, onLook, disabled }) => {
  // Movement stick state (dynamic floating origin)
  const [stickActive, setStickActive] = useState(false);
  const [stickOrigin, setStickOrigin] = useState<{ x: number; y: number } | null>(null);
  const [stickCurrent, setStickCurrent] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const movePointerIdRef = useRef<number | null>(null);
  const lookPointerIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const maxRadius = 45; // Max joystick radius in px

  // Focus iframe window on interaction
  const ensureFocus = () => {
    if (typeof window !== 'undefined' && window.focus) {
      window.focus();
    }
  };

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      ensureFocus();

      // Don't intercept clicks on interactive buttons, modals or inputs
      const target = e.target as HTMLElement | null;
      if (target && target.closest('button, input, select, textarea, a, [role="button"]')) {
        return;
      }

      const clientX = e.clientX;
      const clientY = e.clientY;
      const screenWidth = window.innerWidth;

      // Left 55% of the screen is the Movement Stick zone
      if (clientX < screenWidth * 0.55 && movePointerIdRef.current === null) {
        movePointerIdRef.current = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setStickOrigin({ x: clientX, y: clientY });
        setStickCurrent({ x: 0, y: 0 });
        setStickActive(true);
      }
      // Right 45% (or secondary touch) is the Look zone
      else if (lookPointerIdRef.current === null) {
        lookPointerIdRef.current = e.pointerId;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        lastLookPosRef.current = { x: clientX, y: clientY };
      }
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;

      // Handle Move stick
      if (e.pointerId === movePointerIdRef.current && stickOrigin) {
        const dx = e.clientX - stickOrigin.x;
        const dy = e.clientY - stickOrigin.y;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxRadius);
        const angle = Math.atan2(dy, dx);

        const clampedX = Math.cos(angle) * clampedDist;
        const clampedY = Math.sin(angle) * clampedDist;

        setStickCurrent({ x: clampedX, y: clampedY });

        // Forward: -clampedY / maxRadius, Right: clampedX / maxRadius
        const normForward = -(clampedY / maxRadius);
        const normRight = clampedX / maxRadius;
        onMove(normForward, normRight);
      }

      // Handle Look rotation
      if (e.pointerId === lookPointerIdRef.current) {
        const dx = (e.clientX - lastLookPosRef.current.x) * 0.0035;
        const dy = (e.clientY - lastLookPosRef.current.y) * 0.0035;
        lastLookPosRef.current = { x: e.clientX, y: e.clientY };
        onLook(dx, dy);
      }
    },
    [disabled, stickOrigin, onMove, onLook, maxRadius]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerId === movePointerIdRef.current) {
        movePointerIdRef.current = null;
        setStickActive(false);
        setStickOrigin(null);
        setStickCurrent({ x: 0, y: 0 });
        onMove(0, 0);
      }
      if (e.pointerId === lookPointerIdRef.current) {
        lookPointerIdRef.current = null;
      }
    },
    [onMove]
  );

  // Clear when disabled
  useEffect(() => {
    if (disabled) {
      movePointerIdRef.current = null;
      lookPointerIdRef.current = null;
      setStickActive(false);
      setStickOrigin(null);
      setStickCurrent({ x: 0, y: 0 });
      onMove(0, 0);
    }
  }, [disabled, onMove]);

  return (
    <>
      {/* Full-screen invisible touch listener */}
      <div
        className="fixed inset-0 z-20 touch-none select-none pointer-events-auto"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* Dynamic Floating Touch Joystick: appears ONLY when finger is in contact */}
      {stickActive && stickOrigin && !disabled && (
        <div
          className="pointer-events-none fixed z-30 transform -translate-x-1/2 -translate-y-1/2 transition-opacity duration-75"
          style={{
            left: `${stickOrigin.x}px`,
            top: `${stickOrigin.y}px`,
          }}
        >
          {/* Outer Ring */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-cyan-400/60 bg-slate-950/40 backdrop-blur-md shadow-[0_0_24px_rgba(6,182,212,0.4)] flex items-center justify-center">
            {/* Cardinal ticks */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400/80" />

            {/* Inner Mobile Thumb Knob */}
            <div
              className="absolute w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-cyan-600 via-cyan-400 to-sky-300 border-2 border-white/70 shadow-lg shadow-cyan-500/50 flex items-center justify-center transition-transform duration-75"
              style={{
                transform: `translate(${stickCurrent.x}px, ${stickCurrent.y}px)`,
              }}
            >
              <div className="w-3 h-3 rounded-full bg-slate-950/40" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
