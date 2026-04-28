'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import QRCode from 'react-qr-code';

interface BatchCard {
    IdDocumentoOCR: number;
    DocumentoOCR: string;
    FechaCompraGasto: string;
    TotalFotos: number;
    FotosPendientes: number;
    FirstDetailId: number | null;   // replaces FirstThumb
}

interface BatchDetail {
    IdDocumentoOCR: number;
    DocumentoOCR: string;
    FechaCompraGasto: string;
    details: {
        IdDetalleDocumentoOCR: number;
        Orden: number;
        IdGasto: number;
        IdCompra: number;
    }[];
}

interface PhotoData {
    IdDetalleDocumentoOCR: number;
    Orden: number;
    IdGasto: number;
    IdCompra: number;
    DocumentoOCR: string; // base64
}

export interface BatchSelectedPhoto {
    idDetalleDocumentoOCR: number;
    base64: string;
    filename: string;
}

interface MobileBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: number;
    onProcessAsExpense: (photos: BatchSelectedPhoto[]) => void;
    onProcessAsPurchase: (photos: BatchSelectedPhoto[]) => void;
}

export default function MobileBatchModal({
    isOpen, onClose, projectId, onProcessAsExpense, onProcessAsPurchase
}: MobileBatchModalProps) {
    const params = useParams();
    const locale = params?.locale || 'es';

    const [view, setView] = useState<'list' | 'detail' | 'qr'>('list');
    const [batches, setBatches] = useState<BatchCard[]>([]);
    const [activeBatch, setActiveBatch] = useState<BatchDetail | null>(null);
    const [photos, setPhotos] = useState<PhotoData[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [projectUuid, setProjectUuid] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Zoom lightbox
    const [zoomSrc, setZoomSrc] = useState<string | null>(null);

    // Delete state
    const [deletingId, setDeletingId] = useState<number | null>(null);

    // Card thumbnails: map IdDetalleDocumentoOCR → base64 string
    const [thumbs, setThumbs] = useState<Record<number, string>>({});

    const fetchBatches = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/ocr/mobile-batches?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) {
                setBatches(data.data);
                // lazy-load thumbnails for each card
                data.data.forEach((batch: BatchCard) => {
                    if (batch.FirstDetailId && !thumbs[batch.FirstDetailId]) {
                        fetch(`/api/ocr/mobile-batches?projectId=${projectId}&detailId=${batch.FirstDetailId}`)
                            .then(r => r.json())
                            .then(pd => {
                                if (pd.success && pd.data?.DocumentoOCR) {
                                    setThumbs(prev => ({ ...prev, [batch.FirstDetailId!]: pd.data.DocumentoOCR }));
                                }
                            })
                            .catch(() => { });
                    }
                });
            }
        } catch { }
        finally { setIsLoading(false); }
    }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchProjectUuid = useCallback(async () => {
        try {
            const res = await fetch(`/api/ocr/project-uuid?projectId=${projectId}`);
            const data = await res.json();
            if (data.success) setProjectUuid(data.uuid);
        } catch { }
    }, [projectId]);

    useEffect(() => {
        if (isOpen) {
            setView('list');
            setSelectedIds(new Set());
            setActiveBatch(null);
            setPhotos([]);
            setZoomSrc(null);
            fetchBatches();
            fetchProjectUuid();
        }
    }, [isOpen, fetchBatches, fetchProjectUuid]);

    const openBatch = async (batch: BatchCard) => {
        setLoadingPhotos(true);
        try {
            const dateStr = batch.FechaCompraGasto.split('T')[0];
            const res = await fetch(`/api/ocr/mobile-batches?projectId=${projectId}&date=${dateStr}`);
            const data = await res.json();
            if (!data.success || !data.data) return;
            setActiveBatch(data.data);

            const photoPromises = data.data.details.map(async (d: any) => {
                const r = await fetch(`/api/ocr/mobile-batches?projectId=${projectId}&detailId=${d.IdDetalleDocumentoOCR}`);
                const pd = await r.json();
                return pd.success ? pd.data : null;
            });
            const loaded = (await Promise.all(photoPromises)).filter(Boolean);
            setPhotos(loaded);
            setSelectedIds(new Set());
            setView('detail');
        } catch { }
        finally { setLoadingPhotos(false); }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // ── Delete a photo from the batch ────────────────────────────────────────
    const handleDeletePhoto = async (photo: PhotoData) => {
        if (photo.IdGasto > 0 || photo.IdCompra > 0) {
            alert('Esta foto ya fue procesada y no se puede eliminar.');
            return;
        }
        const ok = window.confirm(`¿Eliminar la foto #${photo.Orden} del lote? Esta acción no se puede deshacer.`);
        if (!ok) return;

        setDeletingId(photo.IdDetalleDocumentoOCR);
        try {
            const res = await fetch('/api/ocr/mobile-batches', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, idDetalleDocumentoOCR: photo.IdDetalleDocumentoOCR })
            });
            const data = await res.json();
            if (data.success) {
                setPhotos(prev => prev.filter(p => p.IdDetalleDocumentoOCR !== photo.IdDetalleDocumentoOCR));
                setSelectedIds(prev => { const next = new Set(prev); next.delete(photo.IdDetalleDocumentoOCR); return next; });
                // Update batch counters
                setBatches(prev => prev.map(b =>
                    b.IdDocumentoOCR === activeBatch?.IdDocumentoOCR
                        ? { ...b, TotalFotos: b.TotalFotos - 1, FotosPendientes: Math.max(0, b.FotosPendientes - 1) }
                        : b
                ));
            } else {
                alert('Error al eliminar: ' + (data.message || 'Error desconocido'));
            }
        } catch (err: any) {
            alert('Error de conexión: ' + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const buildSelectedPhotos = (): BatchSelectedPhoto[] => {
        return photos
            .filter(p => selectedIds.has(p.IdDetalleDocumentoOCR))
            .map(p => ({
                idDetalleDocumentoOCR: p.IdDetalleDocumentoOCR,
                base64: p.DocumentoOCR,
                filename: `batch-${p.IdDetalleDocumentoOCR}.jpg`
            }));
    };

    const handleProcessExpense = () => {
        const selected = buildSelectedPhotos();
        if (selected.length === 0) { alert('Selecciona al menos una foto'); return; }
        onProcessAsExpense(selected);
        onClose();
    };

    const handleProcessPurchase = () => {
        const selected = buildSelectedPhotos();
        if (selected.length === 0) { alert('Selecciona al menos una foto'); return; }
        onProcessAsPurchase(selected);
        onClose();
    };

    const qrUrl = typeof window !== 'undefined' && projectUuid
        ? `${window.location.origin}/${locale}/ocr/mobile/${projectUuid}?projectId=${projectId}`
        : '';

    if (!isOpen) return null;

    return (
        <>
            {/* ── Zoom Lightbox ── */}
            {zoomSrc && (
                <div
                    className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
                    onClick={() => setZoomSrc(null)}
                >
                    <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
                        <img
                            src={`data:image/jpeg;base64,${zoomSrc}`}
                            alt="Vista ampliada"
                            className="max-w-[90vw] max-h-[85vh] rounded-3xl object-contain shadow-2xl border border-white/10"
                        />
                        <button
                            onClick={() => setZoomSrc(null)}
                            className="absolute -top-3 -right-3 w-10 h-10 bg-black/70 border border-white/20 text-white rounded-full flex items-center justify-center text-lg font-black shadow-lg"
                        >
                            ✕
                        </button>
                        <p className="absolute -bottom-7 left-0 right-0 text-center text-white/40 text-xs">
                            Toca fuera para cerrar
                        </p>
                    </div>
                </div>
            )}

            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-slate-100">

                    {/* Header */}
                    <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
                        <div className="flex items-center gap-3">
                            {view !== 'list' && (
                                <button
                                    onClick={() => { setView('list'); setZoomSrc(null); }}
                                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors text-slate-500"
                                >
                                    ←
                                </button>
                            )}
                            <div>
                                <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                                    <span className="bg-indigo-600 text-white p-2 rounded-xl shadow-md text-base">📱</span>
                                    {view === 'list' ? 'Lotes de Celular' : view === 'detail' ? (activeBatch?.DocumentoOCR || 'Detalle') : 'QR de Carga'}
                                </h2>
                                {view === 'list' && <p className="text-xs text-slate-400 font-medium mt-0.5">Fotos capturadas desde tu celular</p>}
                                {view === 'detail' && photos.length > 0 && (
                                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                                        {photos.length} foto{photos.length !== 1 ? 's' : ''} · {photos.filter(p => p.IdGasto === 0 && p.IdCompra === 0).length} pendiente{photos.filter(p => p.IdGasto === 0 && p.IdCompra === 0).length !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {view === 'list' && (
                                <button
                                    onClick={() => setView('qr')}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-indigo-100"
                                >
                                    📱 Ver QR
                                </button>
                            )}
                            <button onClick={onClose} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">✕</button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-6">

                        {/* ── VIEW: LIST ── */}
                        {view === 'list' && (
                            <>
                                {isLoading && (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                                    </div>
                                )}
                                {!isLoading && batches.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="text-5xl mb-4 opacity-40">📭</div>
                                        <p className="text-slate-500 font-black text-sm uppercase tracking-widest">Sin lotes aún</p>
                                        <p className="text-slate-400 text-xs mt-2 max-w-xs">Escanea el QR con tu celular y toma fotos de recibos para que aparezcan aquí</p>
                                        <button
                                            onClick={() => setView('qr')}
                                            className="mt-6 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"
                                        >
                                            📱 Ver QR
                                        </button>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {batches.map(batch => {
                                        const date = new Date(batch.FechaCompraGasto).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                                        const thumbBase64 = batch.FirstDetailId ? thumbs[batch.FirstDetailId] : null;
                                        return (
                                            <button
                                                key={batch.IdDocumentoOCR}
                                                onClick={() => openBatch(batch)}
                                                className="relative text-left bg-white border border-slate-100 rounded-3xl p-5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50 transition-all group overflow-hidden"
                                            >
                                                <div className="flex gap-4 items-start">
                                                    {/* Thumbnail */}
                                                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                                                        {thumbBase64 ? (
                                                            <img
                                                                src={`data:image/jpeg;base64,${thumbBase64}`}
                                                                alt=""
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-2xl">
                                                                {batch.FirstDetailId ? (
                                                                    <div className="w-5 h-5 border-2 border-slate-200 border-t-indigo-400 rounded-full animate-spin" />
                                                                ) : '📁'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-black text-slate-800 text-sm capitalize truncate">{date}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{batch.TotalFotos} foto{batch.TotalFotos !== 1 ? 's' : ''}</p>
                                                        <div className="flex items-center gap-2 mt-2">
                                                            {batch.FotosPendientes > 0 ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                                                    ⏳ {batch.FotosPendientes} pendiente{batch.FotosPendientes !== 1 ? 's' : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-black text-green-600 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                                                                    ✅ Procesado
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-slate-300 group-hover:text-indigo-400 transition-colors text-lg">→</div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* ── VIEW: QR ── */}
                        {view === 'qr' && (
                            <div className="flex flex-col items-center justify-center py-8 gap-6">
                                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                    {qrUrl ? (
                                        <QRCode value={qrUrl} size={220} bgColor="transparent" fgColor="#4f46e5" />
                                    ) : (
                                        <div className="w-[220px] h-[220px] flex items-center justify-center">
                                            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                                <div className="text-center max-w-xs">
                                    <h3 className="text-lg font-black text-slate-800 mb-2">Escanea para subir fotos</h3>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        Apunta la cámara de tu celular al QR. Se abrirá una página donde podrás tomar fotos de recibos y subirlas al lote del día.
                                    </p>
                                </div>
                                {qrUrl && (
                                    <div className="w-full max-w-xs bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Enlace directo</p>
                                        <p className="text-xs text-indigo-600 break-all font-mono">{qrUrl}</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── VIEW: DETAIL ── */}
                        {view === 'detail' && (
                            <>
                                {loadingPhotos && (
                                    <div className="flex items-center justify-center py-16">
                                        <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                                    </div>
                                )}
                                {!loadingPhotos && photos.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="text-4xl mb-3 opacity-30">📭</div>
                                        <p className="text-slate-400 text-sm font-black">Sin fotos en este lote</p>
                                    </div>
                                )}
                                {!loadingPhotos && photos.length > 0 && (
                                    <>
                                        {/* Selection controls */}
                                        <div className="flex items-center justify-between mb-4">
                                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">
                                                {selectedIds.size} seleccionada{selectedIds.size !== 1 ? 's' : ''}
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelectedIds(new Set(photos.filter(p => p.IdGasto === 0 && p.IdCompra === 0).map(p => p.IdDetalleDocumentoOCR)))}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                                                >
                                                    Sel. pendientes
                                                </button>
                                                <button
                                                    onClick={() => setSelectedIds(new Set())}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                                                >
                                                    Limpiar
                                                </button>
                                            </div>
                                        </div>

                                        {/* Photo grid */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                                            {photos.map(photo => {
                                                const isProcessed = photo.IdGasto > 0 || photo.IdCompra > 0;
                                                const isSelected = selectedIds.has(photo.IdDetalleDocumentoOCR);
                                                const isDeleting = deletingId === photo.IdDetalleDocumentoOCR;
                                                return (
                                                    <div
                                                        key={photo.IdDetalleDocumentoOCR}
                                                        className={`relative aspect-square rounded-3xl overflow-hidden border-4 transition-all ${
                                                            isProcessed ? 'border-green-200 opacity-60' :
                                                            isSelected ? 'border-indigo-500 scale-[1.02] shadow-lg shadow-indigo-100' :
                                                            'border-transparent hover:border-slate-200'
                                                        }`}
                                                    >
                                                        {/* Image — click to select (if not processed) */}
                                                        <img
                                                            src={`data:image/jpeg;base64,${photo.DocumentoOCR}`}
                                                            alt={`Foto ${photo.Orden}`}
                                                            className="w-full h-full object-cover"
                                                            onClick={() => !isProcessed && toggleSelect(photo.IdDetalleDocumentoOCR)}
                                                        />

                                                        {/* Deleting overlay */}
                                                        {isDeleting && (
                                                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                                            </div>
                                                        )}

                                                        {/* Processed badge */}
                                                        {isProcessed && !isDeleting && (
                                                            <div className="absolute inset-0 bg-green-500/20 flex items-end justify-center pb-3 pointer-events-none">
                                                                <span className="text-[10px] font-black bg-green-500 text-white px-2 py-1 rounded-full shadow">
                                                                    ✅ {photo.IdGasto > 0 ? `Gasto #${photo.IdGasto}` : `Compra #${photo.IdCompra}`}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {/* Selection indicator */}
                                                        {!isProcessed && !isDeleting && (
                                                            <div
                                                                className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center z-10 transition-all cursor-pointer ${
                                                                    isSelected ? 'bg-indigo-500 text-white shadow-lg' : 'bg-black/30 border-2 border-white'
                                                                }`}
                                                                onClick={() => toggleSelect(photo.IdDetalleDocumentoOCR)}
                                                            >
                                                                {isSelected && <span className="text-xs font-black">✓</span>}
                                                            </div>
                                                        )}

                                                        {/* Zoom button */}
                                                        {!isDeleting && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); setZoomSrc(photo.DocumentoOCR); }}
                                                                className="absolute bottom-2 left-2 w-8 h-8 bg-black/50 backdrop-blur-sm text-white rounded-full flex items-center justify-center text-sm transition-all hover:bg-black/70 active:scale-90 z-10"
                                                                title="Ver en grande"
                                                            >
                                                                🔍
                                                            </button>
                                                        )}

                                                        {/* Delete button (only for unprocessed) */}
                                                        {!isProcessed && !isDeleting && (
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleDeletePhoto(photo); }}
                                                                className="absolute top-2 right-2 w-8 h-8 bg-red-500/80 backdrop-blur-sm text-white rounded-full flex items-center justify-center text-sm font-black transition-all hover:bg-red-600 active:scale-90 z-10"
                                                                title="Eliminar foto"
                                                            >
                                                                🗑️
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer Actions */}
                    {view === 'detail' && selectedIds.size > 0 && (
                        <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={handleProcessExpense}
                                className="flex-1 py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-red-100"
                            >
                                💸 Procesar como Gasto
                            </button>
                            <button
                                onClick={handleProcessPurchase}
                                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-blue-100"
                            >
                                🛒 Procesar como Compra
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
