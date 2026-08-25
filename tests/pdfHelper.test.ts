import { describe, it, expect } from 'vitest';
import { PdfHelper } from '../src/pdfHelper';

describe('PdfHelper - PDF and Drive Detection & Sanitization', () => {
  it('detects standard PDF URLs and data URIs', () => {
    expect(PdfHelper.isPdfSource('https://example.com/chapter1.pdf')).toBe(true);
    expect(PdfHelper.isPdfSource('https://example.com/document.pdf?token=123')).toBe(true);
    expect(PdfHelper.isPdfSource('https://drive.google.com/file/d/123/chapter.pdf')).toBe(true);
    expect(PdfHelper.isPdfSource('data:application/pdf;base64,JVBERi0x...')).toBe(true);
  });

  it('does not misidentify standard Drive image links or IDs as PDFs', () => {
    expect(PdfHelper.isPdfSource('https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view')).toBe(false);
    expect(PdfHelper.isPdfSource('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms')).toBe(false);
    expect(PdfHelper.isPdfSource('https://example.com/cover.jpg')).toBe(false);
  });

  it('generates correct embed and download URLs for valid file IDs', () => {
    const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    expect(PdfHelper.getDrivePdfEmbedUrl(fileId)).toBe(`https://drive.google.com/file/d/${fileId}/preview`);
    expect(PdfHelper.getDrivePdfDownloadUrl(fileId)).toBe(`https://drive.google.com/uc?export=download&id=${fileId}`);
  });

  it('returns empty string for invalid file IDs', () => {
    expect(PdfHelper.getDrivePdfEmbedUrl('invalid!id$')).toBe('');
    expect(PdfHelper.getDrivePdfDownloadUrl('invalid!id$')).toBe('');
  });
});
