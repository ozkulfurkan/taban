import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordError } from '../../lib/password';

test('şifre kuralı: en az 8 karakter, harf ve rakam; yaygın ve e-postayı içeren şifre yok', () => {
  for (const bad of ['Ab12345', 'abcdefgh', '12345678', 'password123', 'Password1', 'Solecost123', '11111111a'.slice(0, 8), 'aaaaaaaa']) {
    assert.ok(passwordError(bad), bad);
  }
  assert.ok(passwordError('mehmet2026x', { email: 'mehmet@firma.com' }));
  assert.equal(passwordError('Taban2026Guclu'), null);
  assert.equal(passwordError('Kaya-ayakkabi7', { email: 'mehmet@firma.com' }), null);
});
