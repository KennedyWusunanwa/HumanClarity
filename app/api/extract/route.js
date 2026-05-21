import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

export const runtime = 'nodejs';

globalThis.pdfjsWorker = pdfjsWorker;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME = 'application/msword';
const PDF_MIME = 'application/pdf';
const TEXT_MIME = 'text/plain';

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
  return text.replace(/\r\n/g, '\n').replace(/\u0000/g, '').trim();
}

async function extractTextFromPdf(file) {
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useWorkerFetch: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
  });

  try {
    const pdf = await task.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(' '));
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
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return Response.json({ error: 'No file provided.' }, { status: 400 });
    }

    const extension = getExtension(file.name);
    if (extension === '.doc') {
      return Response.json(
        { error: 'Legacy .doc files are not supported yet. Please save the document as .docx and upload it again.' },
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

    if (extension === '.pdf') {
      text = await extractTextFromPdf(file);
    } else if (extension === '.docx') {
      text = await extractTextFromDocx(file);
    } else {
      text = await file.text();
    }

    const normalized = normalizeText(text);
    if (!normalized) {
      return Response.json(
        { error: 'No readable text was found in that document.' },
        { status: 400 },
      );
    }

    return Response.json({
      fileName: file.name,
      text: normalized,
      wordCount: normalized.split(/\s+/).filter(Boolean).length,
    });
  } catch (err) {
    return Response.json(
      { error: err.message ?? 'Failed to extract text from the uploaded file.' },
      { status: err.status ?? 500 },
    );
  }
}
