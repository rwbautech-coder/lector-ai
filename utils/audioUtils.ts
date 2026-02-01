import { Page, TextChunk, Chapter } from '../types';

// Base64 decoding utility
function atob_custom(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Converts raw PCM base64 string (from Gemini) to a Float32Array.
 */
export function base64ToPcm(base64Data: string): Float32Array {
  const bytes = atob_custom(base64Data);
  const dataInt16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(dataInt16.length);
  
  for (let i = 0; i < dataInt16.length; i++) {
    // Convert Int16 to Float32 (-1.0 to 1.0)
    float32[i] = dataInt16[i] / 32768.0;
  }
  return float32;
}

/**
 * Wraps Float32Array PCM data into a valid WAV Blob.
 */
export function createWavBlob(samples: Float32Array, sampleRate: number = 24000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  const length = samples.length;
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

// Helper to chunk text intelligently by sentences
export function chunkText(text: string, maxChars: number = 500): string[] {
  // Preserve newlines to help with paragraph detection later if needed
  // But for TTS chunks, we generally want clean text.
  // We will split by sentence endings.
  const sentenceRegex = /[^.!?\n]+[.!?\n]+(\s+|$)/g;
  const matches = text.match(sentenceRegex) || [text];
  
  const chunks: string[] = [];
  let currentChunk = '';

  for (const match of matches) {
    // If a single sentence is huge, split it
    if (match.length > maxChars) {
       if (currentChunk.trim()) chunks.push(currentChunk.trim());
       currentChunk = '';
       
       // Brute force split large sentence
       let temp = match;
       while(temp.length > 0) {
           chunks.push(temp.substring(0, maxChars).trim());
           temp = temp.substring(maxChars);
       }
    } else if (currentChunk.length + match.length > maxChars) {
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = match;
    } else {
      currentChunk += match;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Groups TextChunks into "Pages" based on character count and paragraph logic.
 * Target: ~1800 characters per page (standard book page).
 * Break: Prefer breaks at chunks that look like end of paragraphs.
 */
export function organizePages(chunks: TextChunk[]): { pages: Page[], chapters: Chapter[] } {
  const CHARS_PER_PAGE = 1800;
  const pages: Page[] = [];
  const chapters: Chapter[] = [];
  
  let currentPageChunks: TextChunk[] = [];
  let currentPageCharCount = 0;
  let pageStartIndex = 0;

  // Regex to detect Chapter headings in text
  // Matches: "Chapter 1", "Rozdział I", "1.", "I.", or all CAPS title if short
  const chapterRegex = /^(chapter|rozdział|part|część)\s+[ivxlcdm\d]+|^[ivxlcdm\d]+\.$/i;

  chunks.forEach((chunk, index) => {
    // Check for Chapter Start
    const isChapter = chapterRegex.test(chunk.text.trim()) || (chunk.text.length < 50 && chunk.text.toUpperCase() === chunk.text && /[a-z]/i.test(chunk.text));
    
    if (isChapter) {
        // If we have content and hit a chapter, force a new page unless the page is very empty
        if (currentPageChunks.length > 0 && currentPageCharCount > 200) {
            pages.push({
                id: pages.length,
                chunks: currentPageChunks,
                startChunkIndex: pageStartIndex,
                endChunkIndex: index - 1,
                contentDisplay: currentPageChunks.map(c => c.text).join(' ')
            });
            currentPageChunks = [];
            currentPageCharCount = 0;
            pageStartIndex = index;
        }
        
        // Add to chapters list
        chapters.push({
            title: chunk.text.trim().substring(0, 40), // Truncate long titles
            pageIndex: pages.length, // It will be the start of the next page object pushed
            chunkIndex: index
        });
    }

    currentPageChunks.push(chunk);
    currentPageCharCount += chunk.text.length;

    // Check if page is full
    // We try to avoid breaking if the last chunk doesn't look like a sentence end, 
    // but chunkText ensures chunks are sentences. 
    // We prefer to break if the chunk has a newline char (paragraph end) if available in raw text 
    // (though chunkText cleans it).
    // Simple logic: If > limit, break.
    if (currentPageCharCount >= CHARS_PER_PAGE) {
        pages.push({
            id: pages.length,
            chunks: currentPageChunks,
            startChunkIndex: pageStartIndex,
            endChunkIndex: index,
            contentDisplay: currentPageChunks.map(c => c.text).join(' ')
        });
        currentPageChunks = [];
        currentPageCharCount = 0;
        pageStartIndex = index + 1;
    }
  });

  // Push remaining
  if (currentPageChunks.length > 0) {
      pages.push({
          id: pages.length,
          chunks: currentPageChunks,
          startChunkIndex: pageStartIndex,
          endChunkIndex: chunks.length - 1,
          contentDisplay: currentPageChunks.map(c => c.text).join(' ')
      });
  }

  return { pages, chapters };
}