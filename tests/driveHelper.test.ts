import { describe, it, expect } from 'vitest';
import { DriveHelper } from '../src/driveHelper';

describe('DriveHelper - Google Drive Parsing & CDN Link Generator', () => {
  it('extracts File ID from standard /file/d/{id}/view link', () => {
    const url = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';
    const id = DriveHelper.extractFileId(url);
    expect(id).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('extracts File ID from id parameter link', () => {
    const url = 'https://drive.google.com/uc?export=download&id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    const id = DriveHelper.extractFileId(url);
    expect(id).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('extracts File ID from googleusercontent link', () => {
    const url = 'https://lh3.googleusercontent.com/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms=w1000';
    const id = DriveHelper.extractFileId(url);
    expect(id).toBe('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('preserves raw Drive File ID', () => {
    const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    const id = DriveHelper.extractFileId(rawId);
    expect(id).toBe(rawId);
  });

  it('returns null for invalid inputs', () => {
    expect(DriveHelper.extractFileId('')).toBeNull();
    expect(DriveHelper.extractFileId(null)).toBeNull();
    expect(DriveHelper.extractFileId('https://example.com/image.png')).toBeNull();
  });

  it('extracts Folder ID from /drive/folders/{id}', () => {
    const url = 'https://drive.google.com/drive/folders/1ABC_xyz-1234567890abcdefghijklmnopqrst';
    const folderId = DriveHelper.extractFolderId(url);
    expect(folderId).toBe('1ABC_xyz-1234567890abcdefghijklmnopqrst');
  });

  it('parses batch text inputs and removes duplicates', () => {
    const batchInput = `
      https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view
      1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
      https://drive.google.com/file/d/2CyiNWt1YSB6oGNeLwCeCakhnVUrqumct85PhwF3vqnt/view
    `;
    const ids = DriveHelper.parseBatchInput(batchInput);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual([
      '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      '2CyiNWt1YSB6oGNeLwCeCakhnVUrqumct85PhwF3vqnt'
    ]);
  });

  it('generates multi-tier CDN URLs correctly', () => {
    const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    const urls = DriveHelper.getImageUrls(fileId, 800);

    expect(urls.primary).toBe(`https://lh3.googleusercontent.com/d/${fileId}=w800`);
    expect(urls.fallback1).toBe(`https://drive.google.com/thumbnail?id=${fileId}&sz=w800`);
    expect(urls.fallback2).toBe(`https://drive.google.com/uc?export=view&id=${fileId}`);
    expect(urls.fallback3).toBe(`https://drive.google.com/uc?export=download&id=${fileId}`);
  });

  it('validates safe image URLs correctly', () => {
    expect(DriveHelper.isValidImageUrl('https://example.com/image.png')).toBe(true);
    expect(DriveHelper.isValidImageUrl('http://example.com/image.jpg')).toBe(true);
    expect(DriveHelper.isValidImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(DriveHelper.isValidImageUrl('javascript:alert(1)')).toBe(false);
    expect(DriveHelper.isValidImageUrl('blob:http://evil.com/123')).toBe(false);
    expect(DriveHelper.isValidImageUrl('')).toBe(false);
    expect(DriveHelper.isValidImageUrl(null)).toBe(false);
  });

  it('returns empty URLs for invalid fileId in getImageUrls', () => {
    const urls = DriveHelper.getImageUrls('invalid!id$');
    expect(urls.primary).toBe('');
    expect(urls.fallback1).toBe('');
  });
});
