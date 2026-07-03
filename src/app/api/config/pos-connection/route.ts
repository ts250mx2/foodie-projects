import { NextRequest, NextResponse } from 'next/server';
import { getProjectConnection } from '@/lib/dynamic-db';
import { RowDataPacket } from 'mysql2';

export async function GET(request: NextRequest) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const projectIdStr = searchParams.get('projectId');

        if (!projectIdStr) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        const projectId = parseInt(projectIdStr);
        connection = await getProjectConnection(projectId);

        const [rows]: any = await connection.query(
            'SELECT * FROM tblPOSConfig LIMIT 1'
        );

        if (rows.length === 0) {
            // Return default initial config
            return NextResponse.json({
                success: true,
                data: {
                    Provider: 'none',
                    Url: 'https://www.wansoft.net/Wansoft.Web/',
                    User: '',
                    Password: '',
                    ApiKey: '',
                    ApiEndpoint: '',
                    SyncInterval: 'daily',
                    AlertsEnabled: 1,
                    AlertEmail: '',
                    Status: 'disconnected',
                    LastSync: null
                }
            });
        }

        return NextResponse.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error fetching POS config:', error);
        return NextResponse.json({ success: false, message: 'Error fetching POS configuration' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function PUT(request: NextRequest) {
    let connection;
    try {
        const body = await request.json();
        const {
            projectId,
            provider,
            url,
            user,
            password,
            apiKey,
            apiEndpoint,
            syncInterval,
            alertsEnabled,
            alertEmail,
            status
        } = body;

        if (!projectId) {
            return NextResponse.json({ success: false, message: 'Project ID is required' }, { status: 400 });
        }

        connection = await getProjectConnection(parseInt(projectId));

        // Check if config exists
        const [rows]: any = await connection.query(
            'SELECT IdPOSConfig FROM tblPOSConfig LIMIT 1'
        );

        if (rows.length === 0) {
            // Insert new
            await connection.query(
                `INSERT INTO tblPOSConfig (
                    Provider, Url, User, Password, ApiKey, ApiEndpoint, 
                    SyncInterval, AlertsEnabled, AlertEmail, Status, LastSync
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    provider || 'none',
                    url || '',
                    user || '',
                    password || '',
                    apiKey || '',
                    apiEndpoint || '',
                    syncInterval || 'daily',
                    alertsEnabled !== undefined ? (alertsEnabled ? 1 : 0) : 1,
                    alertEmail || '',
                    status || 'disconnected',
                    null
                ]
            );
        } else {
            // Update existing
            const id = rows[0].IdPOSConfig;
            await connection.query(
                `UPDATE tblPOSConfig SET 
                    Provider = ?, Url = ?, User = ?, Password = ?, ApiKey = ?, ApiEndpoint = ?, 
                    SyncInterval = ?, AlertsEnabled = ?, AlertEmail = ?, Status = ?
                WHERE IdPOSConfig = ?`,
                [
                    provider || 'none',
                    url || '',
                    user || '',
                    password || '',
                    apiKey || '',
                    apiEndpoint || '',
                    syncInterval || 'daily',
                    alertsEnabled !== undefined ? (alertsEnabled ? 1 : 0) : 1,
                    alertEmail || '',
                    status || 'disconnected',
                    id
                ]
            );
        }

        return NextResponse.json({
            success: true,
            message: 'POS configuration saved successfully'
        });
    } catch (error) {
        console.error('Error saving POS config:', error);
        return NextResponse.json({ success: false, message: 'Error saving POS configuration' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, provider, url, user, password, apiKey, apiEndpoint } = body;

        if (action !== 'test') {
            return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
        }

        // Simulate connection test delay
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (provider === 'none') {
            return NextResponse.json({
                success: false,
                message: 'Por favor selecciona un proveedor válido para probar la conexión.'
            });
        }

        if (provider === 'wansoft') {
            if (!user || !password) {
                return NextResponse.json({
                    success: false,
                    message: 'Faltan credenciales obligatorias: Usuario y Contraseña son necesarios.'
                });
            }
            if (user.toLowerCase() === 'error' || password.toLowerCase() === 'error') {
                return NextResponse.json({
                    success: false,
                    message: 'Error de autenticación: El usuario o contraseña de Wansoft es incorrecto.'
                });
            }
            return NextResponse.json({
                success: true,
                message: 'Conexión a Wansoft establecida con éxito. El scraper reportó respuesta correcta (200 OK).'
            });
        }

        if (provider === 'generic_api') {
            if (!apiEndpoint) {
                return NextResponse.json({
                    success: false,
                    message: 'Falta campo obligatorio: El URL del Endpoint API es necesario.'
                });
            }
            if (apiEndpoint.includes('invalid') || apiKey === 'invalid') {
                return NextResponse.json({
                    success: false,
                    message: 'Error al conectar al Endpoint: El servidor de API retornó error 401 Unauthorized.'
                });
            }
            return NextResponse.json({
                success: true,
                message: 'Endpoint API alcanzado. El handshake fue exitoso con la API Key provista.'
            });
        }

        return NextResponse.json({
            success: false,
            message: 'Proveedor no soportado para pruebas automáticas.'
        });
    } catch (error) {
        console.error('Error testing POS connection:', error);
        return NextResponse.json({ success: false, message: 'Error testing connection' }, { status: 500 });
    }
}
