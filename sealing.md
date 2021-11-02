This .md mostly documents what src/seal.ts does.

Note: `BinaryLike` basically means `Buffer | string`.

## Sealing

Sealing takes three arguments:

- `password: BinaryLike` Password to use
- `passid: number` The index of this password (for password rotation, used in unsealing process. When not using password rotation, this is 0 because `"foobar"` is converted to `["foobar"]`)
- `data: BinaryLike` The data to seal

Then, these steps are ran

- `const iv: Buffer` is created, an [Initialization Vector](https://en.wikipedia.org/wiki/Initialization_vector) consisting of 128 random bits. This is used so that the encrypted data will always look different.
- `const saltE: Buffer` is created, a random 256-bit salt used for creating the encryption key.
- `const keyE: Buffer` is created using PBKDF2, which derives a key from `password` and `saltE`
- `const cipherE: Cipher` is a aes-256-cbc cipher created with the key `keyE` and the iv `iv`
- `const dataE: Buffer` is the result of ciphering `data` using `cipherE`
- `const saltI: Buffer` is created, another random 256-bit salt, this one is used for generating `keyI`
- `const keyI: Buffer` is created using PBKDF2, which derives a key from `password` and `saltI`
- `const integrity: Buffer` is created by hmac-sha256-hashing `data` using the key `keyI`
- `passid`, `iv`, `saltE`, `saltI`, `dataE`, and `integrity` are concatenated into a `.`-splitted string. Buffers are base64url-encoded. This string is prefixed by the version of coggers-session that created it, right now that's `1`
- This concatenated string is sent to the client using a cookie.

## Unsealing

Note: when an error is thrown within the unsealing process, coggers-session ignores it, and simply clears the session back to `{}`.

Unsealing takes two arguments:

- `passwords: Array<BinaryLike>` The passwords
- `data: string` The cookie data to unseal

Then, these steps are ran

- `const parts: string[]` is created by `.`-splitting `data`
- `parts` is checked to be 7 parts long. If not, an UnsealError is thrown.
- The first part is checked to be `1`. This is required so that we don't try to unseal an old/future cookie format. If not, an UnsealError is thrown.
- `const passid: number` is the second part, integer-parsed.
- if `passid` is not in `passwords`, or it isn't a valid number, an UnsealError is thrown.
- `const password: BinaryLike` is `passwords[passid]`
- The other 5 parts are all base64url-decoded, and put into these variables:
  - `const iv: Buffer`
  - `const saltE: Buffer`
  - `const saltI: Buffer`
  - `const dataE: Buffer`
  - `const integrity: Buffer`
- `const keyE: Buffer` is created using PBKDF2, which derives a key from `password` and `saltE`
- `const decipher: Decipher` is a aes-256-cbc **de**cipher created with the key `keyE` and the iv `iv`
- `const dataU: Buffer` is the result of deciphering `dataE` using `decipher`
- `const keyI: Buffer` is created using PBKDF2, which derives a key from `password` and `saltI`
- `const integrityCheck: Buffer` is created by hmac-sha256-hashing `dataU` using the key `keyI`
- A timing-safe equal check is ran to check if `integrity` (from the client) is the exact same as `integrityCheck`
  - If the two are the exact same, `dataU` is returned.
  - If the two _aren't_ the exact same, an UnsealError is thrown (Tampered contents)
