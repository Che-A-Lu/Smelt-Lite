import JSZip from 'jszip';
import type { ManifestJSON, EditEntry, ProvenanceEntry } from '../foundation/types';
import { verifySignature } from './identity';

export type SigStatus = 'valid' | 'broken' | 'unverifiable';

export interface ImportedCardFile {
  name: string;
  size: number;
  blob: Blob;
  encrypted: boolean;
}

export interface ImportedCard {
  manifest: ManifestJSON;
  edits: EditEntry[];
  files: ImportedCardFile[];
  signatureResults: { entry: ProvenanceEntry; status: SigStatus }[];
}

export async function parseCardFile(file: File): Promise<ImportedCard> {
  const zip = await JSZip.loadAsync(file);

  const entries = Object.values(zip.files).filter(f => !f.dir);
  if (entries.length > 1000) throw new Error('Too many files in .card (max 1000)');

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('manifest.json not found');
  const manifestText = await manifestFile.async('string');
  const manifest: ManifestJSON = JSON.parse(manifestText);

  let edits: EditEntry[] = [];
  const editsFile = zip.file('edits.json');
  if (editsFile) {
    const editsText = await editsFile.async('string');
    edits = JSON.parse(editsText);
  }

  const signatureResults: ImportedCard['signatureResults'] = [];
  const sigFile = zip.file('signature.json');
  if (sigFile) {
    const sigText = await sigFile.async('string');
    const sigEntries: ProvenanceEntry[] = JSON.parse(sigText);
    for (const entry of sigEntries) {
      if (entry.pubKey) {
        const entryToVerify = {
          action: entry.action,
          who: entry.who,
          when: entry.when,
          what: entry.what,
          pubKey: entry.pubKey,
        };
        const contentHash = await sha256(JSON.stringify(entryToVerify));
        const valid = await verifySignature(contentHash, entry.signature, entry.pubKey as JsonWebKey);
        signatureResults.push({ entry, status: valid ? 'valid' : 'broken' });
      } else {
        signatureResults.push({ entry, status: 'unverifiable' });
      }
    }
  }

  const cardFiles: ImportedCardFile[] = [];
  const artifactsFolder = zip.folder('artifacts');
  if (artifactsFolder) {
    const fileEntries = Object.values(artifactsFolder.files).filter(f => !f.dir);
    let totalSize = 0;
    for (const entry of fileEntries) {
      const data = await entry.async('uint8array');
      totalSize += data.byteLength;
      if (totalSize > 100 * 1024 * 1024) throw new Error('Uncompressed size exceeds 100MB');
      const name = entry.name.replace(/^artifacts\//, '');
      const encrypted = name.endsWith('.enc');
      const blob = new Blob([data] as unknown as BlobPart[]);
      cardFiles.push({ name, size: data.byteLength, blob, encrypted });
    }
  }

  const actualNames = new Set(cardFiles.map(f => f.name));
  for (const name of manifest.files) {
    if (!actualNames.has(name)) {
      console.warn(`File "${name}" declared in manifest but missing in artifacts/`);
    }
  }

  return { manifest, edits, files: cardFiles, signatureResults };
}

export async function decryptCardFiles(
  files: ImportedCardFile[],
  password: string,
): Promise<ImportedCardFile[]> {
  const result: ImportedCardFile[] = [];
  for (const f of files) {
    if (f.encrypted) {
      const buf = await f.blob.arrayBuffer();
      const decrypted = await decryptAES(buf, password);
      const name = f.name.replace(/\.enc$/, '');
      result.push({
        name,
        size: decrypted.byteLength,
        blob: new Blob([decrypted]),
        encrypted: false,
      });
    } else {
      result.push(f);
    }
  }
  return result;
}

async function decryptAES(data: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(data);
  if (bytes.length < 28) throw new Error('Invalid encrypted data');
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const ciphertext = bytes.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
}

async function sha256(text: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
