# Published reports

GitHub Pages serves this folder. Each client's report lands at
`r/<client-id>-<token>.html`, where the token is a random string generated when
the client was added and kept for the life of that client.

The point of the token is that this site is public even when the repository is
private, so the filename is the only thing keeping a report away from the
competitors it names. Do not rename these files: the link is already in the
client's inbox.

`robots.txt` and the noindex on the landing page keep search engines out.
Neither stops someone who has the URL, which is why the token is random rather
than tidy.

`outbox.json` is what the weekly workflow reads to decide who to email. It
holds each client's address and the message, and it is regenerated on every run.
