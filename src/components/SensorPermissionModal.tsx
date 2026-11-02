/**
 * Sensor Permission Modal
 * Handles user gesture activation for Gyroscope (iOS/Android), Microphone (Web Audio),
 * and Camera (WebRTC Video Texture).
 */
import React, { useState } from 'react';
import { Compass, Mic, Camera, Navigation, Sparkles, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface Props {
  onPermissionsFinished: (sensors: {
    gyroAllowed: boolean;
    micAllowed: boolean;
    cameraStream: MediaStream | null;
    gpsAllowed?: boolean;
  }) => void;
}

export const SensorPermissionModal: React.FC<Props> = ({ onPermissionsFinished }) => {
  const [gyroStatus, setGyroStatus] = useState<'idle' | 'granted' | 'denied' | 'unsupported'>('idle');
  const [micStatus, setMicStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Request Gyroscope
  const requestGyro = async () => {
    try {
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        // iOS 13+ permission request
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const permission = await (DeviceOrientationEvent as any).requestPermission();
        if (permission === 'granted') {
          setGyroStatus('granted');
        } else {
          setGyroStatus('denied');
        }
      } else if ('DeviceOrientationEvent' in window) {
        // Android Chrome / standard browser
        setGyroStatus('granted');
      } else {
        setGyroStatus('unsupported');
      }
    } catch (e) {
      console.warn('Gyro request error:', e);
      setGyroStatus('denied');
    }
  };

  // 2. Request Microphone
  const requestMic = async () => {
    const success = await soundEngine.connectMicrophone();
    setMicStatus(success ? 'granted' : 'denied');
  };

  // 3. Request Camera
  const requestCam = async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        setCameraStream(stream);
        setCameraStatus('granted');
      } else {
        setCameraStatus('denied');
      }
    } catch (e) {
      console.warn('Camera request error:', e);
      setCameraStatus('denied');
    }
  };

  // 4. Request GPS (Optional)
  const requestGps = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => setGpsStatus('granted'),
        () => setGpsStatus('denied'),
        { timeout: 8000 }
      );
    } else {
      setGpsStatus('denied');
    }
  };

  // 5. Request All At Once
  const handleRequestAll = async () => {
    setIsProcessing(true);
    soundEngine.init();
    await requestGyro();
    await requestMic();
    await requestCam();
    requestGps();
    setIsProcessing(false);
  };

  // Finish & Launch 3D Simulation
  const handleProceed = () => {
    if (navigator.vibrate) navigator.vibrate(40);
    soundEngine.playCarDoor(); // SFX of stepping out of the parked car!
    onPermissionsFinished({
      gyroAllowed: gyroStatus === 'granted',
      micAllowed: micStatus === 'granted',
      cameraStream,
      gpsAllowed: gpsStatus === 'granted',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/95 overflow-y-auto">
      <div className="w-full max-w-lg my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md text-white">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mx-auto mb-3 text-cyan-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Configuración de Sensores</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Para una inmersión completa según el SDD, la experiencia utiliza los sensores de tu dispositivo.
          </p>
        </div>

        {/* Sensors List */}
        <div className="space-y-3 mb-6">
          {/* Gyroscope */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Giroscopio / Orientación</h4>
                <p className="text-xs text-slate-400">Control de cámara con el movimiento del móvil</p>
              </div>
            </div>
            {gyroStatus === 'granted' ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Activo
              </span>
            ) : (
              <button
                type="button"
                onClick={requestGyro}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-300 border border-cyan-500/30 cursor-pointer"
              >
                Activar
              </button>
            )}
          </div>

          {/* Microphone */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Micrófono (Web Audio API)</h4>
                <p className="text-xs text-slate-400">Geometrías y luces reactivas al volumen/ritmo</p>
              </div>
            </div>
            {micStatus === 'granted' ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Activo
              </span>
            ) : (
              <button
                type="button"
                onClick={requestMic}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 border border-emerald-500/30 cursor-pointer"
              >
                Activar
              </button>
            )}
          </div>

          {/* Camera Feed */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Cámara Trasera (VideoTexture)</h4>
                <p className="text-xs text-slate-400">Transmisión a las pantallas gigantes del recinto</p>
              </div>
            </div>
            {cameraStatus === 'granted' ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Activo
              </span>
            ) : (
              <button
                type="button"
                onClick={requestCam}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-purple-300 border border-purple-500/30 cursor-pointer"
              >
                Activar
              </button>
            )}
          </div>

          {/* GPS Real-World Walk (Optional) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <Navigation className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">GPS / Ubicación (Opcional)</h4>
                <p className="text-xs text-slate-400">Caminata realista: camina en el mundo real para moverte en 3D</p>
              </div>
            </div>
            {gpsStatus === 'granted' ? (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Activo
              </span>
            ) : (
              <button
                type="button"
                onClick={requestGps}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 border border-emerald-500/30 cursor-pointer"
              >
                Habilitar
              </button>
            )}
          </div>
        </div>

        {/* Note about permission denials */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Si algún sensor no está disponible o rechazas el permiso, podrás usar controles táctiles y audio procedural simulado sin problemas.
          </span>
        </div>

        {/* Buttons */}
        <div className="space-y-2">
          {gyroStatus === 'idle' && micStatus === 'idle' && cameraStatus === 'idle' && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleRequestAll}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Autorizar Sensores en Conjunto</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleProceed}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Iniciar Experiencia 3D</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
