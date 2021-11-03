import { Coggers } from "coggers";
import { randomBytes } from "crypto";
import { makeFetch } from "supertest-fetch";
import {
	coggersSession,
	SessionedRequest,
	SessionedResponse,
} from "../src/index.js";
const password = [
	randomBytes(32).toString("base64url"),
	randomBytes(32).toString("base64url"),
];
const coggers = new Coggers({
	$: [
		coggersSession({
			password,
			name: "cool-session",
			cookie: {
				httpOnly: true,
				sameSite: "lax",
			},
		}),
	],
	$get(req: SessionedRequest, res: SessionedResponse) {
		const count = req.session.count;
		if (count) req.session.count++;
		else req.session.count = 1;
		if (count > 2) return res.deleteSession().send("TODO: Numbers after 2");
		res.saveSession();
		if (count == null) return res.send("Refresh!");
		res.send(`You've refreshed ${count === 1 ? "once" : `twice`}!`);
	},
});

if (process.argv.includes("--browser"))
	coggers
		.listen(8080)
		.then(() => console.log("Listening on http://localhost:8080/"));
else
	coggers.listen(0).then(async server => {
		const fetch = makeFetch(server);
		let cookie = "";
		const test = async body => {
			const req = await fetch("/", { headers: { Cookie: cookie } })
				.expect(200, body)
				.end();
			cookie = req.headers.get("Set-Cookie");
			if (cookie.includes("Max-Age=0;")) cookie = "";
			return req;
		};

		await test("Refresh!");
		await test("You've refreshed once!");
		await test("You've refreshed twice!");
		await test("TODO: Numbers after 2");
		await test("Refresh!");
		console.log("\x1b[32mTests passed!\x1b[0m");
		server.close();
	});
