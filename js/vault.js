(function (global) {
  "use strict";

  var MIN_ITERATIONS = 200000;
  var MAX_ITERATIONS = 1000000;

  function fail(code) {
    var error = new Error(code);
    error.code = code;
    return error;
  }

  function b64ToBytes(b64) {
    if (typeof b64 !== "string" || !b64) throw fail("format");
    var binary = atob(b64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  async function decryptVault(payload, password) {
    if (!payload || typeof payload !== "object") throw fail("format");
    if (payload.kind !== "eunjo-coaching-vault" || payload.version !== 1) throw fail("format");
    if (payload.alg !== "AES-256-GCM" || payload.kdf !== "PBKDF2-SHA256") throw fail("alg");
    var iterations = payload.iterations;
    if (typeof iterations !== "number" || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
      throw fail("iterations");
    }
    if (!global.crypto || !global.crypto.subtle) throw fail("webcrypto");

    var keyMaterial = await global.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    var key = await global.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: b64ToBytes(payload.salt),
        iterations: iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    var plainBuffer;
    try {
      plainBuffer = await global.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64ToBytes(payload.iv) },
        key,
        b64ToBytes(payload.ciphertext)
      );
    } catch (error) {
      throw fail("password");
    }
    var parsed;
    try {
      parsed = JSON.parse(new TextDecoder().decode(plainBuffer));
    } catch (error) {
      throw fail("shape");
    }
    var videos = Array.isArray(parsed) ? parsed : parsed && parsed.videos;
    if (!Array.isArray(videos)) throw fail("shape");
    return videos;
  }

  global.EunjoVault = {
    decryptVault: decryptVault,
    MIN_ITERATIONS: MIN_ITERATIONS,
  };
})(window);
