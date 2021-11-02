import { parse, serialize, SerializeOptions } from "@tinyhttp/cookie";
import type { Middleware, Request, Response } from "coggers";
import { seal, unseal } from "./seal.js";

const defaultCookieOptions: SerializeOptions = {
	httpOnly: true,
	sameSite: "lax",
};

type Password = string | Buffer;

type Options = {
	/** passwords used for sealing and unsealing. needs to be over 32 characters, but more importantly, needs to be random. */
	password: Password[] | Password;
	/** the name the cookie will be saved as, defaults to "session" */
	name?: string;
	/** Index of the password to seal with. Default (and recommended) is `LAST` (`import { LAST } from "coggers-session") */
	passwordIndex?: typeof LAST | number;
	cookie?: SerializeOptions;
};

type JSONobj = {
	[key: string]: JSONobj | JSONobj[] | number | string | boolean | null;
};

export type SessionedRequest = Request & {
	session: JSONobj;
};

export type SessionedResponse = Response & {
	saveSession(): Promise<void>;
};
const arrayify = (passwords: Password[] | Password) =>
	Array.isArray(passwords) ? passwords : [passwords];

export const LAST = Symbol.for("last");
const normalizeIndex = (index: typeof LAST | number, passwords: Password[]) =>
	index === LAST ? passwords.length - 1 : index;
/**
 * Session middleware for coggers, make sure to save after modifications using `res.saveSession()`
 * @param options
 */
export const coggersSession = (options: Options): Middleware => {
	const cookieName = options.name ?? "session";
	const passwords = arrayify(options.password);
	for (const pass of passwords)
		if (pass.length < 32) throw new Error("Password too short.");

	const sealPassId = normalizeIndex(options.passwordIndex ?? LAST, passwords);
	const sealPass = passwords[sealPassId];

	const cookieOptions = { ...defaultCookieOptions, ...options.cookie };

	return async (req: SessionedRequest, res: SessionedResponse) => {
		req.session = {};
		if (req.headers.cookie != null) {
			const cookie = parse(req.headers.cookie)[cookieName];
			if (cookie != null) {
				try {
					req.session = JSON.parse(
						(await unseal(passwords, cookie)).toString()
					);
				} catch (err) {
					// ignore
				}
			}
		}
		res.saveSession = async () => {
			// Merge old and new res Set-Cookie headers.
			const prevCookie = res.headers["Set-Cookie"] as string | string[];
			const session = serialize(
				cookieName,
				await seal(sealPass, sealPassId, JSON.stringify(req.session)),
				cookieOptions
			);

			if (prevCookie == null) res.headers["Set-Cookie"] = session;
			else
				res.headers["Set-Cookie"] = Array.isArray(prevCookie)
					? [...prevCookie, session]
					: [prevCookie, session];
		};
	};
};
export default coggersSession;
