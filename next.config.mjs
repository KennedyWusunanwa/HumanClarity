/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep these out of the server bundle so their dynamic requires, worker file,
  // and on-disk data files (cmaps / standard fonts) resolve from node_modules at
  // runtime instead of being mangled by the bundler. Without this, PDF/DOCX text
  // extraction works locally but fails on Vercel.
  serverExternalPackages: ['pdfjs-dist', 'mammoth'],
  // pdf.js loads CMap and standard-font data from disk at runtime via fs. Those
  // files aren't statically referenced, so force-include them in the serverless
  // function bundle or PDFs with CID/non-Latin fonts fail to extract.
  outputFileTracingIncludes: {
    '/api/extract': [
      './node_modules/pdfjs-dist/cmaps/**/*',
      './node_modules/pdfjs-dist/standard_fonts/**/*',
      './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
    ],
  },
};

export default nextConfig;
