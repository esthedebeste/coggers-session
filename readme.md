# coggers-session

Coggers-session is a session middleware for Coggers using [@hapi/iron](https://npmjs.com/@hapi/iron)

## Usage

```ts
import { Coggers } from "coggers";
import session from "coggers-session";
const coggers = new Coggers({
	$: [
		session({
			password: "secure_password_above_32_characters_do_not_hardcode_this",
		}),
	],
	async $get(req, res) {
		const count = req.session.count;
		if (count) req.session.count++;
		else req.session.count = 1;
		await res.saveSession();
		res.send(`You've refreshed ${count} times!`);
	},
});

coggers
	.listen(8080)
	.then(() => console.log("Listening at http://localhost:8080/"));
```

<!-- TODO: Documentation for password rotation -->
