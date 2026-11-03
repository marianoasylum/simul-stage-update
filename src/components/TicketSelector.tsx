/**
 * Ticket Selection Screen - Movistar Arena Buenos Aires
 * Allows user to pick real Movistar Arena sectors, rows, and seats.
 * Displays accurate sector aforo and gate information.
 */
import React, { useState } from 'react';
import { TicketInfo } from '../types';
import { Ticket, Sparkles, MapPin, Calendar, QrCode, ShieldCheck, ArrowRight, Users, DoorOpen } from 'lucide-react';

interface Props {
  onTicketConfirmed: (ticket: TicketInfo) => void;
}

export const SECTIONS = [
  {
    code: 'VIP' as const,
    name: 'Campo Delantero / VIP Escenario',
    desc: 'Ubicación frontal directa frente a la pasarela y escenario principal. Sonido envolvente inmersivo.',
    price: '$180.000 ARS',
    color: 'from-amber-500/20 to-rose-500/20 border-amber-500/50 text-amber-300',
    gate: 'Acceso Puertas 1 y 2 (Calle Humboldt)',
    gateNumber: 1,
    sectorAforo: 3500,
    occupancyPercent: 94,
    doors: 'Puertas 1 - 2',
  },
  {
    code: 'PB_TRASERA' as const,
    name: 'Planta Baja Trasera',
    desc: 'Sector en planta baja ubicado en el sector central posterior. Vista despejada a escenario y pantallas.',
    price: '$120.000 ARS',
    color: 'from-teal-500/20 to-cyan-500/20 border-teal-500/50 text-teal-300',
    gate: 'Acceso Puertas 5 y 6 (Calle Humboldt)',
    gateNumber: 5,
    sectorAforo: 2800,
    occupancyPercent: 86,
    doors: 'Puertas 5 - 6',
  },
  {
    code: 'PLAT' as const,
    name: 'Platea Baja Central Preferencial',
    desc: 'Grada baja con visibilidad acústica óptima, elevación perfecta y perspectiva frontal a las pantallas LED.',
    price: '$130.000 ARS',
    color: 'from-blue-500/20 to-cyan-500/20 border-cyan-500/50 text-cyan-300',
    gate: 'Acceso Puertas 3 y 4 (Calle Humboldt)',
    gateNumber: 3,
    sectorAforo: 4500,
    occupancyPercent: 88,
    doors: 'Puertas 3 - 4',
  },
  {
    code: 'GRAD' as const,
    name: 'Platea Alta Panorámica',
    desc: 'Nivel intermedio con ángulo panorámico total del domo, el despliegue lumínico y la atmósfera del show.',
    price: '$90.000 ARS',
    color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/50 text-emerald-300',
    gate: 'Acceso Puertas 7 a 11 (Calle Humboldt)',
    gateNumber: 8,
    sectorAforo: 4000,
    occupancyPercent: 82,
    doors: 'Puertas 7 - 11',
  },
  {
    code: 'TRIB' as const,
    name: 'Tribuna Alta General',
    desc: 'Visión cenital imponente de los 15.000 asistentes, el domo arquitectónico y el espectáculo de láseres.',
    price: '$55.000 ARS',
    color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/50 text-purple-300',
    gate: 'Acceso Puertas 12 a 16 (Calle Humboldt)',
    gateNumber: 13,
    sectorAforo: 3000,
    occupancyPercent: 75,
    doors: 'Puertas 12 - 16',
  },
];

export const TOTAL_VENUE_AFORO = 15000;

export const TicketSelector: React.FC<Props> = ({ onTicketConfirmed }) => {
  const [selectedSectionCode, setSelectedSectionCode] = useState<'VIP' | 'PLAT' | 'GRAD' | 'TRIB' | 'PB_TRASERA'>('VIP');
  const [row, setRow] = useState<number>(2);
  const [seat, setSeat] = useState<number>(8);

  const selectedSection = SECTIONS.find((s) => s.code === selectedSectionCode) || SECTIONS[0];

  const handleConfirm = () => {
    if (navigator.vibrate) navigator.vibrate(50);
    const ticket: TicketInfo = {
      section: selectedSection.name,
      sectionCode: selectedSection.code,
      row,
      seat,
      eventName: 'SYNTHWAVE LIVE 2026 • MOVISTAR ARENA TOUR',
      venueName: 'Movistar Arena Buenos Aires',
      gate: selectedSection.gate,
      gateNumber: selectedSection.gateNumber,
      ticketId: `MVA-${selectedSection.code}-${row}${seat}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: 'Viernes, 24 Octubre 2026 • 21:00 HRS',
      price: selectedSection.price,
      capacity: `${selectedSection.sectorAforo.toLocaleString()} personas`,
      sectorAforo: selectedSection.sectorAforo,
      totalVenueAforo: TOTAL_VENUE_AFORO,
    };
    onTicketConfirmed(ticket);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/95 overflow-y-auto">
      <div className="w-full max-w-2xl my-auto bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-7 backdrop-blur-md text-white">
        {/* Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold tracking-wider uppercase mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Movistar Arena Buenos Aires • Humboldt 450
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            <span>Venta Oficial de Entradas</span>
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-lg mx-auto">
            Elige tu sector dentro del modelo 3D del <span className="text-cyan-300 font-semibold">Movistar Arena</span>. Aforo total oficial: <span className="text-emerald-400 font-bold">15.000 personas</span>.
          </p>

          {/* Aforo Summary pill */}
          <div className="mt-3 inline-flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Users className="w-3.5 h-3.5" />
              <span>Aforo Total: <strong className="text-white">15.000 espectadores</strong></span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-emerald-400">
              <DoorOpen className="w-3.5 h-3.5" />
              <span>16 Accesos habilitados</span>
            </div>
          </div>
        </div>

        {/* Section Picker Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
          {SECTIONS.map((sec) => {
            const isSelected = selectedSectionCode === sec.code;
            return (
              <button
                key={sec.code}
                type="button"
                onClick={() => {
                  setSelectedSectionCode(sec.code);
                  if (navigator.vibrate) navigator.vibrate(20);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? `bg-slate-800/90 ${sec.color} shadow-lg ring-2 ring-cyan-400/50`
                    : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-sm text-white">{sec.name}</span>
                  <span className="text-xs font-bold text-cyan-400 font-mono">{sec.price}</span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-2">{sec.desc}</p>
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/80 font-mono text-slate-400">
                  <span className="flex items-center gap-1 text-slate-300">
                    <Users className="w-3 h-3 text-cyan-400" />
                    Aforo: <strong className="text-white">{sec.sectorAforo.toLocaleString()}</strong>
                  </span>
                  <span className="text-cyan-300 font-medium">{sec.doors}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Row & Seat Selectors */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Fila (1 - 10)
              </label>
              <span className="text-sm font-bold text-cyan-400 font-mono">Fila {row}</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={row}
              onChange={(e) => setRow(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Asiento (1 - 20)
              </label>
              <span className="text-sm font-bold text-cyan-400 font-mono">Nº {seat}</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              value={seat}
              onChange={(e) => setSeat(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Digital Ticket Card Preview */}
        <div className="relative rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 p-4 mb-5 shadow-inner">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-2.5 mb-2.5">
            <div>
              <span className="text-[10px] tracking-widest uppercase font-mono text-cyan-400 block">
                MOVISTAR ARENA BUENOS AIRES • BOLETO DIGITAL
              </span>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-cyan-400" />
                SYNTHWAVE LIVE 2026
              </h3>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-slate-400 block">LOCALIDAD</span>
              <span className="text-sm font-bold text-amber-400">{selectedSection.name}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs py-1.5">
            <div>
              <span className="text-slate-500 block uppercase text-[10px]">Fila</span>
              <span className="font-bold text-white text-sm font-mono">{row}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase text-[10px]">Asiento</span>
              <span className="font-bold text-white text-sm font-mono">{seat}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase text-[10px]">Puerta de Acceso</span>
              <span className="font-bold text-cyan-300 text-sm font-mono">{selectedSection.gate}</span>
            </div>
            <div>
              <span className="text-slate-500 block uppercase text-[10px]">Aforo Sector</span>
              <span className="font-medium text-emerald-300 text-sm font-mono">{selectedSection.sectorAforo.toLocaleString()} pers.</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Acceso Verificado • Humboldt 450</span>
            </div>
            <span className="text-[10px] tracking-widest text-slate-500">ID: MVA-{selectedSection.code}-{row}{seat}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white font-bold text-base shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-3 cursor-pointer"
        >
          <span>Confirmar Entrada y Recorrer Recinto</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
