# coggers-session

Coggers-session is a secure session middleware for Coggers

## Example

```ts
import { Coggers } from "coggers";
import session from "coggers-session";
const coggers = new Coggers({
	$: [
		session({
			password: "secure_password_above_32_characters_do_not_hardcode_this",
		}),
	],
	$get(req, res) {
		const count = req.session.count;
		if (count) req.session.count++;
		else req.session.count = 1;
		res.saveSession();
		res.send(`You've refreshed ${count} times!`);
	},
});

coggers
	.listen(8080)
	.then(() => console.log("Listening at http://localhost:8080/"));
```

### session(options)

Used to get an initialized middleware for coggers. The `options` object contains:

- password: string | Buffer | Array<string | Buffer> <br>
  This is used for encrypting the session so that only the server knows what the session contains. (Needs to be over 32 characters, please do not hardcode this)

- name: string <br>
  The name of the cookie sent to the client. (defaults to "session")

- passwordIndex: number <br>
  When using [rotating passwords](#password-rotation), the index of the password to seal with. Defaults to the last password in the array.

- cookie <br>
  Options for the cookie. Defaults are { httpOnly: true, sameSite: "lax" } <br>
  See [@tinyhttp/cookie](https://npmjs.com/@tinyhttp/cookie)

### req.session

Used to modify the session.

```ts
req.session.count = 1;
// or
req.session = {
	count: 1,
};
```

### res.saveSession()

Used to save the session. Chainable.

```ts
res.saveSession().send(`You've refreshed ${count} times!`);
```

### res.deleteSession()

Used to delete the session. Chainable. **This does not invalidate the session, it only tells the client to remove the cookie.**

```ts
res.deleteSession().send(`There goes your session!`);
```

### Password rotation

coggers-session supports password rotation, meaning that you can switch around the passwords used for sealing and unsealing the session cookies.

You can use password rotation simply by putting an array into the `password` field.
If you ever want to use a new password, you can just add it to the end of the array. If you want to reuse an old password, you'll need to define the `passwordIndex` option to be the index of that old password.

**Do not move a password around, or remove it from the array. This can invalidate old sessions.**

#### Internal workings

If you want to be reassured, or want to know how it works, see [sealing.md](./sealing.md)
