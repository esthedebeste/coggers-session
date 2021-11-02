// Inspired by @hapi/iron.

import type { BinaryLike } from "node:crypto";
import * as crypto from "node:crypto";

const pbkdf2 = crypto.pbkdf2Sync;
const timingSafeEqual = (a: Buffer, b: Buffer) => {
	try {
		return crypto.timingSafeEqual(a, b);
	} catch {
		return false;
	}
};

const SEP = ".";
const VERSION = "1";

/**
 * @returns a 7-part string that consists of:
 * 	- version
 * 	- password ID
 * 	- initialization vector
 * 	- encryption salt
 * 	- integrity salt
 * 	- encrypted data (encrypted with a key derived of the encryption salt and the password)
 * 	- integrity string (the original data, HMACd with a key derived of the integrity salt and the password)
 */
export function seal(
	password: BinaryLike,
	passid: number,
	data: BinaryLike
): string {
	const iv = crypto.randomBytes(16 /* 128 bits */);
	// generate encryption salt
	const saltE = crypto.randomBytes(32 /* 256 bits */);
	// encryption key (pbkdf2)
	// TODO: more than 1 iteration?
	const keyE = pbkdf2(password, saltE, 1, 32, "sha1");

	const cipher = crypto.createCipheriv("aes-256-cbc", keyE, iv);
	const dataE = Buffer.concat([cipher.update(data), cipher.final()]);

	// integrity
	const saltI = crypto.randomBytes(32 /* 256 bits */);
	const keyI = pbkdf2(password, saltI, 1, 32, "sha1");
	const integrity = crypto.createHmac("sha256", keyI).update(data).digest();
	const parts = [iv, saltE, saltI, dataE, integrity]
		.map(buf => buf.toString("base64url"))
		.join(SEP);

	return VERSION + SEP + passid + SEP + parts;
}

export class UnsealError extends Error {}
UnsealError.prototype.name = "UnsealError";

const base64urlDecode = (string: string) => Buffer.from(string, "base64url");
export function unseal(passwords: BinaryLike[], data: string): Buffer {
	const parts = data.split(SEP);
	if (parts.length !== 7) throw new UnsealError("Invalid amount of parts.");
	if (parts[0] !== VERSION) throw new UnsealError("Invalid version.");
	const passid = parseInt(parts[1]);
	if (isNaN(passid) || passid < 0 || passid >= passwords.length)
		throw new UnsealError("Invalid password ID");
	const password = passwords[passid];
	const [iv, saltE, saltI, dataE, integrity] = parts
		.slice(2)
		.map(base64urlDecode);

	const keyE = pbkdf2(password, saltE, 1, 32, "sha1");
	const decipher = crypto.createDecipheriv("aes-256-cbc", keyE, iv);
	const dataU = Buffer.concat([decipher.update(dataE), decipher.final()]);

	const keyI = pbkdf2(password, saltI, 1, 32, "sha1");
	const integrityCheck = crypto
		.createHmac("sha256", keyI)
		.update(dataU)
		.digest();
	if (timingSafeEqual(integrity, integrityCheck))
		throw new UnsealError("Integrity check failed. (Tampered contents)");

	return dataU;
}
