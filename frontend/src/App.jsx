import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, Settings, MapPin, Mic, MicOff, Send, Sun, Moon, 
  Wind, Droplets, AlertTriangle, X, Trash2, Sparkles, Loader2, 
  PlusCircle, MessageSquare, ChevronDown, ChevronUp, Copy, Check,
  Info, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { fetchCurrentWeather, sendWeatherQuery, getChatHistory, deleteChatHistory, bootstrapUser } from './services/api';

const WEATHER_BACKGROUNDS = {
  Clear: "https://images.unsplash.com/photo-1601297183305-6df142704ea2?q=80&w=1000&auto=format&fit=crop",
  Cloudy: "https://images.unsplash.com/photo-1534088568595-a066f410cbda?q=80&w=1000&auto=format&fit=crop",
  Rain: "https://images.unsplash.com/photo-1519692933481-e162a57d6721?q=80&w=1000&auto=format&fit=crop",
  Thunderstorm: "https://images.unsplash.com/photo-1605727216801-e27ce1d0cc28?q=80&w=1000&auto=format&fit=crop",
  Mist: "https://images.unsplash.com/photo-1487621167305-5d248087c724?q=80&w=1000&auto=format&fit=crop",
};

const INDIAN_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "te", name: "తెలుగు (Telugu)" }
];

// --- TELEMETRY-BASED ADVISORY ENGINE ---
const generateWeatherAdvisory = (weather) => {
  if (!weather) {
    return {
      title: "Telemetry Syncing",
      text: "Synchronizing localized weather telemetry...",
      badge: "Updating"
    };
  }

  const advisories = [];
  const uv = weather.uv_index || 0;
  const wind = weather.wind_speed || 0;
  const temp = weather.temperature || 0;
  const humidity = weather.humidity || 0;
  const condition = (weather.condition || "").toLowerCase();

  // UV Telemetry Evaluation
  if (uv >= 8) {
    advisories.push("Very high UV levels detected: apply broad-spectrum SPF 30+ and limit midday sun exposure.");
  } else if (uv >= 6) {
    advisories.push("Moderate-to-high UV: wear protective eyewear and sun cover outdoors.");
  }

  // Wind Evaluation
  if (wind >= 35) {
    advisories.push(`Strong winds (${wind} km/h): secure lightweight outdoor fixtures and exercise transit caution.`);
  } else if (wind >= 22) {
    advisories.push("Breezy atmospheric conditions present.");
  }

  // Precipitation & Condition
  if (condition.includes("rain") || condition.includes("shower") || condition.includes("drizzle")) {
    advisories.push("Precipitation active: wet roadways expected, carry rain gear.");
  } else if (condition.includes("thunder") || condition.includes("storm")) {
    advisories.push("Convective storm activity detected: remain indoors away from electrical fixtures.");
  }

  // Temperature & Humidity
  if (temp >= 35) {
    advisories.push("Elevated ambient temperatures: maintain regular hydration and avoid strenuous midday activity.");
  } else if (temp <= 10) {
    advisories.push("Cold ambient temperatures: layered thermal insulation recommended.");
  }

  if (humidity >= 85 && temp >= 28) {
    advisories.push("Elevated humidity levels may suppress sweat evaporation and heighten thermal stress.");
  }

  // AQI Evaluation if present in telemetry
  if (weather.aqi && weather.aqi > 150) {
    advisories.push("Unhealthy air quality index: sensitive demographics should wear particulate-filtering masks.");
  }

  if (advisories.length === 0) {
    return {
      title: "Environmental Advisory",
      text: "Optimal atmospheric parameters. Conditions are stable for outdoor commuting and field work.",
      badge: "Normal"
    };
  }

  return {
    title: "Environmental Advisory",
    text: advisories.slice(0, 2).join(" "),
    badge: (uv >= 6 || temp >= 35 || wind >= 35) ? "Attention" : "Info"
  };
};

// --- ABSOLUTE GAUGES ---
const UVGauge = ({ value }) => {
  const maxUV = 11;
  const percent = Math.min(value / maxUV, 1);
  const rotation = percent * 270 - 135;
  return (
    <div className="relative w-[72px] h-[72px]">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="uvGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="33%" stopColor="#eab308" />
            <stop offset="66%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="url(#uvGrad)" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <motion.div 
        className="absolute inset-0 origin-center"
        initial={{ rotate: -135 }}
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 60, damping: 15 }}
      >
        <div className="w-3 h-3 bg-white border-[3px] border-zinc-800 rounded-full absolute top-[5px] left-1/2 -translate-x-1/2 shadow-sm" />
      </motion.div>
    </div>
  );
};

const HumidityGauge = ({ value }) => {
  const percent = value / 100;
  return (
    <div className="relative w-[72px] h-[72px]">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" strokeLinecap="round" />
        <motion.path 
          d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" 
          fill="none" 
          stroke="#3b82f6" 
          strokeWidth="8" 
          strokeLinecap="round" 
          strokeDasharray="188.5"
          initial={{ strokeDashoffset: 188.5 }}
          animate={{ strokeDashoffset: 188.5 * (1 - percent) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-blue-400 mt-1">
        <Droplets size={24} fill="currentColor" fillOpacity={0.2} />
      </div>
    </div>
  );
};

const SpeedometerGauge = ({ value }) => {
  const min = 0; const max = 50;
  const percent = Math.max(0, Math.min((value - min) / (max - min), 1));
  const rotation = percent * 270 - 135;
  return (
    <div className="relative w-[72px] h-[72px]">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="tempGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="40%" stopColor="#22c55e" />
            <stop offset="70%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" strokeLinecap="round" />
        <motion.path 
          d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" 
          fill="none" 
          stroke="url(#tempGrad)" 
          strokeWidth="8" 
          strokeLinecap="round" 
          strokeDasharray="188.5"
          initial={{ strokeDashoffset: 188.5 }}
          animate={{ strokeDashoffset: 188.5 * (1 - percent) }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <motion.div 
        className="absolute inset-0 origin-center flex flex-col items-center pt-[14px]"
        initial={{ rotate: -135 }}
        animate={{ rotate: rotation }}
        transition={{ type: "spring", stiffness: 60, damping: 15 }}
      >
        <div className="w-[3px] h-[18px] bg-white rounded-full shadow-md" />
        <div className="w-2.5 h-2.5 bg-white rounded-full absolute top-[31px]" />
      </motion.div>
    </div>
  );
};

const WindCompass = () => (
  <div className="relative w-[72px] h-[72px]">
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
      <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="2 4" />
      <text x="50" y="12" fill="white" fontSize="12" textAnchor="middle" className="font-bold">N</text>
      <text x="50" y="96" fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle">S</text>
      <text x="94" y="54" fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle">E</text>
      <text x="6" y="54" fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle">W</text>
    </svg>
    <motion.div 
      className="absolute inset-0 flex items-center justify-center origin-center"
      initial={{ rotate: 0 }}
      animate={{ rotate: 45 }}
      transition={{ duration: 1.5, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7 text-blue-400 drop-shadow-lg">
        <polygon points="12,2 19,21 12,17 5,21" fill="currentColor" />
      </svg>
    </motion.div>
  </div>
);

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);

  const [location, setLocation] = useState({ name: "Locating...", lat: null, lon: null });
  const [isLocating, setIsLocating] = useState(true);
  const [language, setLanguage] = useState("en");
  const [weather, setWeather] = useState(null);
  const [history, setHistory] = useState([]);
  
  const [locationSearchInput, setLocationSearchInput] = useState("");
  const [locationResults, setLocationResults] = useState([]);

  const [query, setQuery] = useState("");
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [currentChat, setCurrentChat] = useState([]); 
  const [aiMode, setAiMode] = useState("detailed");
  const [isListening, setIsListening] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  
  const messagesEndRef = useRef(null);

  // Swipe Gestures
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 60;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) {
      if (isSidebarOpen) setIsSidebarOpen(false);
      else if (!isSettingsOpen) setIsSettingsOpen(true);
    }
    if (distance < -minSwipeDistance) {
      if (isSettingsOpen) setIsSettingsOpen(false);
      else if (!isSidebarOpen) setIsSidebarOpen(true);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const bootstrapData = await bootstrapUser();
        if (bootstrapData.chat_history?.length > 0) setHistory(bootstrapData.chat_history);
        if (bootstrapData.saved_location) {
          setLocation(bootstrapData.saved_location);
          setIsLocating(false);
          return;
        }
      } catch (err) { console.error("Bootstrap error:", err); }

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude; const lon = pos.coords.longitude;
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
              const data = await res.json();
              const city = data.address?.city || data.address?.town || data.address?.village || "Dehradun";
              setLocation({ name: city, lat, lon });
            } catch { setLocation({ name: "Dehradun", lat, lon }); } 
            finally { setIsLocating(false); }
          },
          () => { setLocation({ name: "Dehradun", lat: 30.3165, lon: 78.0322 }); setIsLocating(false); },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        setLocation({ name: "Dehradun", lat: 30.3165, lon: 78.0322 }); setIsLocating(false);
      }
    };
    initializeApp();
  }, []);

  useEffect(() => { if (!isLocating && location.lat && location.lon) loadWeatherData(); }, [location, isLocating]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentChat, isLoadingAi]);

  const loadWeatherData = async () => {
    try {
      const res = await fetchCurrentWeather(location.lat, location.lon, location.name);
      
      // --- TEST THUNDERSTORM INJECTION ---
      const weatherData = res.data;
      weatherData.alerts = [
        {
          title: "TEST: SEVERE THUNDERSTORM WARNING",
          description: "Intense thunderstorm activity detected approaching your location. Expect frequent lightning, heavy downpours, and damaging wind gusts.",
          severity: "Extreme" 
        }
      ];
      // -----------------------------

      setWeather(weatherData);
    } catch (err) { 
      console.error("Failed to load weather:", err); 
    }
  };

  const handleSearchLocation = async () => {
    if (!locationSearchInput.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationSearchInput)}&format=json&limit=5`);
      const data = await res.json();
      setLocationResults(data || []);
    } catch { setLocationResults([]); }
  };

  const handleSelectLocation = (loc) => {
    const shortName = loc.name || loc.display_name.split(',')[0];
    setLocation({ name: shortName, lat: parseFloat(loc.lat), lon: parseFloat(loc.lon) });
    setIsSettingsOpen(false);
    setLocationSearchInput("");
    setLocationResults([]);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSendQuery = async (userPrompt = query) => {
    const activeText = userPrompt.trim();
    if (!activeText || isLoadingAi) return;

    setIsLoadingAi(true);
    setQuery("");
    setCurrentChat(prev => [...prev, { role: 'user', content: activeText }]);

    try {
      const res = await sendWeatherQuery({
        query: activeText, latitude: location.lat, longitude: location.lon,
        location_name: location.name, language: language, mode: aiMode
      });
      setCurrentChat(prev => [...prev, { role: 'ai', content: res.response }]);
      const updatedHistory = await getChatHistory();
      setHistory(updatedHistory.history || []);
    } catch {
      setCurrentChat(prev => [...prev, { role: 'ai', content: "Backend unreachable. Please try again." }]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const activeBackground = weather?.condition?.includes("Rain") ? WEATHER_BACKGROUNDS.Rain 
    : weather?.condition?.includes("Thunder") ? WEATHER_BACKGROUNDS.Thunderstorm 
    : WEATHER_BACKGROUNDS.Cloudy;

  const quickPrompts = [
    `Weather in ${location.name}?`,
    "Will it rain tomorrow?",
    "Is it safe for outdoor travel?",
    "UV and wind safety advice?"
  ];

  const environmentalAdvisory = generateWeatherAdvisory(weather);

  return (
    <div className={`min-h-screen w-full flex items-center justify-center font-sans transition-colors duration-500 select-none ${darkMode ? 'dark bg-zinc-950' : 'bg-slate-100'}`}>
      
      <motion.div 
        layout onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        className="relative w-full h-screen sm:h-[860px] sm:w-[410px] sm:rounded-[3rem] sm:border-[6px] sm:border-black/30 shadow-2xl overflow-hidden bg-cover bg-center text-white transition-all duration-700"
        style={{ backgroundImage: `url(${activeBackground})` }}
      >
        <div className={`absolute inset-0 transition-colors duration-500 pointer-events-none ${darkMode ? 'bg-black/60 backdrop-blur-[1px]' : 'bg-black/25'}`} />

        <AnimatePresence>
          {(isSidebarOpen || isSettingsOpen) && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setIsSidebarOpen(false); setIsSettingsOpen(false); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer"
            />
          )}
        </AnimatePresence>

        {/* --- LEFT DRAWER: CHAT HISTORY --- */}
        <motion.aside 
          initial={false} animate={{ x: isSidebarOpen ? 0 : "-100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute inset-y-0 left-0 w-72 bg-[#0a0f1d]/95 backdrop-blur-3xl border-r border-white/10 z-50 flex flex-col shadow-2xl"
        >
          <div className="p-5 flex justify-between items-center">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setCurrentChat([]); setIsSidebarOpen(false); }} className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-2xl text-sm font-medium flex items-center justify-center gap-2 transition">
              <PlusCircle size={18} className="text-blue-400" /> New Chat
            </motion.button>
            <button onClick={() => setIsSidebarOpen(false)} className="ml-3 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"><X size={20} /></button>
          </div>
          <div className="px-5 pb-2 text-[11px] font-semibold text-white/40 uppercase tracking-widest">Recent Chats</div>
          <div className="flex-1 overflow-y-auto px-3 space-y-1.5 scrollbar-hide pb-16">
            {history.length === 0 ? <p className="text-sm text-white/40 px-3 mt-4">No recent queries</p> : (
              history.map((item, index) => (
                <motion.div key={index} whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setCurrentChat([{ role: 'user', content: item.query }, { role: 'ai', content: item.response }]); setIsSidebarOpen(false); }}
                  className="flex items-center gap-3 p-3 bg-transparent hover:bg-white/5 rounded-2xl cursor-pointer transition group"
                >
                  <MessageSquare size={16} className="text-white/40 group-hover:text-blue-400 flex-shrink-0" />
                  <span className="text-sm text-white/80 group-hover:text-white truncate">{item.query}</span>
                </motion.div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-white/10">
            <motion.button whileTap={{ scale: 0.95 }} onClick={async () => { await deleteChatHistory(); setHistory([]); setCurrentChat([]); }} className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-sm flex items-center justify-center gap-2 transition">
              <Trash2 size={16} /> Clear History
            </motion.button>
          </div>
        </motion.aside>

        {/* --- RIGHT DRAWER: SETTINGS --- */}
        <motion.aside 
          initial={false} animate={{ x: isSettingsOpen ? 0 : "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="absolute inset-y-0 right-0 w-80 bg-[#0a0f1d]/95 backdrop-blur-3xl border-l border-white/10 z-50 flex flex-col shadow-2xl"
        >
          <div className="p-5 border-b border-white/10 flex justify-between items-center">
            <h3 className="font-semibold text-base flex items-center gap-2 text-white"><Settings size={18} className="text-blue-400" /> Settings</h3>
            <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition"><X size={20} /></button>
          </div>
          <div className="p-5 overflow-y-auto space-y-6 flex-1">
            <div>
              <label className="text-[11px] font-semibold text-white/50 block mb-3 uppercase tracking-widest">Change City</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Search location..." value={locationSearchInput} onChange={(e) => setLocationSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none text-white focus:border-blue-500 transition" />
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleSearchLocation} className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition">Search</motion.button>
              </div>
              {locationResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-white/5 divide-y divide-white/10 mt-3">
                  {locationResults.map((loc, idx) => (
                    <button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-4 py-3 hover:bg-white/10 transition">
                      <div className="font-medium text-sm text-white truncate">{loc.name || loc.display_name.split(',')[0]}</div>
                      <div className="text-xs text-white/50 truncate mt-0.5">{loc.display_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-semibold text-white/50 block mb-3 uppercase tracking-widest">Response Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-blue-500">
                {INDIAN_LANGUAGES.map(lang => (<option key={lang.code} value={lang.code} className="bg-slate-900">{lang.name}</option>))}
              </select>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-white">Dark Theme Overlay</span>
              <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 bg-white/5 rounded-full hover:bg-white/10 transition">
                {darkMode ? <Sun size={18} className="text-yellow-400" /> : <Moon size={18} />}
              </button>
            </div>
          </div>
        </motion.aside>

        {/* --- MAIN INTERFACE AREA --- */}
        <main className="relative z-10 h-full flex flex-col overflow-hidden px-5 pt-12">
          
          {/* Header */}
          <header className="flex justify-between items-start mb-3 flex-shrink-0">
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
              <div className="flex items-center gap-1.5 text-blue-400 mb-0.5">
                <Sparkles size={14} className="animate-pulse" />
                <span className="text-[11px] font-bold tracking-widest uppercase">WeatherGPT</span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight flex items-center drop-shadow-md">
                {weather?.location || location.name} <MapPin size={15} className="ml-1.5 text-white/50" />
              </h1>
            </motion.div>
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full transition shadow-lg"><Menu size={17} /></motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setIsSettingsOpen(true)} className="p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full transition shadow-lg"><Settings size={17} /></motion.button>
            </div>
          </header>

          {/* --- PERSISTENT DISASTER ALERTS & DYNAMIC ADVISORY SECTION --- */}
          <div className="flex-shrink-0 mb-3 space-y-2">
            {weather?.alerts && weather.alerts.length > 0 ? (
              weather.alerts.map((alert, idx) => (
                <motion.div 
                  key={idx} 
                  initial={{ y: -8, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }}
                  className={`backdrop-blur-2xl border rounded-2xl p-3.5 shadow-xl transition-all ${
                    alert.severity === 'Extreme' 
                      ? 'bg-red-500/20 border-red-500/50 text-red-100' 
                      : 'bg-amber-500/20 border-amber-500/50 text-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center text-xs tracking-wider uppercase">
                      <AlertTriangle size={16} className={`mr-2 flex-shrink-0 ${alert.severity === 'Extreme' ? 'text-red-400 animate-pulse' : 'text-amber-400'}`} />
                      {alert.title}
                    </h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/10">
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs opacity-90 mt-1.5 ml-6 leading-relaxed">
                    {alert.description}
                  </p>
                  
                  {/* Actionable Disaster Advisory */}
                  <div className="mt-2.5 pt-2 border-t border-white/10 ml-6 flex items-start gap-1.5 text-[11px] font-medium opacity-85">
                    <ShieldAlert size={14} className="flex-shrink-0 mt-0.5 text-white/80" />
                    <span>
                      {alert.severity === 'Extreme' 
                        ? "Emergency Advisory: Halt non-essential transit, seek shelter in reinforced structures, and prepare power-loss contingencies."
                        : "Precautionary Advisory: Review local transit bulletins, secure external hardware, and prepare for rapid condition shifts."}
                    </span>
                  </div>
                </motion.div>
              ))
            ) : (
              /* Telemetry-Driven Microclimate Advisory (Shows when no disasters are active) */
              weather && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-md flex items-start gap-2.5"
                >
                  <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 mt-0.5 flex-shrink-0">
                    <Info size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider truncate">
                        {environmentalAdvisory.title}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full ${
                        environmentalAdvisory.badge === 'Attention' 
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40' 
                          : 'bg-white/10 text-white/70'
                      }`}>
                        {environmentalAdvisory.badge}
                      </span>
                    </div>
                    <p className="text-xs text-white/80 mt-1 leading-snug">
                      {environmentalAdvisory.text}
                    </p>
                  </div>
                </motion.div>
              )
            )}
          </div>

          {/* --- SCROLLABLE VIEWPORT: CHAT OR TELEMETRY DASHBOARD --- */}
          <div className="flex-1 overflow-y-auto scrollbar-hide pb-[180px]">
            {currentChat.length > 0 ? (
              <div className="space-y-4 pt-1">
                <AnimatePresence>
                  {currentChat.map((msg, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, y: 15, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-3xl p-5 shadow-2xl relative group ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-sm' : 'bg-[#0b1329]/80 backdrop-blur-2xl border border-white/10 text-white/95 rounded-bl-sm'}`}>
                        {msg.role === 'ai' ? (
                          <>
                            <div className="text-[15px] prose prose-invert max-w-none">
                              <ReactMarkdown components={{ p: ({node, ...props}) => <p className="mb-2.5 last:mb-0 leading-relaxed" {...props} />, ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2.5 space-y-1" {...props} /> }}>{msg.content}</ReactMarkdown>
                            </div>
                            <button onClick={() => handleCopy(msg.content, idx)} className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/60 hover:text-white transition">{copiedIndex === idx ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}</button>
                          </>
                        ) : ( <p className="text-[15px] font-medium leading-relaxed">{msg.content}</p> )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoadingAi && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="bg-[#0b1329]/80 backdrop-blur-2xl border border-white/10 rounded-3xl rounded-bl-sm p-4 flex items-center gap-3 shadow-lg"><Loader2 size={18} className="animate-spin text-blue-400" /> <span className="text-sm text-white/80 animate-pulse">Analyzing telemetry...</span></div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              /* DASHBOARD VIEW */
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full justify-between pb-4">
                
                <div className="flex-1 flex flex-col items-center justify-center my-3">
                  <motion.h2 initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 100 }} className="text-[8.5rem] leading-none font-extralight tracking-tighter drop-shadow-2xl">
                    {weather ? `${Math.round(weather.temperature)}°` : "--°"}
                  </motion.h2>
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-2xl font-light tracking-wide mt-2 opacity-90 drop-shadow-md">
                    {weather?.condition || "Loading..."}
                  </motion.p>
                </div>

                <div className="flex flex-col w-full">
                  {/* Quick Prompts */}
                  {!showDetailedMetrics && (
                    <div className="flex flex-wrap justify-center gap-2 mb-5">
                      {quickPrompts.map((prompt, idx) => (
                        <motion.button 
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 + 0.3 }}
                          onClick={() => handleSendQuery(prompt)}
                          className="bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 text-xs font-medium text-white/90 shadow-sm transition-colors"
                        >
                          {prompt}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Telemetry Toggle */}
                  <motion.button whileTap={{ scale: 0.98 }} onClick={() => setShowDetailedMetrics(!showDetailedMetrics)} className="w-full py-3 bg-black/30 hover:bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition-all">
                    {showDetailedMetrics ? 'Hide Metrics' : 'View Telemetry'}
                    {showDetailedMetrics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </motion.button>

                  <AnimatePresence>
                    {showDetailedMetrics && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 flex items-center justify-between shadow-lg">
                            <div className="flex flex-col z-10">
                              <span className="text-[11px] opacity-60 font-medium mb-1 tracking-wider uppercase">UV Index</span>
                              <span className="text-2xl font-semibold">{weather?.uv_index || '--'}</span>
                            </div>
                            <div className="-mr-2"><UVGauge value={weather?.uv_index || 1} /></div>
                          </div>
                          
                          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 flex items-center justify-between shadow-lg">
                            <div className="flex flex-col z-10">
                              <span className="text-[11px] opacity-60 font-medium mb-1 tracking-wider uppercase">Humidity</span>
                              <span className="text-2xl font-semibold">{weather?.humidity || '--'}%</span>
                            </div>
                            <div className="-mr-2"><HumidityGauge value={weather?.humidity || 50} /></div>
                          </div>

                          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 flex items-center justify-between shadow-lg">
                            <div className="flex flex-col z-10">
                              <span className="text-[11px] opacity-60 font-medium mb-1 tracking-wider uppercase">Real Feel</span>
                              <span className="text-2xl font-semibold">{weather?.feels_like || '--'}°</span>
                            </div>
                            <div className="-mr-2"><SpeedometerGauge value={weather?.feels_like || 25} /></div>
                          </div>

                          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-[1.5rem] p-4 flex items-center justify-between shadow-lg">
                            <div className="flex flex-col z-10">
                              <span className="text-[11px] opacity-60 font-medium mb-1 tracking-wider uppercase">Wind</span>
                              <span className="text-2xl font-semibold">{weather?.wind_speed || '--'}<span className="text-[10px] ml-1 opacity-50 font-normal">km/h</span></span>
                            </div>
                            <div className="-mr-2"><WindCompass /></div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </div>
        </main>

        {/* --- INPUT DOCK --- */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-5 pb-6 pt-12 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
          <div className="flex justify-center mb-3">
            <div className="flex items-center bg-black/40 backdrop-blur-2xl border border-white/10 rounded-full p-1 shadow-2xl">
              <button onClick={() => setAiMode('fast')} className={`px-4 py-1 rounded-full text-xs font-semibold transition-all ${aiMode === 'fast' ? 'bg-white text-black shadow-md' : 'text-white/60 hover:text-white'}`}>Fast</button>
              <button onClick={() => setAiMode('detailed')} className={`px-4 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${aiMode === 'detailed' ? 'bg-blue-600 text-white shadow-md' : 'text-white/60 hover:text-white'}`}>Detailed <Sparkles size={12} /></button>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSendQuery(); }} className="flex items-center bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[2rem] p-2 shadow-2xl focus-within:ring-2 focus-within:ring-blue-500/60 focus-within:border-transparent transition-all">
            <motion.button whileTap={{ scale: 0.9 }} type="button" onClick={() => setIsListening(!isListening)} className={`p-3.5 rounded-full transition-all flex-shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-black hover:bg-gray-200 shadow-md'}`}>
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </motion.button>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask WeatherGPT..." className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/50 px-4 text-sm font-medium" />
            <motion.button whileTap={{ scale: 0.9 }} type="submit" disabled={isLoadingAi || !query.trim()} className="p-3 text-white hover:text-blue-400 transition-colors flex-shrink-0 pr-3 disabled:opacity-30">
              {isLoadingAi ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </motion.button>
          </form>
        </div>

      </motion.div>
    </div>
  );
}