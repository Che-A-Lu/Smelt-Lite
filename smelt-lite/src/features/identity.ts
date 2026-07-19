import type { IdentityKey } from '../foundation/types';

const STORAGE_KEY = 'smelt-lite-identity';

async function arrayBufferToBase64(buf: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function generateKeyPair(): Promise<IdentityKey> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const publicKeyJWK = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const privateKeyJWK = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const fingerprint = await computeFingerprint(publicKeyJWK);
  return { publicKeyJWK, privateKeyJWK, fingerprint };
}

export async function computeFingerprint(jwk: JsonWebKey): Promise<string> {
  const raw = (jwk.x ?? '') + (jwk.y ?? '');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 16);
}

export async function signContent(contentHash: string, privateKeyJWK: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk', privateKeyJWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(contentHash)
  );
  return arrayBufferToBase64(sig);
}

export async function verifySignature(
  contentHash: string, signature: string, publicKeyJWK: JsonWebKey
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'jwk', publicKeyJWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      base64ToArrayBuffer(signature),
      new TextEncoder().encode(contentHash)
    );
  } catch {
    return false;
  }
}

export function saveIdentity(key: IdentityKey): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(key));
}

export function loadIdentity(): IdentityKey | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as IdentityKey;
  } catch {
    return null;
  }
}

export function exportIdentityKey(key: IdentityKey): void {
  const blob = new Blob([JSON.stringify(key, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smelt-identity-${key.fingerprint}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importIdentityKey(file: File): Promise<IdentityKey> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const key = JSON.parse(reader.result as string) as IdentityKey;
        if (!key.publicKeyJWK || !key.privateKeyJWK || !key.fingerprint) {
          reject(new Error('Invalid identity file'));
          return;
        }
        resolve(key);
      } catch (e) { reject(e); }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
