import { createRequire } from 'node:module';
import path from 'node:path';

import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export const runtime = 'nodejs';

// Pre-provide the worker so pdf.js doesn't try to dynamically load it (that
// dynamic load is what breaks in a bundled serverless function).
globalThis.pdfjsWorker = pdfjsWorker;

// pdf.js reads CMap and standard-font data from disk for PDFs that use CID /
// non-Latin / non-embedded fonts. Resolve the on-disk locations once. These
// dirs are force-included in the Vercel bundle via outputFileTracingIncludes.
const require = createRequire(import.meta.url);
let PDF_DATA_URLS = null;
try {
  const pkgRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  PDF_DATA_URLS = {
    cMapUrl: path.join(pkgRoot, 'cmaps') + '/',
    standardFontDataUrl: path.join(pkgRoot, 'standard_fonts') + '/',
  };
} catch {
  PDF_DATA_URLS = null;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';
const PDF_MIME = 'application/pdf';
const TEXT_MIME = 'text/plain';

// Vercel serverless functions reject request bodies larger than ~4.5 MB before
// our code ever runs. Cap below that so oversized uploads get a clear message
// instead of an opaque platform error. The client enforces the same limit.
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4 MB

const FALLBACK_MIME_TYPES = new Set(['application/octet-stream', '']);
const SUPPORTED_MIME_TYPES_BY_EXTENSION = {
  '.txt': new Set([TEXT_MIME, ...FALLBACK_MIME_TYPES]),
  '.pdf': new Set([PDF_MIME, ...FALLBACK_MIME_TYPES]),
  '.docx': new Set([
    DOCX_MIME,
    'application/zip',
    'application/x-zip-compressed',
    ...FALLBACK_MIME_TYPES,
  ]),
  '.doc': new Set([DOC_MIME, ...FALLBACK_MIME_TYPES]),
};

function getExtension(name = '') {
  const dotIndex = name.lastIndexOf('.');
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : '';
}

function isSupportedUpload(extension, mimeType) {
  const allowedTypes = SUPPORTED_MIME_TYPES_BY_EXTENSION[extension];
  return Boolean(allowedTypes && allowedTypes.has(mimeType));
}

function normalizeText(text = '') {
  // Normalize newlines and strip NUL bytes (which some PDFs emit).
  return text.replace(/\r\n/g, '\n').replace(/\x00/g, '').trim();
}

async function extractTextFromPdf(file) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    ...(PDF_DATA_URLS
      ? {
          cMapUrl: PDF_DATA_URLS.cMapUrl,
          cMapPacked: true,
          standardFontDataUrl: PDF_DATA_URLS.standardFontDataUrl,
        }
      : {}),
  });

  try {
    const pdf = await task.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
      page.cleanup();
    }

    await pdf.destroy();
    return pages.join('\n\n');
  } finally {
    await task.destroy();
  }
}

async function extractTextFromDocx(file) {
  const { value } = await mammoth.extractRawText({
    buffer: Buffer.from(await file.arrayBuffer()),
  });

  return value;
}

export async function POST(request) {
  let file;

  try {
    const formData = await request.formData();
    file = formData.get('file');
  } catch {
    return Response.json(
      { error: 'Upload failed while reading the file. It may be too large — the limit is 4 MB.' },
      { status: 413 },
    );
  }

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file provided.' }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return Response.json(
      { error: 'File is too large. The limit is 4 MB. For longer documents, paste the text directly.' },
      { status: 413 },
    );
  }

  const extension = getExtension(file.name);
  if (extension === '.doc') {
    return Response.json(
      { error: 'Legacy .doc files are not supported. Please re-save the document as .docx (or PDF) and upload it again.' },
      { status: 400 },
    );
  }

  if (!isSupportedUpload(extension, file.type)) {
    return Response.json(
      { error: `Unsupported file type${file.type ? ` (${file.type})` : ''}. Upload a PDF, DOCX, or TXT file.` },
      { status: 400 },
    );
  }

  let text = '';

  try {
    if (extension === '.pdf') {
      text = await extractTextFromPdf(file);
    } else if (extension === '.docx') {
      text = await extractTextFromDocx(file);
    } else {
      text = await file.text();
    }
  } catch (err) {
    // Surface the real cause in Vercel logs; keep the client message friendly.
    console.error(`[extract] failed to parse ${extension} "${file.name}":`, err);
    const friendly =
      extension === '.pdf'
        ? 'Could not read that PDF. It may be password-protected, corrupted, or a scan with no selectable text.'
        : 'Could not read that document. It may be corrupted or in an unexpected format.';
    return Response.json({ error: friendly }, { status: 422 });
  }

  const normalized = normalizeText(text);
  if (!normalized) {
    const emptyMsg =
      extension === '.pdf'
        ? 'No selectable text was found. If this is a scanned PDF, the pages are images — paste the text instead.'
        : 'No readable text was found in that document.';
    return Response.json({ error: emptyMsg }, { status: 422 });
  }

  return Response.json({
    fileName: file.name,
    text: normalized,
    wordCount: normalized.split(/\s+/).filter(Boolean).length,
  });
}
