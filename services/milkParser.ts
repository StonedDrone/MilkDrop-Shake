
import { MilkPreset } from '../types';

export const parseMilkFile = (content: string, fileName: string): MilkPreset => {
  const lines = content.split(/\r?\n/);
  const metadata: Record<string, string> = {};
  const perFrame: string[] = [];
  const perPixel: string[] = [];
  const warps: string[] = [];
  const comp: string[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return;

    if (trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
      
      if (key.startsWith('per_frame')) {
        perFrame.push(value);
      } else if (key.startsWith('per_pixel')) {
        perPixel.push(value);
      } else if (key.startsWith('warp')) {
        warps.push(value);
      } else if (key.startsWith('comp')) {
        comp.push(value);
      } else {
        metadata[key.trim()] = value.trim();
      }
    }
  });

  return {
    id: crypto.randomUUID(),
    name: fileName.replace('.milk', ''),
    rawContent: content,
    metadata,
    perFrame,
    perPixel,
    warps,
    comp
  };
};
