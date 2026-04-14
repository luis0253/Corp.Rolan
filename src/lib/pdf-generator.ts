// src/lib/pdf-generator.ts
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { renderToStaticMarkup } from 'react-dom/server';
import { PdfTemplate } from '@/components/pdf-template';
import type { QuoteResult } from '@/types';

export const generateQuotePdf = async (quoteData: QuoteResult, clientName: string) => {
    // Create a container for our React component
    const container = document.createElement('div');
    container.innerHTML = renderToStaticMarkup(PdfTemplate({ quote: quoteData, clientName }));
    
    // The template is designed to be A4 size (approx. 794px width)
    container.style.width = '794px';
    container.style.position = 'absolute';
    container.style.top = '-9999px'; // Render off-screen
    document.body.appendChild(container);

    // Use html2canvas to capture the component
    const canvas = await html2canvas(container, {
        scale: 2, // Increase resolution for better quality
        useCORS: true,
        logging: false,
    });

    // Remove the temporary container
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    
    // Create PDF
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4', // A4 dimensions: 595 x 842 pt (or px)
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const ratio = canvasWidth / canvasHeight;
    const newCanvasHeight = pdfWidth / ratio;
    
    // Check if the content fits on one page, if not, it will be scaled down
    const finalHeight = newCanvasHeight > pdfHeight ? pdfHeight : newCanvasHeight;
    const finalWidth = finalHeight * ratio;

    pdf.addImage(imgData, 'PNG', 0, 0, finalWidth, finalHeight);
    
    // Generate a file name
    const fileName = `Cotizacion Rolan - ${clientName || quoteData.vehicleName}.pdf`;

    // Save the PDF
    pdf.save(fileName);
};
