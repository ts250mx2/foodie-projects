/**
 * Exporta un nodo del DOM completo (incluyendo gráficas SVG de recharts) a un PDF
 * multipágina. Captura el render real con html-to-image y lo pagina en A4.
 *
 * Se usa en el visor de reportes (Mis Reportes) y en el agente para que el PDF
 * incluya TODO lo visible: tarjetas KPI, gráficas, hallazgos y tablas.
 *
 * Carga jsPDF y html-to-image en demanda (lazy) para no inflar el bundle inicial.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

export async function exportElementToPdf(el: HTMLElement, filename: string): Promise<void> {
    const [htmlToImage, jsPDFmod] = await Promise.all([
        import('html-to-image'),
        import('jspdf'),
    ]);
    const JsPDF = jsPDFmod.default;

    // Captura a 2x para nitidez. Fondo blanco para evitar transparencias.
    const dataUrl = await htmlToImage.toPng(el, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
    });

    const img = await loadImage(dataUrl);
    const doc = new JsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Imagen a ancho completo de página; se pagina con offset vertical negativo.
    const imgW = pageW;
    const imgH = (img.height * imgW) / img.width;

    let heightLeft = imgH;
    let position = 0;
    doc.addImage(dataUrl, 'PNG', 0, position, imgW, imgH, undefined, 'FAST');
    heightLeft -= pageH;

    while (heightLeft > 0) {
        position -= pageH;
        doc.addPage();
        doc.addImage(dataUrl, 'PNG', 0, position, imgW, imgH, undefined, 'FAST');
        heightLeft -= pageH;
    }

    doc.save(filename);
}
