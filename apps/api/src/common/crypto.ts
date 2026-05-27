import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

const buildKey = (secret: string) => createHash("sha256").update(secret).digest();

export const encryptString = (value: string, secret: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, buildKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
};

export const decryptString = (value: string, secret: string) => {
  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const body = payload.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, buildKey(secret), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
};
