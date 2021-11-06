import type { Middleware, Request, Response } from "coggers";
import { seal, unseal } from "./seal.js";

type SerializeOptions = Parameters<typeof Response.prototype.cookie>[2];

const defaultCookieOptions: SerializeOptions = {
	httpOnly: true,
	sameSite: "Lax",
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

	/** Defaults to JSON.stringify */
	stringify?: (obj) => string;
	/** Defaults to JSON.parse */
	parse?: (str: string) => any;
};

export type SessionedRequest = Request & {
	session?: any;
};

export type SessionedResponse = Response & {
	saveSession?: () => Response;
	deleteSession?: () => Response;
};
const arrayify = (passwords: Password[] | Password) =>
	Array.isArray(passwords) ? passwords : [passwords];

export const LAST = Symbol.for("last");
const normalizeIndex = (index: typeof LAST | number, passwords: Password[]) =>
	typeof index === "number" ? index : passwords.length - 1;

/** Session middleware for coggers, make sure to save after modifications using `res.saveSession()` */
export const coggersSession = (options: Options): Middleware => {
	const {
		stringify = JSON.stringify,
		parse = JSON.parse,
		name: cookieName = "session",
	} = options;
	const passwords = arrayify(options.password).map(Buffer.from);
	for (const pass of passwords)
		if (pass.length < 32) throw new Error("Password too short.");

	const sealPassId = normalizeIndex(options.passwordIndex, passwords);
	const sealPass = passwords[sealPassId];

	const cookieOptions = { ...defaultCookieOptions, ...options.cookie };

	return (req: SessionedRequest, res: SessionedResponse) => {
		req.session = {};
		const cookie = req.cookies[cookieName];
		if (cookie != null) {
			try {
				req.session = parse(unseal(passwords, cookie).toString());
			} catch (err) {
				// ignore
			}
		}

		res.saveSession = () =>
			res.cookie(
				cookieName,
				seal(sealPass, sealPassId, stringify(req.session)),
				cookieOptions
			);

		res.deleteSession = () =>
			res.cookie(cookieName, "", { ...cookieOptions, maxAge: 0 });
	};
};
export default coggersSession;
