#!/usr/bin/env node
"use strict";

/**
 * 코칭 영상 평문 JSON을 AES-256-GCM으로 암호화합니다.
 * 비밀번호는 환경변수 COACHING_PASSWORD 만 사용합니다. 인자로 넘기지 마세요.
 *
 *   export COACHING_PASSWORD='비밀번호'
 *   node scripts/encrypt_coaching.js /path/to/coaching.private.json data/coaching.enc.json
 *
 * 입력은 JSON 배열이거나 { "videos": [ ... ] } 입니다.
 * 평문 파일은 data/ 폴더에 두지 마세요. 암호화된 파일만 커밋합니다.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ITERATIONS = 210000;
const KIND = "eunjo-coaching-vault";

function fail(message) {
  console.error("오류: " + message);
  process.exit(1);
}

function webcrypto() {
  if (globalThis.crypto && globalThis.crypto.subtle) return globalThis.crypto;
  if (crypto.webcrypto) return crypto.webcrypto;
  fail("이 Node 버전에는 WebCrypto가 없습니다. Node.js 18 이상이 필요합니다.");
}

function toUint8(buffer) {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

async function decryptWithWebCrypto(payload, password) {
  const subtle = webcrypto().subtle;
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  const key = await subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: toUint8(Buffer.from(payload.salt, "base64")),
      iterations: payload.iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plain = await subtle.decrypt(
    { name: "AES-GCM", iv: toUint8(Buffer.from(payload.iv, "base64")) },
    key,
    toUint8(Buffer.from(payload.ciphertext, "base64"))
  );
  return new TextDecoder().decode(plain);
}

function readVideos(inputPath) {
  const abs = path.resolve(inputPath);
  const dataDir = path.resolve("data");
  if (abs === dataDir || abs.startsWith(dataDir + path.sep)) {
    fail("data/ 안의 파일은 암호화 입력으로 쓸 수 없습니다. 평문은 저장소 밖에 두세요.");
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (error) {
    fail("입력 JSON을 읽지 못했습니다. " + error.message);
  }
  const videos = Array.isArray(raw) ? raw : raw && raw.videos;
  if (!Array.isArray(videos)) {
    fail("입력은 JSON 배열이거나 { \"videos\": [] } 형태여야 합니다.");
  }
  return videos;
}

async function main() {
  const password = process.env.COACHING_PASSWORD;
  const inputPath = process.argv[2];
  const outputPath = path.resolve(process.argv[3] || path.join("data", "coaching.enc.json"));

  if (!inputPath) {
    fail("사용법: COACHING_PASSWORD=... node scripts/encrypt_coaching.js <평문.json> [출력.json]");
  }
  if (!password) {
    fail("환경변수 COACHING_PASSWORD가 필요합니다. 비밀번호를 명령 인자로 넣지 마세요.");
  }
  if (password.length > 256) {
    fail("비밀번호는 256자 이하로 해 주세요.");
  }

  const videos = readVideos(inputPath);
  const plaintext = JSON.stringify(videos);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const payload = {
    version: 1,
    kind: KIND,
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
  };

  let roundtrip;
  try {
    roundtrip = await decryptWithWebCrypto(payload, password);
  } catch (error) {
    fail("WebCrypto 검증에 실패했습니다. 파일을 쓰지 않았습니다. " + error.message);
  }
  if (roundtrip !== plaintext) {
    fail("암호화 결과가 원문과 다릅니다. 파일을 쓰지 않았습니다.");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n");
  console.log("저장했습니다: " + outputPath);
  console.log("영상 " + videos.length + "개 · PBKDF2 " + ITERATIONS + "회 · AES-256-GCM");
  console.log("평문 파일은 커밋하지 마세요. 암호화된 JSON만 저장소에 둡니다.");
}

main().catch((error) => fail(error.message));
