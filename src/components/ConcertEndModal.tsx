/**
 * Concert End Modal
 * Displays completion achievements and allows restarting or changing seats.
 */
import React from 'react';
import { TicketInfo } from '../types';
import { Award, CheckCircle2, RotateCcw, Ticket, Sparkles } from 'lucide-react';

interface Props {
  ticket: TicketInfo;
  hasExploredEmptyVenue?: boolean;
  onRestart: () => void;
  onChangeTicket: () => void;
}

export const ConcertEndModal: React.FC<Props> = ({
  ticket,
  hasExploredEmptyVenue = false,
  onRestart,
  onChangeTicket,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 overflow-y-auto">
      <div className="w-full max-w-lg my-auto bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md text-white text-center">
        {/* Trophy icon */}
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400">
          <Award className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-2">
          <Sparkles className="w-3.5 h-3.5" />
          {hasExploredEmptyVenue
            ? 'Exploración de Escenario Concluida • Último Asistente'
            : 'Simulación de Evento Concluida'}
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          {hasExploredEmptyVenue ? '¡Has explorado el escenario!' : '¡Experiencia Completada con Éxito!'}
        </h2>
        <p className="text-slate-400 text-xs sm:text-sm max-w-md mx-auto mb-6">
          {hasExploredEmptyVenue
            ? 'Has recorrido y explorado libremente el escenario y las instalaciones tras la salida completa del público, siendo el último asistente en retirarse del recinto.'
            : 'Has recorrido el recinto, localizado tu asiento con el boleto digital, disfrutado el concierto dinámico de luces y acompañado a la multitud hacia la salida segura.'}
        </p>

        {/* Recap Card */}
        <div className="rounded-xl bg-slate-950/70 border border-slate-800 p-4 text-left text-xs mb-6 space-y-2">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-slate-300">
            <span className="font-semibold text-white">Evento:</span>
            <span className="text-cyan-300">{ticket.eventName}</span>
          </div>
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-slate-300">
            <span className="font-semibold text-white">Tu Asiento:</span>
            <span className="text-amber-400 font-bold">
              {ticket.section} • F {ticket.row} • A {ticket.seat}
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 pt-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {hasExploredEmptyVenue
                ? 'Acceso exclusivo y recorrido libre por el escenario'
                : 'Límite de velocidad en recinto respetado'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {hasExploredEmptyVenue
                ? 'Carrera a máxima velocidad por el recinto vacío habilitada'
                : 'Iluminación dinámica y sensores activos'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {hasExploredEmptyVenue
                ? 'Salida final como último espectador tras el desalojo del público'
                : 'Evacuación guiada con el público'}
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Revivir la Experiencia (Mismo Asiento)</span>
          </button>
          <button
            type="button"
            onClick={onChangeTicket}
            className="w-full py-3 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            <span>Elegir Otra Ubicación / Nuevo Boleto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
