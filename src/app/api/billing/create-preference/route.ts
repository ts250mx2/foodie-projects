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

        // Construct dynamic origin for default callbacks if not provided
        const origin = request.headers.get('origin') || 'http://localhost:3006';

        // Payment preferences details
        const paymentData = {
            items: [
                {
                    id: "foodie-guru-monthly-sub",
                    title: "Suscripción Mensual Foodie Guru",
                    description: "Acceso Premium a la plataforma de Foodie Guru",
                    quantity: 1,
                    unit_price: 499.00, // Monto por defecto: $499 MXN
                    currency_id: "MXN",
                    category_id: "services"
                }
            ],
            back_urls: {
                success: successUrl || `${origin}/dashboard?payment=success`,
                failure: failureUrl || `${origin}/dashboard?payment=failure`,
                pending: pendingUrl || `${origin}/dashboard?payment=pending`
            },
            auto_return: "approved",
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
