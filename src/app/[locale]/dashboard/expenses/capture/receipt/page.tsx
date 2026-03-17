'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter } from 'next/navigation';
import Button from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';

export default function ReceiptCapturePage() {
    const t = useTranslations('ReceiptCapture');
    const tModal = useTranslations('ExpensesModal');
    const searchParams = useSearchParams();
    const router = useRouter();
    const { colors } = useTheme();

    const projectId = searchParams.get('projectId');
    const branchId = searchParams.get('branchId');
    const day = searchParams.get('day');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    const [image, setImage] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrResult, setOcrResult] = useState<any>(null);
    const [concepts, setConcepts] = useState<any[]>([]);
    const [selectedConceptId, setSelectedConceptId] = useState('');
    const [amount, setAmount] = useState('');
    const [reference, setReference] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (projectId) {
            fetchConcepts();
        }
    }, [projectId]);

    const fetchConcepts = async () => {
        try {
            const response = await fetch(`/api/expense-concepts?projectId=${projectId}`);
            const data = await response.json();
            if (data.success) {
                setConcepts(data.data);
            }
        } catch (error) {
            console.error('Error fetching concepts:', error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(file);
            setPreview(URL.createObjectURL(file));
            setOcrResult(null);
        }
    };

    const processReceipt = async () => {
        if (!image) return;
        setIsProcessing(true);
        try {
            const formData = new FormData();
            formData.append('image', image);

            const response = await fetch('/api/expenses/process-receipt', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                setOcrResult(data.data);
                setAmount(data.data.total?.toString() || '');
                setReference(data.data.provider || '');
                
                // Try to find a matching concept if possible, or just let the user pick
            } else {
                alert(t('error') + ': ' + data.message);
            }
        } catch (error) {
            console.error('Error processing receipt:', error);
            alert(t('error'));
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSave = async () => {
        if (!selectedConceptId || !amount) {
            alert('Por favor seleccione un concepto y verifique el monto.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('projectId', projectId!);
            formData.append('branchId', branchId!);
            formData.append('day', day!);
            formData.append('month', month!);
            formData.append('year', year!);
            formData.append('conceptId', selectedConceptId);
            formData.append('amount', amount);
            formData.append('reference', reference);
            if (image) formData.append('file', image);

            const response = await fetch('/api/expenses/daily', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                alert(t('success'));
                // Option to go back or capture another
                router.back();
            } else {
                alert('Error al guardar el gasto');
            }
        } catch (error) {
            console.error('Error saving expense:', error);
            alert('Error al guardar el gasto');
        }
    };

    if (!projectId || !branchId || !day || !month || !year) {
        return <div className="p-10 text-center">Faltan parámetros necesarios. Escanea el código QR de nuevo.</div>;
    }

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 p-4 md:p-8 max-w-md mx-auto">
            <header className="mb-6 text-center">
                <h1 className="text-2xl font-black text-gray-800">{t('title')}</h1>
                <p className="text-gray-500 text-sm">{t('subtitle')}</p>
            </header>

            {!preview ? (
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 border-4 border-dashed border-gray-200 rounded-3xl flex flex-col items-center justify-center gap-4 bg-white shadow-sm cursor-pointer hover:border-red-200 transition-colors py-20"
                >
                    <div className="text-6xl text-gray-300">📷</div>
                    <span className="font-bold text-gray-400">{t('takePhoto')}</span>
                    <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleFileChange} 
                        className="hidden" 
                    />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="relative rounded-2xl overflow-hidden shadow-lg border-2 border-white">
                        <img src={preview} alt="Receipt preview" className="w-full h-64 object-cover" />
                        <button 
                            onClick={() => { setPreview(null); setImage(null); setOcrResult(null); }}
                            className="absolute top-2 right-2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold"
                        >
                            ✕
                        </button>
                    </div>

                    {!ocrResult && !isProcessing && (
                        <Button 
                            className="w-full py-4 text-lg" 
                            onClick={processReceipt}
                            style={{ backgroundColor: colors.colorFondo1 }}
                        >
                            🔍 {t('processing').replace('...', '')}
                        </Button>
                    )}

                    {isProcessing && (
                        <div className="text-center py-4 flex flex-col items-center gap-3">
                            <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="font-bold text-red-600 animate-pulse">{t('processing')}</p>
                        </div>
                    )}

                    {ocrResult && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="font-black text-lg text-gray-800 border-b pb-2">{t('extractedInfo')}</h3>
                            
                            <div className="space-y-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">{t('provider')}</label>
                                    <input 
                                        value={reference} 
                                        onChange={(e) => setReference(e.target.value)}
                                        className="w-full p-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-red-500 transition-all font-medium"
                                    />
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">{t('amount')}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">$</span>
                                        <input 
                                            type="number"
                                            value={amount} 
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full p-3 pl-8 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-red-500 transition-all font-black text-red-600"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-bold text-gray-400 uppercase">{tModal('concept')}</label>
                                    <select 
                                        value={selectedConceptId}
                                        onChange={(e) => setSelectedConceptId(e.target.value)}
                                        className="w-full p-3 bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-red-500 transition-all text-sm font-medium"
                                    >
                                        <option value="">{tModal('select')}</option>
                                        {concepts.map(c => (
                                            <option key={c.IdConceptoGasto} value={c.IdConceptoGasto}>
                                                {c.ConceptoGasto}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button 
                                        onClick={() => setOcrResult(null)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-all"
                                    >
                                        {t('cancel')}
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className="flex-[2] py-3 text-white font-bold rounded-xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
                                        style={{ backgroundColor: colors.colorFondo1 }}
                                    >
                                        {t('confirm')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <footer className="mt-auto py-6 text-center text-xs text-gray-400 font-medium">
                Foodie Guru &copy; 2026 - Powered by Claude AI
            </footer>
        </div>
    );
}
