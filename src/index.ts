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

export interface SessionedRequest extends Request {
	session: JSONobj;
}

export interface SessionedResponse extends Response {
	saveSession(): this;
	deleteSession(): this;
}
const arrayify = (passwords: Password[] | Password) =>
	Array.isArray(passwords) ? passwords : [passwords];

export const LAST = Symbol.for("last");
const normalizeIndex = (index: typeof LAST | number, passwords: Password[]) =>
	index === LAST ? passwords.length - 1 : index;

/** Session middleware for coggers, make sure to save after modifications using `res.saveSession()` */
export const coggersSession = (options: Options): Middleware => {
	const cookieName = options.name ?? "session";
	const passwords = arrayify(options.password).map(Buffer.from);
	for (const pass of passwords)
		if (pass.length < 32) throw new Error("Password too short.");

	const sealPassId = normalizeIndex(options.passwordIndex ?? LAST, passwords);
	const sealPass = passwords[sealPassId];

	const cookieOptions = { ...defaultCookieOptions, ...options.cookie };

	return (req: SessionedRequest, res: SessionedResponse) => {
		req.session = {};
		if (req.headers.cookie != null) {
			const cookie = parse(req.headers.cookie)[cookieName];
			if (cookie != null) {
				try {
					req.session = JSON.parse(unseal(passwords, cookie).toString());
				} catch (err) {
					// ignore
				}
			}
		}

		const addCookie = (newCookie: string) => {
			const prevCookie = res.headers["Set-Cookie"] as string | string[];
			if (prevCookie == null) res.headers["Set-Cookie"] = newCookie;
			else
				res.headers["Set-Cookie"] = Array.isArray(prevCookie)
					? [...prevCookie, newCookie]
					: [prevCookie, newCookie];

			return res;
		};

		res.saveSession = () => {
			addCookie(
				serialize(
					cookieName,
					seal(sealPass, sealPassId, JSON.stringify(req.session)),
					cookieOptions
				)
			);
			return res;
		};
		res.deleteSession = () => {
			addCookie(
				serialize(cookieName, "cleared", { ...cookieOptions, maxAge: 0 })
			);
			return res;
		};
	};
};
export default coggersSession;
