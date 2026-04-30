#!/usr/bin/env node
import crypto from 'node:crypto';

const keyId = String(process.argv[2] || `manifest-${new Date().toISOString().slice(0, 10)}`).trim();
if (!keyId) {
  console.error('Missing key id.');
  process.exit(1);
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicSpkiBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log(JSON.stringify({
  keyId,
  publicSpkiBase64,
  privateKeyPem: privatePem,
  configSnippet: {
    requiredManifestKeyId: keyId,
    manifestPublicKeys: {
      [keyId]: publicSpkiBase64
    }
  }
}, null, 2));
