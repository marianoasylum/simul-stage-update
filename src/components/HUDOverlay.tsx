/**
 * In-game HUD Overlay
 * Features top sensor status bar with live VU meter, countdown timer, speed alert,
 * interactive mobile touch virtual joystick, and collapsible bottom dock.
 */
import React, { useState } from 'react';
import {
  Compass,
  Mic,
  Camera,
  Flashlight,
  Timer,
  Play,
  RotateCcw,
  Volume2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Armchair,
  DoorOpen,
  Navigation,
  Footprints,
  LogOut,
} from 'lucide-react';
import { AppState, SimPhase } from '../types';

interface Props {
  appState: AppState;
  isNearSeat: boolean;
  onToggleFlashlight: () => void;
  onSitDown: () => void;
  onStandUp: () => void;
  onJump?: () => void;
  onToggleSprint: () => void;
  onToggleGpsWalk: () => void;
  onStartShowNow: () => void;
  onResetFromEntrance: () => void;
  onResetComplete: () => void;
}

export const HUDOverlay: React.FC<Props> = ({
  appState,
  isNearSeat,
  onToggleFlashlight,
  onSitDown,
  onStandUp,
  onJump,
  onToggleSprint,
  onToggleGpsWalk,
  onStartShowNow,
  onResetFromEntrance,
  onResetComplete,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // Format countdown mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isConcertPhase =
    appState.phase === 'CONCERT_PLAYING' ||
    appState.phase === 'CONCERT_BLACKOUT' ||
    appState.phase === 'CONCERT_FINALE';

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
      {/* 1. TOP BAR: SENSORS, TIMER, SPEED */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 w-full max-w-5xl mx-auto">
        {/* Left Sensor Indicators */}
        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto bg-slate-900/80 border border-slate-800 rounded-full px-3 py-1.5 text-xs backdrop-blur-md shadow-md text-white">
          {/* Gyroscope Indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              appState.sensors.gyroscopeAllowed
                ? 'bg-blue-500/20 text-blue-300'
                : 'bg-slate-800 text-slate-400'
            }`}
            title="Giroscopio: Control de cámara por orientación física"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Giro:</span>
            <span>{appState.sensors.gyroscopeAllowed ? 'Activo' : 'Manual'}</span>
          </div>

          {/* Microphone VU Meter */}
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800/80 text-[11px] font-semibold text-emerald-400"
            title="Micrófono / Audio VU Meter"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <div className="w-12 sm:w-16 h-2 bg-slate-950 rounded-full overflow-hidden flex items-center">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500 transition-all duration-75"
                style={{ width: `${Math.min(100, Math.round(appState.audioMetrics.volume * 100))}%` }}
              />
            </div>
            <span className="font-mono text-[10px]">
              {Math.round(appState.audioMetrics.volume * 100)}%
            </span>
          </div>

          {/* Camera Feed Indicator */}
          {/* Camera Feed Indicator */}
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
              appState.sensors.cameraActive
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-slate-800 text-slate-400'
            }`}
            title="Cámara WebRTC: Transmisión a pantalla gigante"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cámara:</span>
            <span>{appState.sensors.cameraActive ? 'Transmisión' : 'Off'}</span>
          </div>

          {/* GPS Walking Mode Indicator / Toggle */}
          <button
            type="button"
            onClick={onToggleGpsWalk}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer transition-all ${
              appState.gpsWalkEnabled
                ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Caminata GPS Real: Camina en el mundo real para moverte en 3D (Opcional)"
          >
            <Navigation className={`w-3.5 h-3.5 ${appState.gpsWalkEnabled ? 'text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">GPS:</span>
            <span>{appState.gpsWalkEnabled ? `${appState.gpsDistanceWalked}m` : 'Off'}</span>
          </button>
        </div>

        {/* Center/Right: Countdown Timer & Speed */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Pre-event 3-minute Countdown */}
          {!isConcertPhase && appState.phase !== 'EXITING_VENUE' && appState.phase !== 'COMPLETED' && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold backdrop-blur-md shadow-md">
              <Timer className="w-3.5 h-3.5 animate-spin-slow" />
              <span>Inicio:</span>
              <span className="text-white text-sm">{formatTime(appState.timeRemainingSeconds)}</span>
            </div>
          )}

          {/* Speed Indicator & Zone Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md shadow-md ${
              appState.isInsideVenue
                ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-300'
            }`}
          >
            <span>{appState.isInsideVenue ? 'Movistar Arena (Aforo 15.000)' : 'Calle Humboldt 450'}</span>
            <span className="text-slate-500">|</span>
            <span className="font-mono text-white text-[11px]">
              {appState.speed.toFixed(1)} m/s
            </span>
            {appState.isInsideVenue && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">
                Interior
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. COMPACT SIDE NOTIFICATIONS (A UN COSTADO, TAMAÑO COMPACTO) */}
      <div className="fixed top-14 sm:top-16 right-2.5 sm:right-5 w-60 sm:w-72 flex flex-col items-end gap-1.5 z-40 pointer-events-auto">
        {/* Near Seat Prompt - Ultra Compact on the side */}
        {isNearSeat && !appState.isSeated && (
          <div className="w-full p-2 sm:p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-400/80 shadow-lg text-white backdrop-blur-md flex items-center justify-between gap-2 transition-all">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-300 shrink-0">
                <Armchair className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-white truncate">¡Llegaste a tu Asiento!</h4>
                <p className="text-[9px] text-cyan-200/90 truncate font-mono">
                  {appState.ticket.sectionCode} • Fila {appState.ticket.row} • A {appState.ticket.seat}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSitDown}
              className="py-1 px-2.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-[11px] shadow shrink-0 cursor-pointer transition-all"
            >
              Sentarse
            </button>
          </div>
        )}

        {/* Blackout Flashlight Prompt - Ultra Compact on the side */}
        {appState.phase === 'CONCERT_BLACKOUT' && !appState.flashlightOn && (!appState.blackoutRemainingSeconds || appState.blackoutRemainingSeconds > 5) && (
          <div className="w-full p-2 sm:p-2.5 rounded-xl bg-amber-950/90 border border-amber-400/80 text-amber-200 shadow-lg backdrop-blur-md flex items-center justify-between gap-2 animate-pulse">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1 rounded-md bg-amber-500/20 text-amber-400 shrink-0">
                <Flashlight className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-white">Luces apagadas</h4>
                <p className="text-[9px] text-amber-200/90 truncate">Enciende tu linterna</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleFlashlight}
              className="py-1 px-2.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] shadow shrink-0 cursor-pointer transition-all"
            >
              Encender
            </button>
          </div>
        )}

        {/* 5-Second Warning Before Blackout Ends - Ultra Compact on the side */}
        {appState.phase === 'CONCERT_BLACKOUT' && appState.blackoutRemainingSeconds !== null && appState.blackoutRemainingSeconds <= 5 && (
          <div className="w-full p-2 sm:p-2.5 rounded-xl bg-amber-950/95 border-2 border-amber-400 text-amber-100 shadow-xl backdrop-blur-md flex items-center justify-between gap-1.5 animate-pulse">
            <div className="flex items-center gap-1.5 min-w-0">
              <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-amber-200">¡Luces en {appState.blackoutRemainingSeconds}s!</h4>
                <p className="text-[9px] text-amber-300/90 truncate">Apaga tu linterna</p>
              </div>
            </div>
            {appState.flashlightOn && (
              <button
                type="button"
                onClick={onToggleFlashlight}
                className="py-1 px-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10px] shadow shrink-0 cursor-pointer"
              >
                Apagar
              </button>
            )}
          </div>
        )}

        {/* 5-Second Warning: Flashlight On While Lights On - Ultra Compact on the side */}
        {appState.flashlightWarningSeconds !== null && (
          <div className="w-full p-2 sm:p-2.5 rounded-xl bg-rose-950/95 border-2 border-rose-500 text-rose-100 shadow-xl backdrop-blur-md flex items-center justify-between gap-1.5 animate-pulse">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-bounce" />
              <div className="min-w-0">
                <h4 className="font-extrabold text-[10px] sm:text-[11px] text-rose-200 uppercase">¡Apaga Linterna! ({appState.flashlightWarningSeconds}s)</h4>
                <p className="text-[9px] text-rose-300/90 truncate">Expulsión inminente</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleFlashlight}
              className="py-1 px-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-[10px] shadow shrink-0 cursor-pointer"
            >
              Apagar
            </button>
          </div>
        )}

        {/* Audience Leaving / Exit Guidance - Ultra Compact on the side */}
        {appState.phase === 'EXITING_VENUE' && (
          <div className="w-full p-2 sm:p-2.5 rounded-xl bg-emerald-950/90 border border-emerald-400/80 text-emerald-200 shadow-lg backdrop-blur-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-300 shrink-0">
                <DoorOpen className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-white">Evento Finalizado</h4>
                <p className="text-[9px] text-emerald-200/90 truncate">Salida por puertas verdes</p>
              </div>
            </div>
            {appState.isSeated && (
              <button
                type="button"
                onClick={onStandUp}
                className="py-1 px-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-[11px] shadow shrink-0 cursor-pointer"
              >
                Levantarse
              </button>
            )}
          </div>
        )}

        {/* GPS Active Mini-Banner */}
        {appState.gpsWalkEnabled && (
          <div className="px-2 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/40 text-[9px] font-mono text-emerald-300 flex items-center gap-1.5 backdrop-blur shadow">
            <Navigation className="w-3 h-3 text-emerald-400 animate-spin-slow" />
            <span>GPS: {appState.gpsDistanceWalked}m</span>
            {appState.gpsAccuracy && <span className="text-slate-400">(±{appState.gpsAccuracy}m)</span>}
          </div>
        )}
      </div>

      {/* 3. CENTER MODALS (ÚNICAMENTE EN CASOS CRÍTICOS / EXPULSIÓN) */}
      <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center gap-3 my-auto pointer-events-auto">
        {/* Flashlight Expulsion Modal */}
        {appState.phase === 'FLASHLIGHT_EXPELLED' && (
          <div className="p-6 rounded-2xl bg-red-950/95 border-2 border-red-500 shadow-2xl text-center text-white backdrop-blur-xl">
            <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <LogOut className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-red-200">¡Has Sido Expulsado del Recinto!</h3>
            <p className="text-xs sm:text-sm text-red-100/90 mt-2">
              Seguridad del evento te ha retirado por encender la linterna con las luces del show encendidas, deslumbrando a los artistas y asistentes.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={onResetFromEntrance}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-md cursor-pointer transition-all"
              >
                Reintentar desde el Acceso (Sin Linterna)
              </button>
              <button
                type="button"
                onClick={onResetComplete}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Reiniciar desde el Auto
              </button>
            </div>
          </div>
        )}

        {/* Speed Limit Fail Warning Modal */}
        {appState.phase === 'SPEED_LIMIT_FAIL' && (
          <div className="p-6 rounded-2xl bg-rose-950/95 border-2 border-rose-500 shadow-2xl text-center text-white backdrop-blur-xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-extrabold text-rose-200">¡Simulación Finalizada!</h3>
            <p className="text-xs sm:text-sm text-rose-100/90 mt-2">
              Exceso de velocidad dentro del recinto techado. En los eventos está estrictamente prohibido correr por razones de seguridad.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={onResetFromEntrance}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-md cursor-pointer transition-all"
              >
                Reintentar Caminando (Desde la Entrada)
              </button>
              <button
                type="button"
                onClick={onResetComplete}
                className="w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Reiniciar desde el Auto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. COLLAPSIBLE BOTTOM ERGONOMIC DOCK (Zero Viewport Occlusion) */}
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center pointer-events-auto">
        {/* Toggle Collapse Pill */}
        <button
          type="button"
          onClick={() => setDockCollapsed(!dockCollapsed)}
          className="mb-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700 text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 backdrop-blur-md shadow cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{dockCollapsed ? 'Mostrar Controles' : 'Ocultar Controles'}</span>
        </button>

        {/* Dock Bar */}
        {!dockCollapsed && (
          <div className="w-full p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-2 text-white">
            {/* Left buttons: Movement & Seating */}
            <div className="flex items-center gap-2">
              {/* Sprint / Walk toggle */}
              <button
                type="button"
                onClick={onToggleSprint}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  appState.sprintEnabled
                    ? appState.isInsideVenue
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={
                  appState.isInsideVenue
                    ? '¡Cuidado! Prohibido correr en el recinto'
                    : 'Alternar Caminar / Correr'
                }
              >
                <Footprints className="w-4 h-4" />
                <span>{appState.sprintEnabled ? 'Corriendo' : 'Caminando'}</span>
              </button>

              {/* Sit / Stand button */}
              {appState.isSeated ? (
                <button
                  type="button"
                  onClick={onStandUp}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Armchair className="w-4 h-4 text-cyan-400" />
                  <span>Levantarse</span>
                </button>
              ) : isNearSeat ? (
                <button
                  type="button"
                  onClick={onSitDown}
                  className="px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Armchair className="w-4 h-4" />
                  <span>Sentarse</span>
                </button>
              ) : null}
            </div>

            {/* Center: Flashlight and GPS controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleFlashlight}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                  appState.flashlightOn
                    ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/30'
                    : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300'
                }`}
              >
                <Flashlight className="w-4 h-4" />
                <span>{appState.flashlightOn ? 'Linterna ON' : 'Linterna OFF'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleGpsWalk}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  appState.gpsWalkEnabled
                    ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20'
                    : 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300'
                }`}
                title="Modo Caminata GPS Real: camina en el mundo real para moverte en 3D (Opcional)"
              >
                <Navigation className={`w-3.5 h-3.5 ${appState.gpsWalkEnabled ? 'text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">{appState.gpsWalkEnabled ? 'GPS Activo' : 'Caminata GPS'}</span>
                <span className="sm:hidden">GPS</span>
              </button>
            </div>

            {/* Right: Show controls */}
            <div className="flex items-center gap-2">
              {!isConcertPhase && appState.phase !== 'EXITING_VENUE' && (
                <button
                  type="button"
                  onClick={onStartShowNow}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Iniciar Concierto Ahora</span>
                </button>
              )}

              <button
                type="button"
                onClick={onResetComplete}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                title="Reiniciar Simulación"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
