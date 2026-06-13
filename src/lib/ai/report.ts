/**
 * Convierte un bloque `report` ({title, tables, charts, analysis}) — el formato que emite
 * el agente por WhatsApp — a Markdown, para reusar la vista compartible
 * (AgentShareView) que ya renderiza tablas Markdown y bloques ```chart.
 */

interface ReportTable { title?: string; columns: string[]; rows: any[][]; }
interface ReportChart { type: string; title?: string; format?: string; data: any[]; seriesLabels?: string[]; }
export interface AgentReport {
    title?: string | null;
    tables?: ReportTable[];
    charts?: ReportChart[];
    /** Texto de análisis completo (markdown) generado por el agente. */
    analysis?: string | null;
}

function cell(v: any): string {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return v.toLocaleString('es-MX');
    return String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function reportToMarkdown(report: AgentReport): string {
    let md = '';
    if (report.title) md += `## ${report.title}\n\n`;

    // Texto de análisis completo (puede incluir markdown enriquecido del agente)
    if (report.analysis) {
        md += `${report.analysis}\n\n`;
    }

    for (const t of report.tables || []) {
        if (!t || !Array.isArray(t.columns) || t.columns.length === 0) continue;
        if (t.title) md += `**${t.title}**\n\n`;
        md += `| ${t.columns.map(c => String(c)).join(' | ')} |\n`;
        md += `| ${t.columns.map(() => '---').join(' | ')} |\n`;
        for (const row of (t.rows || [])) {
            const cells = Array.isArray(row) ? row : [row];
            md += `| ${cells.map(cell).join(' | ')} |\n`;
        }
        md += '\n';
    }

    for (const c of report.charts || []) {
        if (!c || !Array.isArray(c.data) || c.data.length === 0) continue;
        md += '```chart\n' + JSON.stringify(c) + '\n```\n\n';
    }

    return md.trim();
}

export function reportHasContent(report: AgentReport | null | undefined): boolean {
    if (!report) return false;
    const hasTables   = Array.isArray(report.tables) && report.tables.some(t => t?.columns?.length);
    const hasCharts   = Array.isArray(report.charts) && report.charts.some(c => c?.data?.length);
    const hasAnalysis = typeof report.analysis === 'string' && report.analysis.trim().length > 0;
    return hasTables || hasCharts || hasAnalysis;
}
