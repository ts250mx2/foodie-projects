'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
}

interface AiAgentProps {
    dashboardData: any;
}

const FoodieGuruIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
    <span className={className}>👨‍🍳</span>
);

export default function AiAgent({ dashboardData }: AiAgentProps) {
    useEffect(() => {
        console.log("AiAgent Mounted with data:", dashboardData);
    }, [dashboardData]);

    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [modelType, setModelType] = useState<'gpt-4o' | 'claude'>('gpt-4o');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isMaximized]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const projectId = dashboardData.project?.idProyecto || dashboardData.project?.IdProyecto;
            
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, userMsg],
                    modelType,
                    context: dashboardData,
                    projectId: projectId
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (data.executedSql) {
                console.log("------------------------------------------");
                console.log("🔍 FOODIE GURU - SQL EJECUTADO:");
                console.log(data.executedSql);
                console.log("------------------------------------------");
            }

            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: data.content
            }]);
        } catch (error: any) {
            setMessages(prev => [...prev, { 
                role: 'assistant', 
                content: `Lo siento, ocurrió un error: ${error.message}. Verifica que las API Keys estén configuradas en el .env.` 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-10 right-10 z-[99999]" style={{ display: 'block' }}>
            {/* Floating Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 group ring-4 ring-indigo-50"
                >
                    <FoodieGuruIcon className="text-3xl group-hover:rotate-12 transition-transform duration-300" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className={`absolute bottom-0 right-0 bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden transition-all duration-500 ease-in-out ${isMaximized ? 'w-[80vw] h-[85vh] max-w-5xl' : 'w-[400px] h-[600px]'} animate-in slide-in-from-bottom-5`}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-4 flex justify-between items-center text-white shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl shadow-inner border border-white/10 overflow-hidden">
                                <FoodieGuruIcon />
                            </div>
                            <div>
                                <h3 className="font-black text-sm md:text-base flex items-center gap-2" style={{ color: 'white' }}>
                                    Foodie Guru
                                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                </h3>
                                <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'white' }}>Inteligencia Gastronómica</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                            <select 
                                value={modelType}
                                onChange={(e) => setModelType(e.target.value as any)}
                                className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-[10px] outline-none hover:bg-white/20 transition-all font-bold cursor-pointer"
                                style={{ color: 'white' }}
                            >
                                <option value="gpt-4o" className="text-slate-800">GPT-4o</option>
                                <option value="claude" className="text-slate-800">Claude 3.5</option>
                            </select>

                            <button
                                onClick={() => setMessages([])}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                title="Borrar Chat"
                                style={{ color: 'white' }}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>

                            <button
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                title={isMaximized ? "Restaurar" : "Maximizar"}
                                style={{ color: 'white' }}
                            >
                                {isMaximized ? (
                                    <svg className="w-4 h-4" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" x2="21" y1="10" y2="3"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="white" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" x2="14" y1="3" y2="10"/><line x1="3" x2="10" y1="21" y2="14"/></svg>
                                )}
                            </button>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                style={{ color: 'white' }}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="white" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50 scroll-smooth">
                        {messages.length === 0 && (
                            <div className="text-center py-10 animate-in fade-in zoom-in duration-500">
                                <div className="bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-indigo-100/50 overflow-hidden">
                                    <span className="text-5xl">👨‍🍳</span>
                                </div>
                                <h4 className="text-slate-800 font-black text-xl italic">"Tu éxito se cocina aquí"</h4>
                                <p className="text-slate-500 text-sm mt-3 px-8 leading-relaxed max-w-sm mx-auto">
                                    Soy tu **Foodie Guru**, experto en rentabilidad y análisis de datos restauranteros.
                                </p>
                                <div className="mt-8 flex flex-wrap justify-center gap-2 px-4 italic opacity-40 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-900">
                                    <span>Ventas</span> • <span>Optimización</span> • <span>Estrategia</span>
                                </div>
                            </div>
                        )}
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                                <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all hover:shadow-md ${
                                    msg.role === 'user' 
                                        ? 'bg-indigo-600 text-white font-bold rounded-br-none' 
                                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none font-medium'
                                }`}>
                                    {msg.role === 'assistant' ? (
                                        <div className="prose prose-sm max-w-none prose-slate prose-p:leading-relaxed prose-table:border prose-table:rounded-lg prose-th:bg-slate-50 prose-th:p-2 prose-td:p-2">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start animate-in fade-in duration-300">
                                <div className="bg-white p-4 rounded-2xl rounded-bl-none shadow-sm flex gap-1 border border-slate-100">
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                                    <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-slate-100">
                        <form onSubmit={handleSend} className="flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Pregunta lo que quieras..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`px-4 rounded-xl transition-all flex items-center justify-center ${isLoading ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200'}`}
                            >
                                <svg className="w-5 h-5 rotate-90 transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
