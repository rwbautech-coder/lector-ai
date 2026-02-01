import * as pdfjsLib from 'pdfjs-dist';
// Vite handles the ?url suffix to bundle the worker file for offline use
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export const extractTextFromPdf = async (source: Blob): Promise<string> => {
  try {
    const arrayBuffer = await source.arrayBuffer();
    
    // Load the document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';
    const numPages = pdf.numPages;

    // Iterate through all pages
    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Combine text items. We add a space between items to avoid merging words,
      // and double newlines after each page to preserve structure.
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      
      // Basic heuristic: if the page text is very short, it might be a blank page or just an image
      if (pageText.trim().length > 0) {
          fullText += pageText + '\n\n';
      }
    }

    return fullText;
  } catch (error) {
    console.error("Error parsing PDF:", error);
    throw new Error("Failed to read PDF file. It might be password protected or scanned images only.");
  }
};