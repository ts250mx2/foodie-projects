'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import PageShell from '@/components/PageShell';
import { Store, RefreshCw } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

interface BranchSales {
    IdSucursal: number;
    Sucursal: string;
    VentasBrutasTotal: number;
    Cortesias: number;
    Descuentos: number;
    Promociones: number;
    Cancelaciones: number;
    Anulaciones: number;
    VentasNetasTotal: number;
    CapturadoEn: string;
}

const money = (n: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(n) || 0);

function todayMX(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
}

export default function WansoftSalesPage() {
    const { colors } = useTheme();
    const [date, setDate] = useState<string>(todayMX());
    const [rows, setRows] = useState<BranchSales[]>([]);
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [totalNetas, setTotalNetas] = useState(0);
    const [totalBrutas, setTotalBrutas] = useState(0);
    const [lastCapture, setLastCapture] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = useCallback(async (d: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/wansoft/sales-by-branch?date=${d}`);
            const data = await res.json();
            if (data.success) {
                setRows(data.rows || []);
                setTotalNetas(data.totalNetas || 0);
                setTotalBrutas(data.totalBrutas || 0);
                setLastCapture(data.lastCapture || null);
                if (data.availableDates?.length) setAvailableDates(data.availableDates);
            }
        } catch (e) {
            console.error('Error fetching Wansoft sales:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(date); }, [date, fetchData]);

    const chartData = rows.map((r) => ({
        name: r.Sucursal.replace('Pollos Medina - ', ''),
        Ventas: Number(r.VentasNetasTotal) || 0,
    }));

    const lastCaptureLabel = lastCapture
        ? new Date(lastCapture).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })
        : '—';

    return (
        <PageShell
            title="Ventas por Sucursal (Wansoft)"
            subtitle={`${rows.length} sucursales • Última actualización: ${lastCaptureLabel}`}
            icon={Store}
            actions={
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        max={todayMX()}
                        onChange={(e) => setDate(e.target.value)}
                        list="wansoft-dates"
                        className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <datalist id="wansoft-dates">
                        {availableDates.map((d) => <option key={d} value={d} />)}
                    </datalist>
                    <button
                        onClick={() => fetchData(date)}
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                        Actualizar
                    </button>
                </div>
            }
        >
            {/* Tarjetas resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ventas Netas del día</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: colors.colorFondo1 }}>{money(totalNetas)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ventas Brutas del día</p>
                    <p className="text-3xl font-bold mt-1 text-gray-800">{money(totalBrutas)}</p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Sucursales con venta</p>
                    <p className="text-3xl font-bold mt-1 text-gray-800">
                        {rows.filter((r) => Number(r.VentasNetasTotal) > 0).length}
                        <span className="text-lg text-gray-400"> / {rows.length}</span>
                    </p>
                </div>
            </div>

            {/* Gráfica */}
            {rows.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
                    <p className="text-sm font-semibold text-gray-700 mb-4">Ventas netas por sucursal</p>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                            <Tooltip formatter={(v: number) => money(v)} />
                            <Bar dataKey="Ventas" fill={colors.colorFondo1 || '#2563eb'} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Tabla */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr className="border-b border-gray-200">
                                <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sucursal</th>
                                <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ventas Brutas</th>
                                <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cancelaciones</th>
                                <th className="px-5 py-3 text-right text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ventas Netas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading && rows.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-16 text-gray-400 italic">Cargando…</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-16 text-gray-400 italic">
                                    Sin datos para esta fecha. Verifica que el scraper haya corrido.
                                </td></tr>
                            ) : (
                                rows.map((r) => (
                                    <tr key={r.IdSucursal} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="px-5 py-3 text-sm font-medium text-gray-900">{r.Sucursal}</td>
                                        <td className="px-5 py-3 text-sm text-gray-600 text-right">{money(r.VentasBrutasTotal)}</td>
                                        <td className="px-5 py-3 text-sm text-right" style={{ color: Number(r.Cancelaciones) > 0 ? '#dc2626' : '#9ca3af' }}>
                                            {money(r.Cancelaciones)}
                                        </td>
                                        <td className="px-5 py-3 text-sm font-bold text-gray-900 text-right">{money(r.VentasNetasTotal)}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {rows.length > 0 && (
                            <tfoot>
                                <tr className="border-t-2 border-gray-200 bg-gray-50/50">
                                    <td className="px-5 py-3 text-sm font-bold text-gray-700">TOTAL</td>
                                    <td className="px-5 py-3 text-sm font-bold text-gray-700 text-right">{money(totalBrutas)}</td>
                                    <td className="px-5 py-3"></td>
                                    <td className="px-5 py-3 text-sm font-bold text-right" style={{ color: colors.colorFondo1 }}>{money(totalNetas)}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        </PageShell>
    );
}
