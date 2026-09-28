// Проверка Web Push из PHP (lib/WebPush.php) независимой реализацией на Node: браузерная сторона
// расшифровывает сообщение (RFC 8291), а подпись VAPID сверяется открытым ключом (RFC 8292).
// Запуск: node spaceweb/api/test/webpush.test.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { test } from "node:test";

const b64u = (b) => Buffer.from(b).toString("base64url");
const lib = new URL("../lib/", import.meta.url).pathname;

function php(code) {
  return execFileSync("php", ["-r", `require '${lib}Fetch.php'; require '${lib}WebPush.php'; ${code}`], { encoding: "utf8" });
}

test("сообщение расшифровывается браузерной стороной", () => {
  // «Браузер»: ключи подписки.
  const ua = crypto.createECDH("prime256v1");
  ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const message = JSON.stringify({ title: "Пора полить", body: "Монстера Мося ждёт воды 💧", url: "/today/" });
  const body = Buffer.from(
    php(`echo base64_encode(WebPush::encrypt(base64_decode('${Buffer.from(message).toString("base64")}'), '${b64u(ua.getPublicKey())}', '${b64u(auth)}'));`),
    "base64",
  );

  const salt = body.subarray(0, 16);
  assert.equal(body.readUInt32BE(16), 4096);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const cipher = body.subarray(21 + idlen);
  const shared = ua.computeSecret(asPublic);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic]), 32));
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([decipher.update(cipher.subarray(0, cipher.length - 16)), decipher.final()]);
  assert.equal(plain[plain.length - 1], 2, "разделитель последней записи");
  assert.equal(plain.subarray(0, -1).toString("utf8"), message);
});

test("подпись VAPID проверяется открытым ключом", () => {
  const keys = JSON.parse(php("echo json_encode(WebPush::generateKeys());"));
  const header = php(`echo WebPush::vapidAuth('https://fcm.googleapis.com/fcm/send/abc', 'https://podokonnikapp.ru', '${keys.publicKey}', '${keys.privateKey}');`);
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(header);
  assert.ok(m, header);
  assert.equal(m[2], keys.publicKey);
  const [h, p, s] = m[1].split(".");
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(claims.aud, "https://fcm.googleapis.com");
  const point = Buffer.from(keys.publicKey, "base64url");
  const jwk = { kty: "EC", crv: "P-256", x: b64u(point.subarray(1, 33)), y: b64u(point.subarray(33, 65)) };
  const ok = crypto.verify("sha256", Buffer.from(`${h}.${p}`), { key: crypto.createPublicKey({ key: jwk, format: "jwk" }), dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
  assert.ok(ok, "подпись ES256 верна");
});
