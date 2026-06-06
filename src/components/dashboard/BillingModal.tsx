'use client';

import { useEffect, useState, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { CreditCard, CheckCircle2, AlertTriangle, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import BaseModal from '../BaseModal';
import Button from '../Button';

interface BillingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function BillingModalContent({ isOpen, onClose }: BillingModalProps) {
    const t = useTranslations('Billing');
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'pending'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<'1m' | '3m' | '12m'>('1m');

    const plans = {
        '1m':  { label: '1 Mes',    price: 1249, unitPrice: 1249,   saving: null,                    title: 'Suscripción 1 Mes Foodie Guru' },
        '3m':  { label: '3 Meses',  price: 3149, unitPrice: 1049.67, saving: 'Ahorras $598 MXN',      title: 'Suscripción 3 Meses Foodie Guru' },
        '12m': { label: '12 Meses', price: 9999, unitPrice: 833.25,  saving: 'Ahorras $4,989 MXN',   title: 'Suscripción Anual Foodie Guru' },
    } as const;

    // Read payment status from URL on mount/update
    useEffect(() => {
        if (isOpen && searchParams) {
            const payment = searchParams.get('payment');
            if (payment === 'success') {
                setStatus('success');
            } else if (payment === 'failure') {
                setStatus('error');
                setErrorMessage('El pago fue cancelado o rechazado por Mercado Pago.');
            } else if (payment === 'pending') {
                setStatus('pending');
            } else {
                setStatus('idle');
            }
        }
    }, [isOpen, searchParams]);

    // Load Mercado Pago SDK dynamically
    useEffect(() => {
        if (isOpen) {
            const scriptId = 'mercadopago-sdk-script';
            let script = document.getElementById(scriptId) as HTMLScriptElement;
            
            const initMP = () => {
                if ((window as any).MercadoPago) {
                    setSdkLoaded(true);
                }
            };

            if (!script) {
                script = document.createElement('script');
                script.id = scriptId;
                script.src = 'https://sdk.mercadopago.com/js/v2';
                script.async = true;
                script.onload = initMP;
                document.body.appendChild(script);
            } else {
                initMP();
            }
        }
    }, [isOpen]);

    const handleClearUrlParams = () => {
        if (!searchParams) return;
        const params = new URLSearchParams(searchParams.toString());
        params.delete('payment');
        const newQuery = params.toString();
        router.replace(`${pathname}${newQuery ? `?${newQuery}` : ''}`);
    };

    const handleClose = () => {
        if (status === 'success' || status === 'error' || status === 'pending') {
            handleClearUrlParams();
        }
        onClose();
    };

    const handlePay = async () => {
        try {
            setStatus('loading');
            setErrorMessage('');

            // Get user & project info from localStorage
            const storedUser = localStorage.getItem('user');
            const storedProject = localStorage.getItem('project');
            
            let userId = null;
            let projectId = null;

            if (storedUser) {
                try {
                    const u = JSON.parse(storedUser);
                    userId = u.idUsuario;
                } catch {}
            }

            if (storedProject) {
                try {
                    const p = JSON.parse(storedProject);
                    projectId = p.idProyecto;
                } catch {}
            }

            // Create return URL callbacks
            const origin = window.location.origin;
            const returnPath = window.location.pathname;
            const successUrl = `${origin}${returnPath}?payment=success`;
            const failureUrl = `${origin}${returnPath}?payment=failure`;
            const pendingUrl = `${origin}${returnPath}?payment=pending`;

            const plan = plans[selectedPlan];

            // Call preference creation API
            const response = await fetch('/api/billing/create-preference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId,
                    projectId,
                    successUrl,
                    failureUrl,
                    pendingUrl,
                    planTitle: plan.title,
                    planPrice: plan.price
                })
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Error al generar la preferencia de pago');
            }

            // Initialize Mercado Pago checkout
            const mpPublicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || 'APP_USR-024e73ac-12aa-4a6f-9be3-60b19b0505b5';
            
            if (!(window as any).MercadoPago) {
                throw new Error('El SDK de Mercado Pago no se ha cargado correctamente.');
            }

            const mp = new (window as any).MercadoPago(mpPublicKey, {
                locale: 'es-MX'
            });

            // Open Checkout Pro overlay
            mp.checkout({
                preference: {
                    id: data.preferenceId
                },
                autoOpen: true
            });

            // Reset loading state (the Mercado Pago overlay is now open)
            setStatus('idle');

        } catch (error: any) {
            console.error('Payment error:', error);
            setStatus('error');
            setErrorMessage(error.message || 'Ocurrió un error inesperado al procesar el pago.');
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={handleClose}
            title={t('title', { defaultValue: 'Suscripción Premium' })}
            subtitle={t('subtitle', { defaultValue: 'Activa o renueva tu cuenta Foodie Guru' })}
            size="md"
        >
            <div className="flex flex-col items-center py-2">
                {status === 'success' && (
                    <div className="text-center flex flex-col items-center py-6 animate-in fade-in duration-300">
                        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-4">
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            ¡Pago Realizado Exitosamente!
                        </h3>
                        <p className="text-sm text-gray-500 max-w-sm mb-6">
                            Tu suscripción Premium a Foodie Guru ha sido procesada con éxito. Ya puedes disfrutar de todos los beneficios y herramientas de la plataforma.
                        </p>
                        <Button variant="solid" onClick={handleClose}>
                            Aceptar
                        </Button>
                    </div>
                )}

                {status === 'pending' && (
                    <div className="text-center flex flex-col items-center py-6 animate-in fade-in duration-300">
                        <div className="h-16 w-16 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 mb-4">
                            <AlertTriangle size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            Pago en Proceso
                        </h3>
                        <p className="text-sm text-gray-500 max-w-sm mb-6">
                            Mercado Pago está procesando tu transacción. Te notificaremos una vez que sea acreditada.
                        </p>
                        <Button variant="solid" onClick={handleClose}>
                            Entendido
                        </Button>
                    </div>
                )}

                {status === 'error' && (
                    <div className="text-center flex flex-col items-center py-6 animate-in fade-in duration-300">
                        <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                            <XCircle size={40} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">
                            No se pudo completar el pago
                        </h3>
                        <p className="text-sm text-gray-500 max-w-sm mb-6">
                            {errorMessage || 'Ocurrió un problema durante el proceso de pago. Por favor, inténtalo de nuevo.'}
                        </p>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={handleClose}>
                                Cerrar
                            </Button>
                            <Button variant="solid" onClick={handlePay}>
                                Intentar de Nuevo
                            </Button>
                        </div>
                    </div>
                )}

                {status === 'loading' && (
                    <div className="text-center flex flex-col items-center py-10">
                        <Loader2 size={40} className="text-green-600 animate-spin mb-4" />
                        <p className="text-sm text-gray-600 font-medium">
                            Generando preferencia de pago...
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                            Por favor no cierres esta ventana.
                        </p>
                    </div>
                )}

                {status === 'idle' && (
                    <div className="w-full animate-in fade-in duration-300">
                        {/* Plan Selector */}
                        <div className="grid grid-cols-3 gap-2 mb-5">
                            {(Object.entries(plans) as [keyof typeof plans, typeof plans[keyof typeof plans]][]).map(([key, plan]) => (
                                <button
                                    key={key}
                                    onClick={() => setSelectedPlan(key)}
                                    className={`relative flex flex-col items-center rounded-xl border-2 p-3 transition-all cursor-pointer ${
                                        selectedPlan === key
                                            ? 'border-green-500 bg-green-50 shadow-sm'
                                            : 'border-gray-200 bg-white hover:border-green-300'
                                    }`}
                                >
                                    {plan.saving && (
                                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold uppercase tracking-wide bg-green-500 text-white px-1.5 py-0.5 rounded-full">
                                            Popular
                                        </span>
                                    )}
                                    <span className={`text-xs font-semibold mb-1 ${ selectedPlan === key ? 'text-green-700' : 'text-gray-500' }`}>
                                        {plan.label}
                                    </span>
                                    <span className={`text-base font-black ${ selectedPlan === key ? 'text-green-700' : 'text-gray-800' }`}>
                                        ${plan.price.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-gray-400 mt-0.5">
                                        ${plan.unitPrice.toLocaleString('es-MX', { maximumFractionDigits: 0 })}/mes
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Selected plan detail */}
                        <div className="border border-green-200 rounded-2xl bg-green-50/50 p-5 mb-5">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <span className="text-xs font-extrabold uppercase tracking-wider bg-green-100 text-green-800 px-2.5 py-1 rounded-full">
                                        Premium
                                    </span>
                                    <h3 className="text-base font-bold text-gray-900 mt-2">
                                        {plans[selectedPlan].title}
                                    </h3>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-black text-green-700">
                                        ${plans[selectedPlan].price.toLocaleString()} <span className="text-sm font-normal text-gray-500">MXN</span>
                                    </div>
                                    {plans[selectedPlan].saving && (
                                        <div className="text-xs font-semibold text-green-600 mt-0.5">{plans[selectedPlan].saving}</div>
                                    )}
                                </div>
                            </div>

                            <ul className="space-y-2 text-sm text-gray-600 border-t border-green-100 pt-3">
                                <li className="flex items-center gap-2">
                                    <ShieldCheck size={15} className="text-green-600 shrink-0" />
                                    <span>Control completo de Inventarios y Mermas</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <ShieldCheck size={15} className="text-green-600 shrink-0" />
                                    <span>Digitalización OCR de facturas ilimitada</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <ShieldCheck size={15} className="text-green-600 shrink-0" />
                                    <span>Reportes e Inteligencia de Negocio con IA</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <ShieldCheck size={15} className="text-green-600 shrink-0" />
                                    <span>Soporte prioritario e integraciones activas</span>
                                </li>
                            </ul>
                        </div>

                        {/* Payment Action */}
                        <div className="flex flex-col gap-3">
                            <Button
                                variant="solid"
                                size="lg"
                                leftIcon={CreditCard}
                                className="w-full justify-center text-sm font-bold shadow-md hover:shadow-lg transition-all"
                                style={{ backgroundColor: '#009EE3', borderColor: '#009EE3', color: '#ffffff' }}
                                onClick={handlePay}
                                disabled={!sdkLoaded}
                            >
                                {!sdkLoaded
                                    ? 'Cargando pasarela...'
                                    : `Pagar $${plans[selectedPlan].price.toLocaleString()} MXN`
                                }
                            </Button>

                            <div className="flex justify-center items-center gap-1.5 text-xs text-gray-400">
                                <ShieldCheck size={14} className="text-gray-400" />
                                <span>Pago seguro procesado por Mercado Pago</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </BaseModal>
    );
}

export default function BillingModal(props: BillingModalProps) {
    return (
        <Suspense fallback={null}>
            <BillingModalContent {...props} />
        </Suspense>
    );
}
