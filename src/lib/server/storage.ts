import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
const root = () => process.env.VELA_DATA_DIR || join(process.cwd(), '.data');
export async function saveRecord<T>(kind: 'receipts' | 'previews', id: string, value: T) {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(id)) throw new Error('Invalid record ID.');
  const dir = join(root(), kind); await mkdir(dir, { recursive: true });
  const target = join(dir, `${id}.json`), temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await rename(temp, target);
}
export async function readRecord<T>(kind: 'receipts' | 'previews', id: string): Promise<T> {
  if (!/^[a-zA-Z0-9-]{8,100}$/.test(id)) throw new Error('Invalid record ID.');
  return JSON.parse(await readFile(join(root(), kind, `${id}.json`), 'utf8')) as T;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function digest(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
