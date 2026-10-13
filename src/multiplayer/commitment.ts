import { ThrowValue } from '../engine/types';

/**
 * Creates SHA-256 hex string in both browser and Node.js environments
 */
export async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  } else {
    // Node.js fallback
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(message).digest('hex');
  }
}

/**
 * Generates a random cryptographic nonce
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(2);
    crypto.getRandomValues(array);
    return `${array[0].toString(36)}-${array[1].toString(36)}`;
  }
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Create commitment string: sha256(`${throwValue}:${nonce}`)
 */
export async function createCommitment(
  throwVal: ThrowValue,
  nonce: string
): Promise<string> {
  return await sha256(`${throwVal}:${nonce}`);
}

/**
 * Verifies revealed throw against commitment
 */
export async function verifyCommitment(
  commitment: string,
  throwVal: ThrowValue,
  nonce: string
): Promise<boolean> {
  const computed = await createCommitment(throwVal, nonce);
  return computed.toLowerCase() === commitment.toLowerCase();
}
