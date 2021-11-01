import {
	defaults as defaultSealOptions,
	Password,
	seal,
	SealOptions,
	unseal,
} from "@hapi/iron";
import { parse, serialize, SerializeOptions } from "@tinyhttp/cookie";
import type { Middleware, Request, Response } from "coggers";

const defaultCookieOptions: SerializeOptions = {
	httpOnly: true,
	sameSite: "lax",
};

type Pass = Record<string, Password> | Password[] | Password;

export const LAST = Symbol.for("last");
export const FIRST = Symbol.for("first");

type Options = {
	/** password used for sealing */
	password: Pass;
	/** the name the cookie will be saved as, defaults to "session" */
	name?: string;
	/** Key of the password to seal with. Defaults to `LAST` (`import { LAST } from "coggers-session"`). */
	passwordIndex?: typeof FIRST | typeof LAST | string;
	seal?: SealOptions;
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

const hashify = (password: Pass): Record<string, Password> => {
	if (typeof password === "string" || password instanceof Buffer)
		return { default: password };
	// @ts-ignore object-spreading an array does not copy the length.
	if (Array.isArray(password)) return { ...password };
	return password;
};

const getSealPassword = (
	passwords: Record<string, Password>,
	index: typeof FIRST | typeof LAST | string
) => {
	if (typeof index === "string") return passwords[index];
	else if (index === FIRST) return Object.values(passwords)[0];
	else if (index === LAST) {
		const values = Object.values(passwords);
		return values[values.length - 1];
	}
};

/**
 * Session middleware for coggers, make sure to save after modifications using `res.saveSession()`
 * @param password Passwords need to be over 32 characters, make sure they're secure!
 * @param options
 */
export const coggersSession = (options: Options): Middleware => {
	const cookieName = options.name ?? "session";
	const password = hashify(options.password);
	const sealPass: Password = getSealPassword(
		password,
		options.passwordIndex ?? LAST
	);

	const cookieOptions = { ...defaultCookieOptions, ...options.cookie };
	const sealOptions = { ...defaultSealOptions, ...options.seal };

	return async (req: SessionedRequest, res: SessionedResponse) => {
		req.session = {};
		if (req.headers.cookie != null) {
			const cookie = parse(req.headers.cookie)[cookieName];
			if (cookie != null) {
				try {
					req.session = await unseal(cookie, password, sealOptions);
				} catch (error) {
					// ignore
				}
			}
		}
		res.saveSession = async () => {
			// Merge old and new res Set-Cookie headers.
			const prevCookie = res.headers["Set-Cookie"] as string | string[];
			const session = serialize(
				cookieName,
				await seal(req.session, sealPass, sealOptions),
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
