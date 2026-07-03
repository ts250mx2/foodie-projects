'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Mic, MicOff, Volume2, VolumeX, Repeat, X, Send, Play, ChevronDown, ChevronUp, ChefHat } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AgentChart from '@/components/dashboard/AgentChart';
import { NavButtons } from '@/components/dashboard/AiAgent';

// Evita mostrar bloques ```chart o ```nav incompletos mientras streamean en JSON
function hideIncompleteFence(text: string): string {
    const fences = (text.match(/```/g) || []).length;
    if (fences % 2 === 0) return text;          // todo cerrado
    const idx = text.lastIndexOf('```');
    return text.slice(0, idx).trimEnd();
}

// ---- Tipos del Web Speech API ----
interface SpeechResultAlt { transcript: string }
interface SpeechResult { 0: SpeechResultAlt; isFinal: boolean; length: number }
interface SpeechRecognitionEventLike { results: ArrayLike<SpeechResult>; resultIndex: number }
interface SpeechRecognitionLike {
    lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
    start(): void; stop(): void; abort(): void;
    onresult: ((e: SpeechRecognitionEventLike) => void) | null;
    onend: (() => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type Status = 'idle' | 'listening' | 'thinking' | 'speaking';
type Msg = { role: 'user' | 'assistant'; content: string };

const STATUS_LABEL: Record<Status, string> = {
    idle: 'Listo para escucharte',
    listening: 'Escuchando tu voz…',
    thinking: 'Procesando consulta…',
    speaking: 'Foodie respondiendo…',
};

function cleanForSpeech(md: string): string {
    return (md || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/^\s*#{1,6}\s*/gm, '')
        .replace(/(\*\*|__|[*_])/g, '')
        .replace(/(\$)\s*([0-9]+)/g, '$2 pesos') 
        .replace(/^\s*\|.*\|\s*$/gm, '')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/\n{2,}/g, '. ')
        .replace(/\s+/g, ' ')
        .trim();
}

function readContext() {
    if (typeof window === 'undefined') return { ctx: {}, projectId: undefined as number | undefined };
    try {
        const project = JSON.parse(localStorage.getItem('project') || '{}');
        const branchId = localStorage.getItem('dashboardSelectedBranch') || '';
        const now = new Date();
        const ctx = { project, branchId, todayMonth: now.getMonth() + 1, todayYear: now.getFullYear() };
        return { ctx, projectId: project?.idProyecto || project?.IdProyecto };
    } catch {
        return { ctx: {}, projectId: undefined };
    }
}

function generateParticles(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.8,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 8,
        opacity: Math.random() * 0.35 + 0.1,
    }));
}

const EQ_BARS = Array.from({ length: 20 }, (_, i) => {
    const center = 10;
    const dist = Math.abs(i - center);
    const maxH = Math.max(5, 28 - dist * 2.2);
    return { id: i, maxH, delay: (i * 0.05).toFixed(2), hue: 190 + i * 5 };
});

export default function JarvisPage() {
    const params = useParams();
    const router = useRouter();
    const locale = params.locale as string;

    const [supported, setSupported] = useState(true);
    const [status, setStatus] = useState<Status>('idle');
    const [interim, setInterim] = useState('');
    const [userText, setUserText] = useState('');
    const [answer, setAnswer] = useState('');
    const [muted, setMuted] = useState(false);
    const [conversation, setConversation] = useState(false);
    const [typed, setTyped] = useState('');

    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
    const [speed, setSpeed] = useState<number>(1.03);
    const [pitch, setPitch] = useState<number>(1.0);
    const [voicePanelOpen, setVoicePanelOpen] = useState(false);

    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const messagesRef = useRef<Msg[]>([]);
    const conversationRef = useRef(false);
    const mutedRef = useRef(false);
    const statusRef = useRef<Status>('idle');
    const askAgentRef = useRef<(q: string) => void>(() => {});
    const chatEndRef = useRef<HTMLDivElement | null>(null);

    const particles = useMemo(() => generateParticles(35), []);

    const onNavigate = useCallback((path: string) => {
        router.push(path);
    }, [router]);

    const mdComponents = useMemo(() => ({
        pre({ children }: any) {
            const child = Array.isArray(children) ? children[0] : children;
            const cls: string = child?.props?.className || '';
            const kids = child?.props?.children;
            const raw = (Array.isArray(kids) ? kids.join('') : String(kids ?? '')).replace(/\n$/, '');
            if (cls.includes('language-chart')) return <AgentChart json={raw} />;
            if (cls.includes('language-nav')) return <NavButtons json={raw} onNavigate={onNavigate} />;
            return <pre>{children}</pre>;
        },
    }), [onNavigate]);

    useEffect(() => { conversationRef.current = conversation; }, [conversation]);
    useEffect(() => { mutedRef.current = muted; }, [muted]);

    const setPhase = useCallback((s: Status) => { statusRef.current = s; setStatus(s); }, []);

    const startListening = useCallback(() => {
        const rec = recognitionRef.current;
        if (!rec) return;
        window.speechSynthesis?.cancel();
        setAnswer(''); setUserText(''); setInterim('');
        try { setPhase('listening'); rec.start(); } catch { /* ignore */ }
    }, [setPhase]);

    const stopListening = useCallback(() => {
        try { recognitionRef.current?.stop(); } catch { /* ignore */ }
        setPhase('idle');
    }, [setPhase]);

    const afterSpeak = useCallback(() => {
        setPhase('idle');
        if (conversationRef.current) {
            setTimeout(() => { if (conversationRef.current) startListening(); }, 500);
        }
    }, [setPhase, startListening]);

    const speak = useCallback((text: string) => {
        const clean = cleanForSpeech(text);
        if (!clean || mutedRef.current || typeof window === 'undefined' || !window.speechSynthesis) {
            afterSpeak(); return;
        }
        const u = new SpeechSynthesisUtterance(clean);
        const activeVoices = window.speechSynthesis.getVoices();
        const voice = activeVoices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) { u.voice = voice; u.lang = voice.lang; }
        else {
            const esVoice = activeVoices.find(v => /es(-|_)MX/i.test(v.lang)) || activeVoices.find(v => v.lang?.toLowerCase().startsWith('es'));
            if (esVoice) { u.voice = esVoice; u.lang = esVoice.lang; }
        }
        u.rate = speed; u.pitch = pitch;
        u.onend = afterSpeak; u.onerror = afterSpeak;
        setPhase('speaking');
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    }, [afterSpeak, setPhase, selectedVoiceURI, speed, pitch]);

    const askAgent = useCallback(async (question: string) => {
        setUserText(question); setInterim(''); setAnswer('');
        setPhase('thinking');
        const { ctx, projectId } = readContext();
        messagesRef.current = [...messagesRef.current, { role: 'user', content: question }];

        let streamed = '';
        try {
            const res = await fetch('/api/ai/chat?stream=true', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messagesRef.current,
                    model: 'claude-sonnet-4-6',
                    context: { ...ctx, currentPage: '/dashboard/agente/jarvis' },
                    projectId,
                }),
            });
            if (!res.ok || !res.body) throw new Error('No se pudo conectar con el agente.');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let stop = false;
            while (!stop) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const frames = buffer.split('\n\n');
                buffer = frames.pop() || '';
                for (const frame of frames) {
                    const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
                    if (!dataLine) continue;
                    let evt: { type: string; delta?: string; content?: string; question?: string; message?: string };
                    try { evt = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
                    if (evt.type === 'text') { streamed += evt.delta || ''; setAnswer(streamed); }
                    else if (evt.type === 'reset') { streamed = ''; setAnswer(''); }
                    else if (evt.type === 'clarification') { streamed = evt.question || ''; setAnswer(streamed); }
                    else if (evt.type === 'done') { streamed = streamed || evt.content || ''; stop = true; }
                    else if (evt.type === 'error') { streamed = `Lo siento, ocurrió un error: ${evt.message || 'desconocido'}`; stop = true; }
                }
            }
            const finalText = streamed.trim();
            messagesRef.current = [...messagesRef.current, { role: 'assistant', content: finalText }];
            setAnswer(finalText);
            speak(finalText);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            setAnswer(`Error: ${msg}`);
            speak(`Lo siento, ocurrió un error.`);
        }
    }, [setPhase, speak]);

    useEffect(() => { askAgentRef.current = askAgent; }, [askAgent]);

    const loadVoices = useCallback(() => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        const allVoices = window.speechSynthesis.getVoices();
        const filtered = allVoices.filter(v => /es|en/i.test(v.lang));
        setVoices(filtered);

        const savedVoice = localStorage.getItem('jarvis_voice_uri');
        if (savedVoice) { setSelectedVoiceURI(savedVoice); }
        else {
            const defaultEs = allVoices.find(v => /es(-|_)MX/i.test(v.lang) && /google/i.test(v.name))
                || allVoices.find(v => /es(-|_)MX/i.test(v.lang))
                || allVoices.find(v => v.lang?.toLowerCase().startsWith('es'));
            if (defaultEs) setSelectedVoiceURI(defaultEs.voiceURI);
        }
        const savedSpeed = localStorage.getItem('jarvis_voice_speed');
        if (savedSpeed) setSpeed(parseFloat(savedSpeed));
        const savedPitch = localStorage.getItem('jarvis_voice_pitch');
        if (savedPitch) setPitch(parseFloat(savedPitch));
    }, []);

    useEffect(() => {
        const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
        const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
        if (!Ctor) { setSupported(false); return; }

        const rec = new Ctor();
        rec.lang = 'es-MX'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
        rec.onresult = (e) => {
            let finalText = '', interimText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) finalText += r[0].transcript;
                else interimText += r[0].transcript;
            }
            setInterim(interimText);
            if (finalText.trim()) { setInterim(''); askAgentRef.current(finalText.trim()); }
        };
        rec.onend = () => { if (statusRef.current === 'listening') { statusRef.current = 'idle'; setStatus('idle'); } };
        rec.onerror = () => { if (statusRef.current === 'listening') { statusRef.current = 'idle'; setStatus('idle'); } };
        recognitionRef.current = rec;
        loadVoices();
        if (window.speechSynthesis) { window.speechSynthesis.onvoiceschanged = loadVoices; }
        return () => { try { rec.abort(); } catch { /* ignore */ } window.speechSynthesis?.cancel(); };
    }, [loadVoices]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [answer, userText, interim]);

    // Lock body and html scrolling, and reset window scroll position to prevent keyboard/focus shifts
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const originalBodyStyle = document.body.style.overflow;
        const originalHtmlStyle = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        const handleScroll = () => {
            window.scrollTo(0, 0);
        };
        window.addEventListener('scroll', handleScroll);
        
        return () => {
            document.body.style.overflow = originalBodyStyle;
            document.documentElement.style.overflow = originalHtmlStyle;
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const sortedVoices = useMemo(() => {
        const maleKeywords = ['alvaro', 'jorge', 'julio', 'luis', 'jose', 'miguel', 'enrique', 'juan', 'mateo', 'diego', 'everardo', 'male', 'masculino', 'hombre', 'david', 'gerardo', 'carlos'];
        return [...voices].sort((a, b) => {
            const aL = a.lang.toLowerCase(), bL = b.lang.toLowerCase();
            const aN = a.name.toLowerCase(), bN = b.name.toLowerCase();
            const aLatAm = aL.startsWith('es') && !aL.includes('es-es');
            const bLatAm = bL.startsWith('es') && !bL.includes('es-es');
            const aNat = aN.includes('natural') || aN.includes('neural') || aN.includes('google') || aN.includes('online');
            const bNat = bN.includes('natural') || bN.includes('neural') || bN.includes('google') || bN.includes('online');
            const aIsMale = maleKeywords.some(keyword => aN.includes(keyword));
            const bIsMale = maleKeywords.some(keyword => bN.includes(keyword));
            
            let aW = 0, bW = 0;
            if (aL.startsWith('es')) { 
                aW += 100; 
                if (aLatAm) aW += 50; 
                if (aNat) aW += 30; 
                if (aIsMale) aW += 40;
            } else if (aL.startsWith('en')) { 
                aW += 10; 
                if (aNat) aW += 5; 
                if (aIsMale) aW += 2;
            }
            
            if (bL.startsWith('es')) { 
                bW += 100; 
                if (bLatAm) bW += 50; 
                if (bNat) bW += 30; 
                if (bIsMale) bW += 40; 
            } else if (bL.startsWith('en')) { 
                bW += 10; 
                if (bNat) bW += 5; 
                if (bIsMale) bW += 2;
            }
            return bW - aW;
        });
    }, [voices]);

    const selectedVoice = voices.find(v => v.voiceURI === selectedVoiceURI);

    const previewVoice = (voice: SpeechSynthesisVoice) => {
        if (typeof window === 'undefined' || !window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const demo = voice.lang.toLowerCase().startsWith('es')
            ? 'Hola, soy Foodie. Así se escucha mi voz.'
            : 'Hello, I am Foodie. This is my voice.';
        const u = new SpeechSynthesisUtterance(demo);
        u.voice = voice; u.lang = voice.lang; u.rate = speed; u.pitch = pitch;
        window.speechSynthesis.speak(u);
    };

    const handleMic = () => {
        if (status === 'listening') stopListening();
        else if (status === 'speaking') { window.speechSynthesis?.cancel(); startListening(); }
        else startListening();
    };

    const submitTyped = (e: React.FormEvent) => {
        e.preventDefault();
        const q = typed.trim();
        if (!q || status === 'thinking') return;
        setTyped('');
        askAgent(q);
    };

    const active = status === 'listening' || status === 'speaking';

    const neonCyan = { color: '#4f46e5', fontWeight: 'bold' };
    const neonGreen = { color: '#16a34a', fontWeight: 'bold' };
    const neonAmber = { color: '#d97706', fontWeight: 'bold' };
    const neonPurple = { color: '#7c3aed', fontWeight: 'bold' };

    const statusNeon: Record<Status, React.CSSProperties> = {
        idle: neonCyan,
        listening: neonGreen,
        thinking: neonAmber,
        speaking: neonPurple,
    };

    const statusColor: Record<Status, string> = {
        idle: '#4f46e5',
        listening: '#16a34a',
        thinking: '#d97706',
        speaking: '#7c3aed',
    };

    const accentColor = statusColor[status];

    return (
        <div className="absolute inset-0 flex flex-col justify-between overflow-hidden" style={{ background: '#f8fafc' }}>

            {/* ═══ CSS ═══ */}
            <style>{`
                @keyframes aurora-drift { 0% { transform: translate(0,0) scale(1); } 33% { transform: translate(20px,-20px) scale(1.05); } 66% { transform: translate(-10px,10px) scale(0.97); } 100% { transform: translate(0,0) scale(1); } }
                @keyframes aurora-drift-2 { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,15px) scale(1.08); } 100% { transform: translate(0,0) scale(1); } }
                @keyframes particle-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
                @keyframes orbit-1 { from { transform: rotateX(65deg) rotateZ(0deg); } to { transform: rotateX(65deg) rotateZ(360deg); } }
                @keyframes orbit-2 { from { transform: rotateX(65deg) rotateY(60deg) rotateZ(360deg); } to { transform: rotateX(65deg) rotateY(60deg) rotateZ(0deg); } }
                @keyframes orbit-3 { from { transform: rotateY(75deg) rotateZ(0deg); } to { transform: rotateY(75deg) rotateZ(360deg); } }
                @keyframes core-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
                @keyframes core-breathe-active { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
                @keyframes glow-ring { 0%,100% { box-shadow: 0 0 15px var(--glow), 0 0 35px var(--glow); } 50% { box-shadow: 0 0 25px var(--glow), 0 0 60px var(--glow); } }
                @keyframes eq-bar { 0%,100% { height: 3px; } 50% { height: var(--bar-h); } }
                @keyframes scan-line { 0% { top: -5%; } 100% { top: 105%; } }
                @keyframes bubble-in { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: translateY(0); } }
                @keyframes think-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>

            {/* ═══ Background layers ═══ */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            <div className="absolute rounded-full pointer-events-none" style={{ width: 450, height: 450, top: '-10%', left: '-5%', background: 'radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 60%)', animation: 'aurora-drift 18s ease-in-out infinite', filter: 'blur(80px)' }} />
            <div className="absolute rounded-full pointer-events-none" style={{ width: 350, height: 350, bottom: '-8%', right: '-8%', background: 'radial-gradient(circle, rgba(244,72,30,0.05) 0%, transparent 60%)', animation: 'aurora-drift-2 22s ease-in-out infinite', filter: 'blur(90px)' }} />
            {particles.map(p => (
                <div key={p.id} className="absolute rounded-full pointer-events-none" style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`, background: '#4f46e5', opacity: p.opacity * 0.5, animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite` }} />
            ))}
            <div className="absolute left-0 w-full h-[1px] pointer-events-none opacity-[0.04]" style={{ background: 'linear-gradient(90deg, transparent, #4f46e5, transparent)', animation: 'scan-line 8s linear infinite' }} />

            {/* ═══ UNIFIED SINGLE AREA VIEW (Leaves top 100% clean) ═══ */}
            <div className="flex-1 flex flex-col items-center justify-start min-h-0 w-full px-6 pt-24 pb-2 gap-4 overflow-hidden relative z-10">
                
                {/* ── Orb Group (Compact size at the top of the view) ── */}
                <div className="flex flex-col items-center shrink-0 gap-2 select-none">
                    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
                        <div className="absolute rounded-full" style={{ width: 130, height: 130, border: `1.5px solid ${accentColor}40`, animation: 'orbit-1 22s linear infinite' }}>
                            <div className="absolute rounded-full" style={{ width: 4, height: 4, top: -2, left: '50%', marginLeft: -2, background: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
                        </div>
                        <div className="absolute rounded-full" style={{ width: 110, height: 110, border: `1px solid rgba(129,140,248,0.1)`, animation: 'orbit-2 16s linear infinite' }}>
                            <div className="absolute rounded-full" style={{ width: 3, height: 3, bottom: -1.5, left: '50%', marginLeft: -1.5, background: '#818cf8', boxShadow: '0 0 6px #818cf8' }} />
                        </div>

                        <button onClick={handleMic} disabled={!supported || status === 'thinking'}
                            className="relative rounded-full flex items-center justify-center select-none active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                                '--glow': `${accentColor}80`,
                                width: 72, height: 72,
                                background: `radial-gradient(circle at 38% 32%, ${accentColor}ee 0%, ${accentColor}22 50%, #ffffff 90%)`,
                                boxShadow: active ? `0 0 18px ${accentColor}66, 0 0 45px ${accentColor}33, inset 0 0 15px rgba(255,255,255,0.1)` : `0 4px 12px -1px rgba(148, 163, 184, 0.15), 0 2px 4px -1px rgba(148, 163, 184, 0.15)`,
                                animation: active ? 'core-breathe-active 2.5s ease-in-out infinite, glow-ring 3s ease-in-out infinite' : 'core-breathe 4s ease-in-out infinite',
                            } as React.CSSProperties}>
                            <div className="absolute inset-1 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%)', border: '1px solid rgba(255,255,255,0.05)' }} />
                            {status === 'thinking' && (
                                <div className="absolute inset-0 rounded-full" style={{ border: '2px solid transparent', borderTopColor: '#ffbb00', borderRightColor: '#ffbb0080', animation: 'think-spin 0.8s linear infinite' }} />
                            )}
                            {status === 'listening' ? <MicOff size={20} className="relative z-10" style={{ color: '#fff', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }} />
                                : status === 'thinking' ? (
                                    <div className="relative z-10 flex items-center gap-0.5">
                                        {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#ffbb00', animationDelay: `${i * 0.15}s` }} />)}
                                    </div>
                                ) : <Mic size={20} className="relative z-10" style={{ color: '#fff', filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }} />}
                        </button>
                    </div>

                    {/* Status indicator and label */}
                    <div className="flex flex-col items-center">
                        <p className="text-xs font-black uppercase tracking-[0.2em] mb-1" style={statusNeon[status]}>
                            {STATUS_LABEL[status]}
                        </p>
                        
                        {/* Equalizer waves */}
                        <div className="flex items-end justify-center gap-[2.5px] h-6 w-48">
                            {EQ_BARS.map(bar => (
                                <div key={bar.id} className="rounded-full" style={{
                                    width: 2.5,
                                    '--bar-h': `${bar.maxH}px`,
                                    height: active ? undefined : '2px',
                                    background: active ? `hsl(${bar.hue}, 85%, 60%)` : 'rgba(255,255,255,0.15)',
                                    animation: active ? `eq-bar ${0.6 + Math.random() * 0.6}s ease-in-out ${bar.delay}s infinite` : 'none',
                                    opacity: active ? 0.9 : 0.4,
                                } as React.CSSProperties} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Chat Console Area ── */}
                <div className="flex-1 w-full overflow-y-auto px-4 py-3.5 rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-md shadow-sm flex flex-col gap-3 min-h-0 scrollbar-thin">
                    {(!interim && !userText && !answer) && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-6 gap-2.5 select-none my-auto opacity-70">
                            <Volume2 size={22} style={{ color: 'var(--color-brand-orange, #f4481e)' }} />
                            <h4 className="text-slate-800 text-xs font-bold tracking-wide uppercase">Consola de Respuestas</h4>
                            <p className="text-slate-500 text-[11px] leading-relaxed max-w-xs font-medium">
                                Presiona el orbe de arriba o escribe una pregunta abajo para iniciar la conversación con Foodie.
                            </p>
                        </div>
                    )}
                    
                    {(interim || userText) && (
                        <div className="self-end max-w-[85%] px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm"
                            style={{
                                background: 'linear-gradient(135deg, var(--color-brand-yellow, #f8e14c) 0%, #f6d833 100%)',
                                border: '1px solid rgba(246, 216, 51, 0.4)',
                                animation: 'bubble-in 0.3s ease-out',
                            }}>
                            <span className="text-[13px] font-bold leading-relaxed" style={{ color: '#0f172a' }}>{interim || userText}</span>
                        </div>
                    )}
                    
                    {answer && (
                        <div className="self-start max-w-[90%] px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm"
                            style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                animation: 'bubble-in 0.3s ease-out',
                            }}>
                            <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1 prose-headings:font-black prose-strong:font-black prose-table:text-xs prose-table:border-collapse prose-th:bg-slate-100 prose-th:font-bold prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-code:bg-slate-100 prose-code:px-1 prose-code:rounded prose-code:text-xs"
                                style={{
                                    color: '#0f172a',
                                    '--tw-prose-body': '#334155',
                                    '--tw-prose-headings': '#0f172a',
                                    '--tw-prose-bold': 'var(--color-brand-orange, #f4481e)',
                                    '--tw-prose-bullets': 'var(--color-brand-orange, #f4481e)',
                                    '--tw-prose-quotes': '#475569',
                                    '--tw-prose-code': 'var(--color-brand-orange, #f4481e)',
                                    '--tw-prose-links': '#4f46e5',
                                    '--tw-prose-counters': 'var(--color-brand-orange, #f4481e)',
                                    '--tw-prose-hr': '#e2e8f0',
                                    '--tw-prose-th-borders': '#cbd5e1',
                                    '--tw-prose-td-borders': '#e2e8f0',
                                } as React.CSSProperties}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                    {hideIncompleteFence(answer)}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
            </div>

            {/* ═══ BOTTOM DOCK & METADATA (Includes Header and Selector now) ═══ */}
            <div className="w-full px-6 py-4 border-t border-slate-100 bg-white shadow-lg flex flex-col gap-3 shrink-0 z-20" style={{ backdropFilter: 'blur(10px)' }}>
                
                {/* Upper Row: Status label and Settings (old Header elements, relocated to bottom) */}
                <div className="flex items-center justify-between w-full pb-2.5 border-b border-slate-100">
                    {/* Left: Foodie identity & Standby */}
                    <div className="flex items-center gap-2.5 select-none">
                        <span className="text-base font-black tracking-[0.25em]" style={{ color: '#0f172a' }}>FOODIE</span>
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? '#16a34a' : '#4f46e5', boxShadow: `0 0 5px ${active ? '#16a34a' : '#4f46e5'}` }} />
                            <span className="text-[9px] font-bold tracking-widest uppercase" style={active ? neonGreen : neonCyan}>
                                {active ? 'EN LÍNEA' : 'STANDBY'}
                            </span>
                        </div>
                    </div>

                    {/* Right: Voice selector (expands UPWARD) & Exit button */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button onClick={() => setVoicePanelOpen(p => !p)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl transition-all hover:scale-[1.01]"
                                style={{
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                }}>
                                <Volume2 size={13} style={{ color: '#475569' }} />
                                <span className="text-[10px] font-bold truncate max-w-[80px]" style={{ color: '#334155' }}>
                                    {selectedVoice ? selectedVoice.name.replace('Microsoft', 'MS').replace('Google', 'G').split(' (')[0] : 'Voz'}
                                </span>
                                {voicePanelOpen ? <ChevronUp size={11} style={{ color: '#475569' }} /> : <ChevronDown size={11} style={{ color: '#475569' }} />}
                            </button>

                            {/* Floating voices list (UPWARD layout) */}
                            {voicePanelOpen && (
                                <div className="absolute right-0 bottom-full mb-2 w-[310px] rounded-2xl overflow-hidden shadow-2xl z-50 animate-bubble-in" 
                                    style={{ 
                                        border: '1px solid #cbd5e1', 
                                        background: '#ffffff',
                                        backdropFilter: 'blur(25px)',
                                        boxShadow: '0 -10px 30px rgba(148, 163, 184, 0.25)'
                                    }}>
                                    {/* Speed / Pitch controls */}
                                    <div className="px-4 py-2 flex gap-4 border-b" style={{ borderColor: '#e2e8f0' }}>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-0.5">
                                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Velocidad</span>
                                                <span className="text-[9px] font-bold tabular-nums" style={{ color: 'var(--color-brand-orange, #f4481e)' }}>{speed.toFixed(2)}x</span>
                                            </div>
                                            <input type="range" min="0.75" max="1.4" step="0.05" value={speed}
                                                onChange={e => { const v = parseFloat(e.target.value); setSpeed(v); localStorage.setItem('jarvis_voice_speed', v.toString()); }}
                                                className="w-full h-1 rounded-lg appearance-none cursor-pointer accent-orange-600" style={{ background: '#cbd5e1' }} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-0.5">
                                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>Tono</span>
                                                <span className="text-[9px] font-bold tabular-nums" style={{ color: 'var(--color-brand-orange, #f4481e)' }}>{pitch.toFixed(2)}</span>
                                            </div>
                                            <input type="range" min="0.7" max="1.3" step="0.05" value={pitch}
                                                onChange={e => { const v = parseFloat(e.target.value); setPitch(v); localStorage.setItem('jarvis_voice_pitch', v.toString()); }}
                                                className="w-full h-1 rounded-lg appearance-none cursor-pointer accent-orange-600" style={{ background: '#cbd5e1' }} />
                                        </div>
                                    </div>

                                    {/* Voice list options */}
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {sortedVoices.map(voice => {
                                            const isSel = voice.voiceURI === selectedVoiceURI;
                                            const vn = voice.name.toLowerCase();
                                            const isNatural = vn.includes('natural') || vn.includes('neural') || vn.includes('google') || vn.includes('online');
                                            const vl = voice.lang.toLowerCase();
                                            const isLatAm = vl.startsWith('es') && !vl.includes('es-es');
                                            const isSpain = vl.includes('es-es');
                                            
                                            const maleKeywords = ['alvaro', 'jorge', 'julio', 'luis', 'jose', 'miguel', 'enrique', 'juan', 'mateo', 'diego', 'everardo', 'male', 'masculino', 'hombre', 'david', 'gerardo', 'carlos'];
                                            const isMale = maleKeywords.some(keyword => vn.includes(keyword));

                                            return (
                                                <div key={voice.voiceURI}
                                                    onClick={() => { setSelectedVoiceURI(voice.voiceURI); localStorage.setItem('jarvis_voice_uri', voice.voiceURI); }}
                                                    className="flex items-center justify-between px-4 py-2 cursor-pointer transition-all hover:bg-slate-50"
                                                    style={{
                                                        background: isSel ? 'rgba(244,72,30,0.06)' : 'transparent',
                                                        borderLeft: isSel ? '3px solid var(--color-brand-orange, #f4481e)' : '3px solid transparent',
                                                        borderBottom: '1px solid #f1f5f9',
                                                    }}>
                                                    <div className="min-w-0 pr-2">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[11px] font-bold truncate" style={{ color: isSel ? 'var(--color-brand-orange, #f4481e)' : '#0f172a' }}>
                                                                {voice.name.replace('Microsoft', 'MS').replace('Google', 'G').split(' (')[0].split(' - ')[0]}
                                                            </span>
                                                            {isNatural && (
                                                                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded-full"
                                                                    style={{ color: '#16a34a', background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.2)' }}>
                                                                    Natural
                                                                </span>
                                                            )}
                                                            <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full"
                                                                style={{ 
                                                                    color: isMale ? '#38bdf8' : '#f472b6', 
                                                                    background: isMale ? 'rgba(56,189,248,0.1)' : 'rgba(244,114,182,0.1)',
                                                                    border: isMale ? '1px solid rgba(56,189,248,0.2)' : '1px solid rgba(244,114,182,0.2)'
                                                                }}>
                                                                {isMale ? '👨 M' : '👩 F'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.2">
                                                            <span className="text-[10px] font-bold" style={{ color: isLatAm ? 'var(--color-brand-orange, #f4481e)' : isSpain ? '#d97706' : '#0284c7' }}>
                                                                {isLatAm ? 'Latino' : isSpain ? 'España' : 'English'}
                                                            </span>
                                                            <span className="text-[9px] font-semibold" style={{ color: '#64748b' }}>
                                                                {voice.lang}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button onClick={e => { e.stopPropagation(); previewVoice(voice); }}
                                                        className="shrink-0 p-1.5 rounded-lg transition-all hover:scale-105"
                                                        style={{ color: 'var(--color-brand-orange, #f4481e)', background: 'rgba(244,72,30,0.06)', border: '1px solid rgba(244,72,30,0.15)' }}
                                                        title="Escuchar demo">
                                                        <Play size={9} fill="currentColor" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="px-4 py-1 text-center" style={{ borderTop: '1px solid #e2e8f0' }}>
                                        <span className="text-[9px] font-semibold" style={{ color: '#64748b' }}>
                                            💡 Chrome / Edge para voces óptimas
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={() => router.push(`/${locale}/dashboard/agente`)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-xl font-bold text-[10px] transition-all hover:scale-105"
                            style={{ color: 'var(--color-brand-orange, #f4481e)', border: '1px solid rgba(244,72,30,0.2)', background: 'rgba(244,72,30,0.06)' }}>
                            <ChefHat size={11} /> Agente Foodie
                        </button>
                    </div>
                </div>

                {/* Lower Row: Action buttons and Text input form */}
                <div className="flex items-center gap-3 w-full">
                    
                    {/* Compact controls block */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1' }}>
                        <button onClick={() => setMuted(m => !m)} title={muted ? 'Activar voz' : 'Silenciar'}
                            className="p-2 rounded-lg transition-all"
                            style={{
                                color: muted ? '#dc2626' : '#475569',
                                background: muted ? '#fef2f2' : 'transparent',
                            }}>
                            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                        </button>

                        <button onClick={handleMic} disabled={!supported || status === 'thinking'} title="Hablar"
                            className="rounded-lg transition-all active:scale-95 disabled:opacity-30 shadow-sm"
                            style={{
                                width: 32, height: 32, display: 'grid', placeItems: 'center',
                                background: active ? `linear-gradient(135deg, ${accentColor}, ${accentColor}88)` : '#e2e8f0',
                                border: `1px solid ${active ? accentColor + '40' : '#cbd5e1'}`,
                            }}>
                            {status === 'listening' ? <MicOff size={14} style={{ color: '#fff' }} /> : <Mic size={14} style={{ color: active ? '#fff' : '#475569' }} />}
                        </button>

                        <button onClick={() => setConversation(c => !c)} title="Conversación continua"
                            className="p-2 rounded-lg transition-all"
                            style={{
                                color: conversation ? '#16a34a' : '#475569',
                                background: conversation ? '#f0fdf4' : 'transparent',
                            }}>
                            <Repeat size={15} />
                        </button>
                    </div>

                    {/* Text input form */}
                    <form onSubmit={submitTyped} className="flex-1 flex items-center gap-2">
                        <div className="flex-1 flex items-center rounded-xl px-3 py-2 gap-2 shadow-sm"
                            style={{ background: '#ffffff', border: '1px solid #cbd5e1', backdropFilter: 'blur(5px)' }}>
                            <input value={typed} onChange={e => setTyped(e.target.value)}
                                placeholder="Escribe tu pregunta a Foodie…"
                                className="flex-1 bg-transparent border-none outline-none font-semibold text-xs"
                                style={{ color: '#0f172a' }} />
                            <button type="submit" disabled={!typed.trim() || status === 'thinking'}
                                className="p-1.5 rounded-lg transition-all disabled:opacity-40"
                                style={{ color: '#ffffff', background: 'var(--color-brand-orange, #f4481e)' }}>
                                <Send size={11} />
                            </button>
                        </div>
                    </form>
                </div>
            </div>

        </div>
    );
}
