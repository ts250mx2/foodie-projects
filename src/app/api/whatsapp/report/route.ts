import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getShare } from '@/lib/ai/shares';

/**
 * GET /api/whatsapp/report?r=<token>   (también acepta ?token=)
 *
 * Devuelve, en JSON, el reporte (título + tablas + gráficas) que generó el agente de
 * WhatsApp (`/api/whatsapp/ask`) y se guardó como liga compartible en BDFoodieProjects.
 * Mismo propósito que el `whatsapp/report` de Integra Gym: que un bridge de WhatsApp
 * pueda consumir el detalle sin abrir la página `/r/<token>`.
 *
 * El contenido se guarda como Markdown (encabezado `##`, tablas GFM y bloques
 * ```chart`); aquí se reconstruye a estructura. Público por token impredecible.
 */

function splitRow(line: string): string[] {
    let s = line.trim();
    if (s.startsWith('|')) s = s.slice(1);
    if (s.endsWith('|')) s = s.slice(0, -1);
    return s.split('|').map(c => c.replace(/\\\|/g, '|').trim());
}
const isSeparator = (l: string) =>
    l.includes('|') && splitRow(l).every(c => /^:?-{2,}:?$/.test(c.replace(/\s/g, '')) || c === '');

function parseTables(md: string): { title?: string; columns: string[]; rows: string[][] }[] {
    const lines = md.replace(/\r/g, '').split('\n');
    const tables: { title?: string; columns: string[]; rows: string[][] }[] = [];
    let pendingTitle: string | undefined;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const bold = line.match(/^\*\*(.+)\*\*\s*$/);
        if (bold) { pendingTitle = bold[1].trim(); continue; }
        if (line.includes('|') && i + 1 < lines.length && isSeparator(lines[i + 1])) {
            const columns = splitRow(line);
            const rows: string[][] = [];
            let j = i + 2;
            while (j < lines.length && lines[j].includes('|') && lines[j].trim() !== '' && !isSeparator(lines[j])) {
                rows.push(splitRow(lines[j])); j++;
            }
            tables.push({ title: pendingTitle, columns, rows });
            pendingTitle = undefined;
            i = j - 1;
        } else if (line.trim() !== '' && !line.startsWith('##') && !line.startsWith('```')) {
            pendingTitle = undefined;
        }
    }
    return tables;
}

function parseCharts(md: string): any[] {
    const out: any[] = [];
    const re = /```chart\s*\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md))) {
        try { out.push(JSON.parse(m[1].trim())); } catch { /* bloque inválido: ignora */ }
    }
    return out;
}

export async function GET(req: Request) {
    try {
        const sp = new URL(req.url).searchParams;
        const token = sp.get('r') || sp.get('token');
        if (!token) {
            return NextResponse.json({ error: 'Falta el parámetro r (token)' }, { status: 400 });
        }

        const share = await getShare(token);
        if (!share) {
            return NextResponse.json({ error: 'Reporte no encontrado o expirado' }, { status: 404 });
        }

        let projectName = '';
        if (share.projectId) {
            try {
                const [rows]: any = await pool.query('SELECT Proyecto FROM tblProyectos WHERE IdProyecto = ?', [share.projectId]);
                projectName = rows?.[0]?.Proyecto || '';
            } catch { /* noop */ }
        }

        const content = share.content || '';
        const charts = parseCharts(content);
        const tables = parseTables(content);
        const titleMatch = content.match(/^##\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : (charts[0]?.title || null);

        return NextResponse.json({
            token: share.token,
            title,
            question: share.question || '',
            projectName,
            branchName: share.branchName || '',
            fecha: share.createdAt,
            tables,
            charts,
            markdown: content,
        });
    } catch (e: any) {
        console.error('[whatsapp/report] error:', e);
        return NextResponse.json({ error: 'Error al cargar el reporte', detail: e?.message }, { status: 500 });
    }
}
