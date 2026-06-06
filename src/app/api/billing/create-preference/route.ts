import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, projectId, successUrl, failureUrl, pendingUrl } = body;

        const accessToken = process.env.MP_ACCESS_TOKEN;
        if (!accessToken) {
            console.error('Mercado Pago Access Token is missing in environment variables.');
            return NextResponse.json({ 
                success: false, 
                message: 'Mercado Pago Access Token is not configured' 
            }, { status: 500 });
        }

        // Construct dynamic origin — prefer Referer header, fallback to x-forwarded-host
        const referer = request.headers.get('referer');
        const forwardedHost = request.headers.get('x-forwarded-host');
        const host = request.headers.get('host') || 'localhost:3006';
        const proto = host.includes('localhost') ? 'http' : 'https';

        let origin: string;
        if (referer) {
            const refererUrl = new URL(referer);
            origin = refererUrl.origin;
        } else if (forwardedHost) {
            origin = `https://${forwardedHost}`;
        } else {
            origin = `${proto}://${host}`;
        }

        // Determine the dashboard path from body-provided URLs or build dynamically
        const resolvedSuccessUrl = successUrl || `${origin}/es/dashboard?payment=success`;
        const resolvedFailureUrl = failureUrl || `${origin}/es/dashboard?payment=failure`;
        const resolvedPendingUrl = pendingUrl || `${origin}/es/dashboard?payment=pending`;

        // Whether origin is localhost — MP does not support auto_return for non-public URLs
        const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');

        // Payment preferences details
        const paymentData: Record<string, any> = {
            items: [
                {
                    id: "foodie-guru-monthly-sub",
                    title: "Suscripción Mensual Foodie Guru",
                    description: "Acceso Premium a la plataforma de Foodie Guru",
                    quantity: 1,
                    unit_price: 499.00,
                    currency_id: "MXN",
                    category_id: "services"
                }
            ],
            back_urls: {
                success: resolvedSuccessUrl,
                failure: resolvedFailureUrl,
                pending: resolvedPendingUrl
            },
            // auto_return requires a publicly reachable success URL — skip for localhost
            ...(isLocalhost ? {} : { auto_return: "approved" }),
            metadata: {
                user_id: userId,
                project_id: projectId
            }
        };

        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(paymentData)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Mercado Pago API error:', data);
            return NextResponse.json({ 
                success: false, 
                message: data.message || 'Error creating payment preference' 
            }, { status: response.status });
        }

        return NextResponse.json({
            success: true,
            preferenceId: data.id,
            initPoint: data.init_point,
            sandboxInitPoint: data.sandbox_init_point
        });

    } catch (error: any) {
        console.error('Billing Route Exception:', error);
        return NextResponse.json({ 
            success: false, 
            message: error.message || 'Internal server error' 
        }, { status: 500 });
    }
}
