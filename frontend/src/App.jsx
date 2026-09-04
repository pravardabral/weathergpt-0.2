import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, Settings, MapPin, Mic, MicOff, Send, Sun, Moon, SunDim,
  Wind, Droplets, AlertTriangle, X, Trash2, Sparkles, Loader2, 
  PlusCircle, MessageSquare, ChevronDown, ChevronUp, Copy, Check,
  Info, ShieldAlert, CloudLightning
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { fetchCurrentWeather, sendWeatherQuery, getChatHistory, deleteChatHistory, bootstrapUser } from './services/api';

const INDIAN_LANGUAGES = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "te", name: "తెలుగు (Telugu)" }
];

// --- TELEMETRY-BASED ADVISORY ENGINE ---
const generateWeatherAdvisory = (weather) => {
  if (!weather) return { title: "Telemetry Syncing", text: "Synchronizing localized data...", badge: "Updating" };
  const advisories = [];
  const uv = weather.uv_index || 0; const wind = weather.wind_speed || 0;
  const temp = weather.temperature || 0; const humidity = weather.humidity || 0;
  const condition = (weather.condition || "").toLowerCase();

  if (uv >= 8) advisories.push("Very high UV: apply SPF 30+ and limit sun exposure.");
  else if (uv >= 6) advisories.push("Moderate UV: wear protective eyewear outdoors.");
  if (wind >= 35) advisories.push(`Strong winds (${wind} km/h): secure outdoor fixtures.`);
  if (condition.includes("rain") || condition.includes("shower")) advisories.push("Precipitation active: wet roadways expected.");
  if (temp >= 35) advisories.push("Elevated temperatures: maintain hydration.");
  
  if (advisories.length === 0) return { title: "Environmental Advisory", text: "Optimal atmospheric parameters.", badge: "Normal" };
  return { title: "Environmental Advisory", text: advisories.slice(0, 2).join(" "), badge: (uv >= 6 || temp >= 35 || wind >= 35) ? "Attention" : "Info" };
};

// --- ANIMATED GAUGES ---
const UVGauge = ({ value }) => {
  const percent = Math.min(value / 11, 1);
  return (
    <div className="relative w-[72px] h-[72px]">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <defs>
          <linearGradient id="uvGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4ade80" /><stop offset="50%" stopColor="#eab308" /><stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="url(#uvGrad)" strokeWidth="8" strokeLinecap="round" />
      </svg>
      <motion.div className="absolute inset-0 origin-center" initial={{ rotate: -135 }} animate={{ rotate: percent * 270 - 135 }} transition={{ type: "spring", stiffness: 60 }}>
        <div className="w-3 h-3 bg-white border-[3px] border-zinc-800 rounded-full absolute top-[5px] left-1/2 -translate-x-1/2 shadow-sm" />
      </motion.div>
    </div>
  );
};

const HumidityGauge = ({ value }) => (
  <div className="relative w-[72px] h-[72px]">
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
      <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="rgba(100,150,255,0.2)" strokeWidth="8" strokeLinecap="round" />
      <motion.path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="#3b82f6" strokeWidth="8" strokeLinecap="round" strokeDasharray="188.5" initial={{ strokeDashoffset: 188.5 }} animate={{ strokeDashoffset: 188.5 * (1 - (value / 100)) }} transition={{ duration: 1.2 }} />
    </svg>
    <div className="absolute inset-0 flex items-center justify-center text-blue-400 mt-1"><Droplets size={24} fill="currentColor" fillOpacity={0.2} /></div>
  </div>
);

const SpeedometerGauge = ({ value }) => {
  const percent = Math.max(0, Math.min((value) / 50, 1));
  return (
    <div className="relative w-[72px] h-[72px]">
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" strokeLinecap="round" />
        <motion.path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="#eab308" strokeWidth="8" strokeLinecap="round" strokeDasharray="188.5" initial={{ strokeDashoffset: 188.5 }} animate={{ strokeDashoffset: 188.5 * (1 - percent) }} transition={{ duration: 1.2 }} />
      </svg>
      <motion.div className="absolute inset-0 origin-center flex flex-col items-center pt-[14px]" initial={{ rotate: -135 }} animate={{ rotate: percent * 270 - 135 }} transition={{ type: "spring", stiffness: 60 }}>
        <div className="w-[3px] h-[18px] bg-white rounded-full shadow-md" /><div className="w-2.5 h-2.5 bg-white rounded-full absolute top-[31px]" />
      </motion.div>
    </div>
  );
};

const WindCompass = () => (
  <div className="relative w-[72px] h-[72px]">
    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
      <circle cx="50" cy="50" r="35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="2 4" />
      <text x="50" y="12" fill="currentColor" fontSize="12" textAnchor="middle" className="font-bold opacity-60">N</text>
    </svg>
    <motion.div className="absolute inset-0 flex items-center justify-center origin-center" animate={{ rotate: 45 }} transition={{ duration: 1.5 }}>
      <svg viewBox="0 0 24 24" className="w-7 h-7 text-blue-400 drop-shadow-lg"><polygon points="12,2 19,21 12,17 5,21" fill="currentColor" /></svg>
    </motion.div>
  </div>
);

// --- MICRO-CARD COMPONENT ---
const WeatherMicroCard = ({ data, theme }) => (
  <div className={`mt-2 p-4 rounded-2xl flex items-center justify-between ${theme.cardBg} ${theme.border} shadow-sm`}>
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-full ${theme.iconBg}`}><CloudLightning size={24} className={theme.iconText} /></div>
      <div>
        <h4 className="text-xl font-bold tracking-tight">{data.temp}°C</h4>
        <p className={`text-xs font-medium uppercase tracking-wider ${theme.mutedText}`}>{data.location}</p>
      </div>
    </div>
    <div className="text-right">
      <div className="text-sm font-semibold">{data.condition}</div>
      <div className={`text-xs ${theme.mutedText}`}>UV: {data.uv} | AQI: {data.aqi}</div>
    </div>
  </div>
);

// --- SKELETON LOADER ---
const SkeletonLoader = ({ theme }) => (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start w-full">
    <div className={`w-[88%] rounded-3xl rounded-bl-sm p-5 space-y-4 shadow-lg ${theme.bubbleAI}`}>
      <div className="flex items-center gap-3 mb-4"><div className={`w-8 h-8 rounded-full animate-pulse ${theme.skeleton}`} /><div className={`h-4 w-24 rounded animate-pulse ${theme.skeleton}`} /></div>
      <div className="space-y-2.5"><div className={`h-3 w-full rounded animate-pulse ${theme.skeleton}`} /><div className={`h-3 w-5/6 rounded animate-pulse ${theme.skeleton}`} /></div>
    </div>
  </motion.div>
);

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHighContrast, setIsHighContrast] = useState(false);
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
  const onTouchStart = (e) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) { if (isSidebarOpen) setIsSidebarOpen(false); else if (!isSettingsOpen) setIsSettingsOpen(true); }
    if (distance < -minSwipeDistance) { if (isSettingsOpen) setIsSettingsOpen(false); else if (!isSidebarOpen) setIsSidebarOpen(true); }
  };

  const theme = {
    appBg: isHighContrast ? 'bg-white' : 'bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-zinc-900', // Minimalist Background
    text: isHighContrast ? 'text-black' : 'text-white',
    mutedText: isHighContrast ? 'text-gray-600' : 'text-white/60',
    border: isHighContrast ? 'border-2 border-black' : 'border border-white/10',
    panelBg: isHighContrast ? 'bg-white border-l-2 border-black' : 'bg-[#0a0f1d]/95 backdrop-blur-3xl border-white/10',
    bubbleUser: isHighContrast ? 'bg-black text-white rounded-br-sm' : 'bg-blue-600 text-white rounded-br-sm',
    bubbleAI: isHighContrast ? 'bg-gray-50 border-2 border-black text-black rounded-bl-sm' : 'bg-[#0b1329]/80 backdrop-blur-2xl border border-white/10 text-white/95 rounded-bl-sm',
    cardBg: isHighContrast ? 'bg-white' : 'bg-white/5',
    iconBg: isHighContrast ? 'bg-black' : 'bg-blue-500/20',
    iconText: isHighContrast ? 'text-white' : 'text-blue-400',
    skeleton: isHighContrast ? 'bg-gray-300' : 'bg-white/10',
    inputDock: isHighContrast ? 'bg-white border-t-2 border-black' : 'bg-gradient-to-t from-black/95 via-black/60 to-transparent',
    metricBox: isHighContrast ? 'bg-gray-100 border-2 border-black' : 'bg-white/5 backdrop-blur-xl border border-white/10'
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const bootstrapData = await bootstrapUser();
        if (bootstrapData.chat_history?.length > 0) setHistory(bootstrapData.chat_history);
        if (bootstrapData.saved_location) { setLocation(bootstrapData.saved_location); setIsLocating(false); return; }
      } catch (err) {}
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude; const lon = pos.coords.longitude;
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
              const data = await res.json();
              setLocation({ name: data.address?.city || data.address?.town || "Dehradun", lat, lon });
            } catch { setLocation({ name: "Dehradun", lat, lon }); } 
            finally { setIsLocating(false); }
          },
          () => { setLocation({ name: "Dehradun", lat: 30.3165, lon: 78.0322 }); setIsLocating(false); }, { enableHighAccuracy: true, timeout: 5000 }
        );
      } else { setLocation({ name: "Dehradun", lat: 30.3165, lon: 78.0322 }); setIsLocating(false); }
    };
    initializeApp();
  }, []);

  useEffect(() => { if (!isLocating && location.lat && location.lon) loadWeatherData(); }, [location, isLocating]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [currentChat, isLoadingAi]);

  const loadWeatherData = async () => {
    try { const res = await fetchCurrentWeather(location.lat, location.lon, location.name); setWeather(res.data); } 
    catch (err) { console.error(err); }
  };

  const handleSearchLocation = async () => {
    if (!locationSearchInput.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationSearchInput)}&format=json&limit=5`);
      setLocationResults(await res.json() || []);
    } catch { setLocationResults([]); }
  };

  const handleSelectLocation = (loc) => {
    setLocation({ name: loc.name || loc.display_name.split(',')[0], lat: parseFloat(loc.lat), lon: parseFloat(loc.lon) });
    setIsSettingsOpen(false); setLocationSearchInput(""); setLocationResults([]);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text); setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSendQuery = async (userPrompt = query) => {
    const activeText = userPrompt.trim();
    if (!activeText || isLoadingAi) return;
    setIsLoadingAi(true); setQuery("");
    setCurrentChat(prev => [...prev, { role: 'user', content: activeText }]);

    try {
      const res = await sendWeatherQuery({ query: activeText, latitude: location.lat, longitude: location.lon, location_name: location.name, language: language, mode: aiMode });
      if (res.response.toLowerCase().includes("extreme alert") && navigator.vibrate) navigator.vibrate([200, 100, 200]); 
      setCurrentChat(prev => [...prev, { role: 'ai', content: res.response }]);
      const updatedHistory = await getChatHistory(); setHistory(updatedHistory.history || []);
    } catch { setCurrentChat(prev => [...prev, { role: 'ai', content: "Backend unreachable." }]); } 
    finally { setIsLoadingAi(false); }
  };

  const renderMessageContent = (content) => {
    const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/({[\s\S]*"type"\s*:\s*"weather_card"[\s\S]*})/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        if (parsed.type === 'weather_card') {
          const textWithoutJson = content.replace(jsonMatch[0], '').trim();
          return (
            <>
              {textWithoutJson && <ReactMarkdown className="mb-3 prose prose-sm">{textWithoutJson}</ReactMarkdown>}
              <WeatherMicroCard data={parsed} theme={theme} />
            </>
          );
        }
      } catch (e) {}
    }
    return <ReactMarkdown components={{ p: ({node, ...props}) => <p className="mb-2.5 last:mb-0 leading-relaxed" {...props} />, ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2.5 space-y-1" {...props} /> }}>{content}</ReactMarkdown>;
  };

  const environmentalAdvisory = generateWeatherAdvisory(weather);
  const quickPrompts = [`Weather in ${location.name}?`, "Will it rain tomorrow?", "Is it safe for outdoor travel?"];

  return (
    <div className={`min-h-screen w-full flex items-center justify-center font-sans select-none ${isHighContrast ? 'bg-gray-100' : 'bg-black'}`}>
      <motion.div 
        layout onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        className={`relative w-full h-screen sm:h-[860px] sm:w-[410px] sm:rounded-[3rem] shadow-2xl overflow-hidden transition-all duration-300 ${theme.appBg} ${theme.text}`}
      >
        <AnimatePresence>
          {(isSidebarOpen || isSettingsOpen) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setIsSidebarOpen(false); setIsSettingsOpen(false); }} className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 cursor-pointer" />
          )}
        </AnimatePresence>

        {/* --- LEFT DRAWER: HISTORY --- */}
        <motion.aside initial={false} animate={{ x: isSidebarOpen ? 0 : "-100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={`absolute inset-y-0 left-0 w-72 z-50 flex flex-col shadow-2xl ${theme.panelBg}`}>
          <div className="p-5 flex justify-between items-center">
            <button onClick={() => { setCurrentChat([]); setIsSidebarOpen(false); }} className={`flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 ${theme.cardBg} ${theme.border}`}>
              <PlusCircle size={18} className={theme.iconText} /> New Chat
            </button>
            <button onClick={() => setIsSidebarOpen(false)} className="ml-3 p-2 rounded-full hover:bg-black/10"><X size={20} /></button>
          </div>
          <div className="px-5 pb-2 text-[11px] font-bold uppercase tracking-widest opacity-50">Recent Chats</div>
          <div className="flex-1 overflow-y-auto px-3 space-y-1.5 scrollbar-hide pb-16">
            {history.length === 0 ? <p className="text-sm opacity-50 px-3 mt-4">No recent queries</p> : (
              history.map((item, index) => (
                <div key={index} onClick={() => { setCurrentChat([{ role: 'user', content: item.query }, { role: 'ai', content: item.response }]); setIsSidebarOpen(false); }} className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer ${theme.cardBg} hover:opacity-80`}>
                  <MessageSquare size={16} className={`flex-shrink-0 ${theme.iconText}`} />
                  <span className="text-sm truncate">{item.query}</span>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-gray-500/20">
            <button onClick={async () => { await deleteChatHistory(); setHistory([]); setCurrentChat([]); }} className="w-full py-3 bg-red-500/10 text-red-500 rounded-2xl text-sm font-bold flex items-center justify-center gap-2">
              <Trash2 size={16} /> Clear History
            </button>
          </div>
        </motion.aside>

        {/* --- RIGHT DRAWER: SETTINGS --- */}
        <motion.aside initial={false} animate={{ x: isSettingsOpen ? 0 : "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }} className={`absolute inset-y-0 right-0 w-80 z-50 flex flex-col shadow-2xl ${theme.panelBg}`}>
          <div className="p-5 border-b border-gray-500/20 flex justify-between items-center">
            <h3 className="font-bold text-base flex items-center gap-2"><Settings size={18} className={theme.iconText} /> Settings</h3>
            <button onClick={() => setIsSettingsOpen(false)} className="p-2 rounded-full hover:bg-black/10"><X size={20} /></button>
          </div>
          <div className="p-5 overflow-y-auto space-y-6 flex-1">
            <div>
              <label className="text-[11px] font-bold opacity-50 block mb-3 uppercase tracking-widest">Change City</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Search location..." value={locationSearchInput} onChange={(e) => setLocationSearchInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} className={`flex-1 rounded-xl px-4 py-2.5 text-sm outline-none ${theme.cardBg} ${theme.border}`} />
                <button onClick={handleSearchLocation} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold">Search</button>
              </div>
              {locationResults.length > 0 && (
                <div className={`max-h-48 overflow-y-auto rounded-xl mt-3 ${theme.cardBg} ${theme.border}`}>
                  {locationResults.map((loc, idx) => (
                    <button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-4 py-3 hover:bg-black/5 border-b border-gray-500/10 last:border-0">
                      <div className="font-bold text-sm truncate">{loc.name || loc.display_name.split(',')[0]}</div>
                      <div className="text-xs opacity-50 truncate mt-0.5">{loc.display_name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-[11px] font-bold opacity-50 block mb-3 uppercase tracking-widest">Response Language</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`w-full rounded-xl py-3 px-4 text-sm outline-none ${theme.cardBg} ${theme.border}`}>
                {INDIAN_LANGUAGES.map(lang => (<option key={lang.code} value={lang.code} className="bg-slate-900 text-white">{lang.name}</option>))}
              </select>
            </div>
            <div className={`flex justify-between items-center p-3 rounded-xl ${theme.cardBg} ${theme.border}`}>
              <span className="text-sm font-bold flex items-center gap-2"><SunDim size={16}/> High Contrast</span>
              <input type="checkbox" checked={isHighContrast} onChange={() => setIsHighContrast(!isHighContrast)} className="w-5 h-5 accent-black" />
            </div>
          </div>
        </motion.aside>

        {/* --- MAIN UI --- */}
        <main className="relative z-10 h-full flex flex-col px-5 pt-12">
          
          <header className="flex justify-between items-start mb-3 flex-shrink-0">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 text-blue-500 mb-0.5">
                <Sparkles size={14} className="animate-pulse" /> <span className="text-[11px] font-bold tracking-widest uppercase">WeatherGPT</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight flex items-center">
                {weather?.location || location.name} <MapPin size={15} className={`ml-1.5 ${theme.mutedText}`} />
              </h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsSidebarOpen(true)} className={`p-2.5 rounded-full shadow-sm ${theme.cardBg} ${theme.border}`}><Menu size={17} /></button>
              <button onClick={() => setIsSettingsOpen(true)} className={`p-2.5 rounded-full shadow-sm ${theme.cardBg} ${theme.border}`}><Settings size={17} /></button>
            </div>
          </header>

          {/* DISASTERS & ADVISORIES */}
          <div className="flex-shrink-0 mb-3 space-y-2">
            {weather?.alerts?.length > 0 ? (
              weather.alerts.map((alert, idx) => (
                <div key={idx} className={`border rounded-2xl p-3.5 shadow-xl ${alert.severity === 'Extreme' ? 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400' : 'bg-amber-500/10 border-amber-500/50 text-amber-600 dark:text-amber-400'}`}>
                  <h3 className="font-bold flex items-center text-xs tracking-wider uppercase">
                    <AlertTriangle size={16} className="mr-2" /> {alert.title}
                  </h3>
                  <p className="text-xs mt-1.5 font-medium">{alert.description}</p>
                  <div className="mt-2.5 pt-2 border-t border-current/20 flex items-start gap-1.5 text-[11px] font-bold">
                    <ShieldAlert size={14} />
                    <span>{alert.severity === 'Extreme' ? "Halt transit and seek reinforced shelter immediately." : "Review local bulletins and prepare for changes."}</span>
                  </div>
                </div>
              ))
            ) : (
              weather && (
                <div className={`rounded-2xl p-3 flex items-start gap-2.5 ${theme.cardBg} ${theme.border}`}>
                  <div className={`p-1.5 rounded-xl flex-shrink-0 ${theme.iconBg}`}><Info size={15} className={theme.iconText} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider truncate">{environmentalAdvisory.title}</span>
                    </div>
                    <p className={`text-xs mt-1 leading-snug font-medium ${theme.mutedText}`}>{environmentalAdvisory.text}</p>
                  </div>
                </div>
              )
            )}
          </div>

          {/* SCROLLABLE VIEWPORT */}
          <div className="flex-1 overflow-y-auto scrollbar-hide pb-[180px] pt-1">
            {currentChat.length > 0 ? (
              <div className="space-y-4">
                <AnimatePresence>
                  {currentChat.map((msg, idx) => (
                    <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] p-5 shadow-xl relative group ${msg.role === 'user' ? theme.bubbleUser : theme.bubbleAI}`}>
                        {msg.role === 'ai' ? (
                          <>
                            <div className="text-[15px] prose dark:prose-invert max-w-none">{renderMessageContent(msg.content)}</div>
                            <button onClick={() => handleCopy(msg.content, idx)} className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-black/10 transition">
                              {copiedIndex === idx ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                          </>
                        ) : ( <p className="text-[15px] font-medium">{msg.content}</p> )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {isLoadingAi && <SkeletonLoader theme={theme} />}
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full justify-between pb-4">
                <div className="flex-1 flex flex-col items-center justify-center my-3">
                  <h2 className="text-[8.5rem] leading-none font-extralight tracking-tighter drop-shadow-md">
                    {weather ? `${Math.round(weather.temperature)}°` : "--°"}
                  </h2>
                  <p className={`text-2xl font-bold tracking-wide mt-2 ${theme.mutedText}`}>
                    {weather?.condition || "Loading..."}
                  </p>
                </div>

                <div className="flex flex-col w-full">
                  {!showDetailedMetrics && (
                    <div className="flex flex-wrap justify-center gap-2 mb-5">
                      {quickPrompts.map((prompt, idx) => (
                        <button key={idx} onClick={() => handleSendQuery(prompt)} className={`rounded-full px-4 py-2 text-xs font-bold shadow-sm ${theme.cardBg} ${theme.border}`}>
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}

                  <button onClick={() => setShowDetailedMetrics(!showDetailedMetrics)} className={`w-full py-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider ${theme.cardBg} ${theme.border}`}>
                    {showDetailedMetrics ? 'Hide Metrics' : 'View Telemetry'}
                    {showDetailedMetrics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  <AnimatePresence>
                    {showDetailedMetrics && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className={`rounded-[1.5rem] p-4 flex items-center justify-between shadow-sm ${theme.metricBox}`}>
                            <div className="flex flex-col z-10"><span className={`text-[11px] font-bold uppercase ${theme.mutedText}`}>UV Index</span><span className="text-2xl font-bold mt-1">{weather?.uv_index || '--'}</span></div>
                            <div className="-mr-2"><UVGauge value={weather?.uv_index || 1} /></div>
                          </div>
                          <div className={`rounded-[1.5rem] p-4 flex items-center justify-between shadow-sm ${theme.metricBox}`}>
                            <div className="flex flex-col z-10"><span className={`text-[11px] font-bold uppercase ${theme.mutedText}`}>Humidity</span><span className="text-2xl font-bold mt-1">{weather?.humidity || '--'}%</span></div>
                            <div className="-mr-2"><HumidityGauge value={weather?.humidity || 50} /></div>
                          </div>
                          <div className={`rounded-[1.5rem] p-4 flex items-center justify-between shadow-sm ${theme.metricBox}`}>
                            <div className="flex flex-col z-10"><span className={`text-[11px] font-bold uppercase ${theme.mutedText}`}>Real Feel</span><span className="text-2xl font-bold mt-1">{weather?.feels_like || '--'}°</span></div>
                            <div className="-mr-2"><SpeedometerGauge value={weather?.feels_like || 25} /></div>
                          </div>
                          <div className={`rounded-[1.5rem] p-4 flex items-center justify-between shadow-sm ${theme.metricBox}`}>
                            <div className="flex flex-col z-10"><span className={`text-[11px] font-bold uppercase ${theme.mutedText}`}>Wind</span><span className="text-2xl font-bold mt-1">{weather?.wind_speed || '--'}<span className="text-[10px] ml-1 font-normal">km/h</span></span></div>
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
        <div className={`absolute bottom-0 left-0 right-0 z-30 px-5 pb-6 pt-12 ${theme.inputDock}`}>
          <div className="flex justify-center mb-3">
            <div className={`flex items-center rounded-full p-1 shadow-sm ${theme.cardBg} ${theme.border}`}>
              <button onClick={() => setAiMode('fast')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all ${aiMode === 'fast' ? (isHighContrast ? 'bg-black text-white' : 'bg-white text-black') : theme.mutedText}`}>Fast</button>
              <button onClick={() => setAiMode('detailed')} className={`px-4 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${aiMode === 'detailed' ? 'bg-blue-600 text-white' : theme.mutedText}`}>Detailed <Sparkles size={12} /></button>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleSendQuery(); }} className={`flex items-center rounded-[2rem] p-2 shadow-2xl focus-within:ring-2 focus-within:ring-blue-500 transition-all ${theme.cardBg} ${theme.border}`}>
            <button type="button" onClick={() => setIsListening(!isListening)} className={`p-3.5 rounded-full flex-shrink-0 ${isListening ? 'bg-red-500 text-white animate-pulse' : (isHighContrast ? 'bg-black text-white' : 'bg-white text-black')}`}>
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask WeatherGPT..." className={`flex-1 bg-transparent border-none outline-none px-4 text-sm font-bold ${isHighContrast ? 'text-black placeholder-gray-500' : 'text-white placeholder-white/50'}`} />
            <button type="submit" disabled={isLoadingAi || !query.trim()} className={`p-3 flex-shrink-0 pr-3 disabled:opacity-30 ${isHighContrast ? 'text-black' : 'text-white hover:text-blue-400'}`}>
              {isLoadingAi ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </form>
        </div>

      </motion.div>
    </div>
  );
}