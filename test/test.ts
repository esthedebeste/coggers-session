import { Coggers } from "coggers";
import { randomBytes } from "crypto";
import { makeFetch } from "supertest-fetch";
import { coggersSession } from "../src/index.js";
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
	async $get(req, res) {
		const count = req.session.count;
		if (count) req.session.count++;
		else req.session.count = 1;
		await res.saveSession();
		if (count == null) return res.send("Refresh!");
		res.send(`You've refreshed ${count === 1 ? "once" : `${count} times`}!`);
	},
});

if (process.argv.includes("--browser"))
	coggers
		.listen(8080)
		.then(() => console.log("Listening on http://localhost:8080/"));
else
	coggers.listen(0).then(async server => {
		const fetch = makeFetch(server);
		const { headers } = await fetch("/").expect(200, "Refresh!").end();
		let cookie = headers.get("Set-Cookie");
		const second = await fetch("/", { headers: { Cookie: cookie } })
			.expect(200, "You've refreshed once!")
			.end();
		cookie = second.headers.get("Set-Cookie");
		await fetch("/", { headers: { Cookie: cookie } })
			.expect(200, "You've refreshed 2 times!")
			.end();
		console.log("\x1b[32mTests passed!\x1b[0m");
		server.close();
	});
