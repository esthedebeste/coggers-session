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
		if (req.session.refreshed) res.send("You refreshed!");
		else {
			req.session.refreshed = true;
			await res.saveSession();
			res.send("Refresh!");
		}
	},
});

coggers
	.listen(8080)
	.then(() => console.log("Listening at http://localhost:8080/"));
```
