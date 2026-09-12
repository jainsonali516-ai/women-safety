'use client';

import React, { useState } from 'react';
import {
  Navigation,
  MapPin,
  Crosshair,
  Train,
  Bus,
  Car,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export interface JourneySearchValues {
  origin: string;
  destination: string;
  travelDate: string;
  selectedModes: string[];
  originCoords: { latitude: number; longitude: number } | null;
}

interface HeroProps {
  pinkSaheliActive: boolean;
  onTogglePinkSaheli: () => void;
  onSearch: (values: JourneySearchValues) => void;
  loading?: boolean;
}

export const JourneySearchHero: React.FC<HeroProps> = ({
  pinkSaheliActive,
  onTogglePinkSaheli,
  onSearch,
  loading,
}) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [travelDate, setTravelDate] = useState(new Date().toISOString().split('T')[0]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'success' | 'fallback'>('idle');
  const [originCoords, setOriginCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [selectedModes, setSelectedModes] = useState<string[]>(['metro', 'dtc_bus', 'cab']);

  const handleDetectLocation = () => {
    setGpsLoading(true);
    setGpsStatus('idle');

    if (!navigator.geolocation) {
      setGpsStatus('fallback');
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setOriginCoords({ latitude, longitude });
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            setOrigin(data.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            setGpsStatus('success');
          } else {
            setOrigin(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            setGpsStatus('success');
          }
        } catch {
          setOrigin(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setGpsStatus('success');
        } finally {
          setGpsLoading(false);
        }
      },
      (error) => {
        console.warn('GPS location request failed:', error.message);
        setGpsStatus('fallback');
        setGpsLoading(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const toggleMode = (mode: string) => {
    setSelectedModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ origin, destination, travelDate, selectedModes, originCoords });
  };

  return (
    <section className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-pink-500/30 backdrop-blur-md shadow-lg shadow-pink-500/10">
          <ShieldCheck className="w-4 h-4 text-pink-400" />
          <span className="text-xs font-semibold tracking-wide text-pink-300">
            Delhi NCR Safety Network &amp; Night Corridor Map
          </span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-pink-100 dark:to-purple-200">
          Navigate Delhi NCR with <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 dark:from-pink-400 dark:via-rose-400 dark:to-purple-400">
            Confidence &amp; Peace of Mind
          </span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-slate-600 dark:text-slate-300 font-normal leading-relaxed">
          Safety-scored routes, well-lit corridors, foot-density signals, and instant zero-cost emergency location sharing for female commuters.
        </p>

        <div className="mt-8 max-w-4xl mx-auto bg-white/70 dark:bg-slate-950/60 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl transition-colors duration-500">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
              <div className="relative group text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Starting Point / Current Location
                </label>
                <div className="relative flex items-center">
                  <MapPin className="absolute left-4 w-5 h-5 text-pink-500" />
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => {
                      setOrigin(e.target.value);
                      setOriginCoords(null);
                    }}
                    placeholder="Enter station or landmark..."
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-100/80 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleDetectLocation}
                    title="Detect Current GPS Location"
                    className="absolute right-3 p-2 text-slate-400 hover:text-pink-500 dark:hover:text-pink-400 rounded-xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                  >
                    <Crosshair className={`w-4 h-4 ${gpsLoading ? 'animate-spin text-pink-500' : ''}`} />
                  </button>
                </div>
                {gpsStatus === 'fallback' && (
                  <p className="mt-1.5 text-xs text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> GPS signal weak. Enter manual landmark above.
                  </p>
                )}
                {gpsStatus === 'success' && (
                  <p className="mt-1.5 text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> GPS position locked.
                  </p>
                )}
              </div>

              <div className="relative group text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Destination Point
                </label>
                <div className="relative flex items-center">
                  <Navigation className="absolute left-4 w-5 h-5 text-purple-500" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Where are you heading?"
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-100/80 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-2xl text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Travel Date:</span>
                <input
                  type="date"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="bg-slate-100 dark:bg-black/40 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-pink-500"
                />
              </div>

              <div
                onClick={onTogglePinkSaheli}
                className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 px-4 py-2 rounded-2xl bg-pink-500/10 border border-pink-500/20 cursor-pointer hover:bg-pink-500/20 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <Bus className="w-4 h-4 text-pink-500" />
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Pink Saheli Smart Card</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      {pinkSaheliActive ? '₹0 Fare active for DTC Buses' : 'Standard DTC Fare applied'}
                    </p>
                  </div>
                </div>
                <div className={`w-9 h-5 flex items-center rounded-full p-1 transition-colors ${pinkSaheliActive ? 'bg-pink-600' : 'bg-slate-400 dark:bg-slate-700'}`}>
                  <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${pinkSaheliActive ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            <div className="space-y-2 text-left pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Filter Safe Transit Modes
                </span>
                <span className="text-[11px] font-semibold text-amber-500 dark:text-amber-400">
                  🚫 Two-Wheelers Excluded for Safety
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleMode('metro')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                    selectedModes.includes('metro')
                      ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <Train className="w-3.5 h-3.5" /> Delhi Metro
                </button>

                <button
                  type="button"
                  onClick={() => toggleMode('dtc_bus')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                    selectedModes.includes('dtc_bus')
                      ? 'bg-pink-600 text-white border-pink-500 shadow-md shadow-pink-600/30'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <Bus className="w-3.5 h-3.5" /> DTC Bus {pinkSaheliActive && '(₹0)'}
                </button>

                <button
                  type="button"
                  onClick={() => toggleMode('cab')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
                    selectedModes.includes('cab')
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-700 shadow-md'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" /> Verified Cabs (Uber/Ola)
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-base shadow-xl shadow-pink-500/25 transition-all transform active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Sparkles className="w-5 h-5" /> {loading ? 'Calculating...' : 'Calculate Safest Route Options'}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};
