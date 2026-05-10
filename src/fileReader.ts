import mammoth from 'mammoth';

const textFileTypes = new Set(['text/plain', 'text/markdown', 'text/x-markdown']);
const textExtensions = new Set(['txt', 'md', 'markdown']);

export async function extractTextFromFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (textFileTypes.has(file.type) || textExtensions.has(extension)) {
    return file.text();
  }

  throw new Error('Upload venligst en .docx-, .md- eller .txt-fil.');
}
