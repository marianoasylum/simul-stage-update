/**
 * In-game HUD Overlay
 * Clean status bar, countdown timer, speed alert, seat guidance,
 * optional GIF/media screen upload for the main LED screen, and collapsible bottom dock.
 */
import React, { useState, useRef } from 'react';
import {
  Flashlight,
  Timer,
  Play,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Armchair,
  DoorOpen,
  Navigation,
  Footprints,
  LogOut,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  X,
  Sparkles,
  CalendarX,
  Sliders,
  Tv,
  Sun,
} from 'lucide-react';
import { AppState } from '../types';

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
  onAttachMedia?: (file: File) => void;
  onToggleCustomMediaNow?: () => void;
  onClearCustomMedia?: () => void;
  onToggleStageLights: () => void;
  onToggleStageScreens: () => void;
  onToggleGifScreen: () => void;
}

export const HUDOverlay: React.FC<Props> = ({
  appState,
  isNearSeat,
  onToggleFlashlight,
  onSitDown,
  onStandUp,
  onToggleSprint,
  onToggleGpsWalk,
  onStartShowNow,
  onResetFromEntrance,
  onResetComplete,
  onAttachMedia,
  onToggleCustomMediaNow,
  onClearCustomMedia,
  onToggleStageLights,
  onToggleStageScreens,
  onToggleGifScreen,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttachMedia) {
      onAttachMedia(file);
    }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-3 sm:p-5 select-none font-sans">
      {/* Hidden File Input for uploading custom GIF to the stadium screen */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/gif,image/*,video/*"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* 1. TOP BAR: VENUE BADGE, TIMER, SPEED, AND SCREEN GIF STATUS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 w-full max-w-5xl mx-auto">
        {/* Left: Location & Ticket Info */}
        <div className="flex items-center gap-2 pointer-events-auto bg-slate-900/85 border border-slate-700/80 rounded-full px-3.5 py-1.5 text-xs backdrop-blur-md shadow-lg text-white">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-semibold text-slate-200">
              {appState.isInsideVenue ? 'Movistar Arena' : 'Calle Humboldt'}
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <span className="font-mono text-cyan-300 text-[11px] font-bold">
            {appState.ticket.sectionCode} • F{appState.ticket.row} • A{appState.ticket.seat}
          </span>

          <span className="text-slate-600">|</span>

          <span className="font-mono text-slate-300 text-[11px]">
            {appState.speed.toFixed(1)} m/s
          </span>
        </div>

        {/* Center/Right: Custom GIF indicator & Countdown Timer */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Custom GIF Status / Attach Button */}
          {appState.customMediaName ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-400/70 text-cyan-200 text-xs backdrop-blur-md shadow-md">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
              <span className="max-w-[120px] sm:max-w-[160px] truncate font-medium">
                {appState.customMediaName}
              </span>
              {onClearCustomMedia && (
                <button
                  type="button"
                  onClick={onClearCustomMedia}
                  className="p-0.5 rounded-full hover:bg-cyan-800 text-cyan-300 hover:text-white cursor-pointer ml-1"
                  title="Quitar GIF"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 hover:text-white text-xs font-semibold backdrop-blur-md shadow-md cursor-pointer transition-all"
              title="Adjuntar GIF a la pantalla gigante del concierto"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Adjuntar GIF a Pantalla</span>
              <span className="sm:hidden">+ GIF</span>
            </button>
          )}

          {/* Pre-event 3-minute Countdown */}
          {!isConcertPhase && appState.phase !== 'EXITING_VENUE' && appState.phase !== 'COMPLETED' && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-xs font-mono font-bold backdrop-blur-md shadow-md">
              <Timer className="w-3.5 h-3.5 animate-spin-slow text-amber-400" />
              <span className="hidden sm:inline">Concierto en:</span>
              <span className="text-white text-sm">{formatTime(appState.timeRemainingSeconds)}</span>
            </div>
          )}

          {/* Concert Playing Status */}
          {isConcertPhase && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/25 border border-purple-400/60 text-purple-200 text-xs font-bold backdrop-blur-md shadow-md animate-pulse">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>EN VIVO</span>
            </div>
          )}

          {/* Audience Exit Countdown */}
          {appState.phase === 'EXITING_VENUE' && appState.audienceExitRemainingSeconds !== null && appState.audienceExitRemainingSeconds > 0 && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-500/25 border border-indigo-400/60 text-indigo-200 text-xs font-mono font-bold backdrop-blur-md shadow-md animate-pulse">
              <Timer className="w-3.5 h-3.5 text-indigo-300" />
              <span>Desalojo: {appState.audienceExitRemainingSeconds}s</span>
            </div>
          )}

          {/* Empty Venue Free Exploration Badge */}
          {appState.phase === 'EXITING_VENUE' && appState.isVenueEmpty && (
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/25 border border-emerald-400/80 text-emerald-200 text-xs font-bold backdrop-blur-md shadow-md">
              <Footprints className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
              <span>Escenario Libre</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. COMPACT SIDE NOTIFICATIONS */}
      <div className="fixed top-14 sm:top-16 right-2.5 sm:right-5 w-60 sm:w-72 flex flex-col items-end gap-1.5 z-40 pointer-events-auto">
        {/* Near Seat Prompt (Assigned seat during event, or ANY seat when venue is empty) */}
        {isNearSeat && !appState.isSeated && (
          <div className="w-full p-2 sm:p-2.5 rounded-xl bg-cyan-950/90 border border-cyan-400/80 shadow-lg text-white backdrop-blur-md flex items-center justify-between gap-2 transition-all">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-300 shrink-0">
                <Armchair className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-white truncate">
                  {appState.isVenueEmpty ? 'Asiento del Recinto' : '¡Llegaste a tu Asiento!'}
                </h4>
                <p className="text-[9px] text-cyan-200/90 truncate font-mono">
                  {appState.isVenueEmpty
                    ? (appState.currentSeatName || 'Asiento disponible')
                    : `${appState.ticket.sectionCode} • Fila ${appState.ticket.row} • A ${appState.ticket.seat}`}
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

        {/* Stage Control Console Switchboard Prompt (Located under main LED screen) */}
        {appState.isNearStagePanel && (
          <div className="w-full p-2.5 sm:p-3 rounded-2xl bg-slate-950/95 border-2 border-cyan-400 text-white shadow-2xl backdrop-blur-xl transition-all">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-400">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-[11px] text-cyan-300 tracking-wide uppercase">Tablero Escenario</h4>
                  <p className="text-[8px] text-slate-400">Bajo Pantalla (3 Interruptores)</p>
                </div>
              </div>
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                CONSOLA
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {/* Switch 1: Stage Lights */}
              <button
                type="button"
                onClick={onToggleStageLights}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                  appState.stageLightsOn
                    ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title="Encender o apagar las luces del escenario y reflectores"
              >
                <Sun className={`w-3.5 h-3.5 mb-0.5 ${appState.stageLightsOn ? 'text-amber-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="text-[9px] font-bold">Luz</span>
                <span className="text-[7px] font-mono mt-0.5 uppercase">
                  {appState.stageLightsOn ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Switch 2: Arena Screens */}
              <button
                type="button"
                onClick={onToggleStageScreens}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                  appState.stageScreensOn
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title="Encender o apagar las pantallas LED del recinto"
              >
                <Tv className={`w-3.5 h-3.5 mb-0.5 ${appState.stageScreensOn ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span className="text-[9px] font-bold">Pantallas</span>
                <span className="text-[7px] font-mono mt-0.5 uppercase">
                  {appState.stageScreensOn ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Switch 3: Custom GIF Screen */}
              <button
                type="button"
                onClick={onToggleGifScreen}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                  appState.gifScreenActive
                    ? 'bg-purple-500/30 border-purple-400 text-purple-200 shadow-md shadow-purple-500/20'
                    : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                }`}
                title="Encender transmisión del GIF con fundido al ritmo de la música"
              >
                <ImageIcon className={`w-3.5 h-3.5 mb-0.5 ${appState.gifScreenActive ? 'text-purple-400 animate-pulse' : 'text-slate-500'}`} />
                <span className="text-[9px] font-bold">GIF Escena</span>
                <span className="text-[7px] font-mono mt-0.5 uppercase">
                  {appState.gifScreenActive ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </button>
            </div>

            <div className="mt-1.5 text-[8px] text-slate-400 text-center">
              {appState.phase !== 'CONCERT_PLAYING' && appState.phase !== 'CONCERT_BLACKOUT' && appState.phase !== 'CONCERT_FINALE'
                ? `Preview GIF: ${appState.gifPreviewsUsed}/3 usos (al ritmo del beat)`
                : 'Control independiente en vivo durante el concierto'}
            </div>
          </div>
        )}

        {/* Blackout Flashlight Prompt */}
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

        {/* 5-Second Warning Before Blackout Ends */}
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

        {/* 5-Second Warning: Flashlight On While Lights On */}
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

        {/* Audience Evacuating Notification (30s) */}
        {appState.phase === 'EXITING_VENUE' && !appState.isVenueEmpty && (
          <div className="w-full p-2 sm:p-2.5 rounded-xl bg-indigo-950/90 border border-indigo-400/80 text-indigo-200 shadow-lg backdrop-blur-md flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className="p-1 rounded-md bg-indigo-500/20 text-indigo-300 shrink-0">
                <DoorOpen className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-[11px] text-white">Evento Finalizado</h4>
                <p className="text-[9px] text-indigo-200/90 truncate">
                  {appState.audienceExitRemainingSeconds !== null && appState.audienceExitRemainingSeconds > 0
                    ? `Público saliendo: ${appState.audienceExitRemainingSeconds}s`
                    : 'Salida por puertas verdes'}
                </p>
              </div>
            </div>
            {appState.isSeated && (
              <button
                type="button"
                onClick={onStandUp}
                className="py-1 px-2.5 rounded-lg bg-indigo-400 hover:bg-indigo-300 text-slate-950 font-bold text-[11px] shadow shrink-0 cursor-pointer"
              >
                Levantarse
              </button>
            )}
          </div>
        )}

      </div>

      {/* 3. CENTER MODALS */}
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
                Reiniciar desde los Autos
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
                Reiniciar desde los Autos
              </button>
            </div>
          </div>
        )}

        {/* Event Missed Modal (User outside when concert started) */}
        {appState.phase === 'EVENT_MISSED' && (
          <div className="p-6 rounded-2xl bg-amber-950/95 border-2 border-amber-500 shadow-2xl text-center text-white backdrop-blur-xl">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <CalendarX className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-extrabold text-amber-200">¡Te Has Perdido el Evento!</h3>
            <p className="text-xs sm:text-sm text-amber-100/90 mt-2">
              El concierto ha comenzado puntualmente y las puertas de acceso al recinto se han cerrado. No lograste ingresar al estadio a tiempo.
            </p>
            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={onResetComplete}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md cursor-pointer transition-all"
              >
                Reiniciar desde los Autos
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. COLLAPSIBLE BOTTOM ERGONOMIC DOCK */}
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
                    ? appState.isVenueEmpty
                      ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/20'
                      : appState.isInsideVenue
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                      : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
                title={
                  appState.isVenueEmpty
                    ? '¡Recinto vacío! Puedes correr a toda velocidad para explorar el escenario'
                    : appState.isInsideVenue
                    ? '¡Cuidado! Prohibido correr en el recinto con público'
                    : 'Alternar Caminar / Correr'
                }
              >
                <Footprints className="w-4 h-4" />
                <span>
                  {appState.sprintEnabled
                    ? appState.isVenueEmpty
                      ? 'Corriendo (Libre)'
                      : 'Corriendo'
                    : 'Caminando'}
                </span>
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

            {/* Center: Flashlight and Custom Screen GIF */}
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

              {/* Attach GIF to Screen button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer transition-all"
                title="Selecciona un GIF, imagen o video de tu dispositivo para transmitir a la pantalla del concierto"
              >
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span>{appState.customMediaName ? 'Cambiar GIF' : 'GIF Pantalla'}</span>
              </button>

              {/* Pre-concert GIF Preview Button with Rhythmic Blackout Cuts (up to 3 uses) */}
              {appState.customMediaUrl && !isConcertPhase && appState.phase !== 'EXITING_VENUE' && (
                <button
                  type="button"
                  onClick={onToggleGifScreen}
                  disabled={appState.gifPreviewsUsed >= 3 && !appState.gifScreenActive}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    appState.gifScreenActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 animate-pulse'
                      : appState.gifPreviewsUsed >= 3
                      ? 'bg-slate-800/60 border border-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-purple-950/80 hover:bg-purple-900 border border-purple-500/50 text-purple-300'
                  }`}
                  title="Previsualizar el GIF en pantalla con cambios al ritmo de la música y fundido negro"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span>
                    {appState.gifScreenActive
                      ? 'Detener Preview'
                      : `Preview GIF (${3 - appState.gifPreviewsUsed}/3)`}
                  </span>
                </button>
              )}
            </div>

            {/* Right: Show controls */}
            <div className="flex items-center gap-2">
              {!isConcertPhase && appState.phase !== 'EXITING_VENUE' && appState.isInsideVenue && (
                <button
                  type="button"
                  onClick={onStartShowNow}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
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
