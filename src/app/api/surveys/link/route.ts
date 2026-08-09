import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSurveyUuid, rotateSurveyUuid } from '@/lib/surveys';

/**
 * Liga de la encuesta para tablet. La consume el portal para pintar el QR.
 * El UUID se genera la primera vez que alguien pide la liga.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');
        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const uuid = await getOrCreateSurveyUuid(parseInt(projectIdStr));
        if (!uuid) {
            return NextResponse.json({ success: false, message: 'Proyecto no encontrado' }, { status: 404 });
        }

        return NextResponse.json({ success: true, uuid });
    } catch (error) {
        console.error('Error resolving survey link:', error);
        return NextResponse.json({ success: false, message: 'Error obteniendo la liga' }, { status: 500 });
    }
}

/** Rota el UUID: la liga anterior deja de funcionar (tablet perdida o robada). */
export async function POST(request: NextRequest) {
    try {
        const { projectId } = await request.json();
        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const uuid = await rotateSurveyUuid(parseInt(projectId));
        return NextResponse.json({ success: true, uuid });
    } catch (error) {
        console.error('Error rotating survey link:', error);
        return NextResponse.json({ success: false, message: 'Error regenerando la liga' }, { status: 500 });
    }
}
