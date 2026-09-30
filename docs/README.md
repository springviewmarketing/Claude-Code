# Published reports

GitHub Pages serves this folder. Each client's report lands at
`<slug>/index.html`, so the address ends at the practice name:

    /kemp-kerrigan/
    /murgatroyd/                 both branches on one page
    /murgatroyd/staveley/
    /murgatroyd/conisbrough/

Reports used to carry a random token in the filename, from when this repository
was going to be private and the URL was the only thing keeping a page away from
the competitors it names. The repository is public, so the token was protecting
nothing while making every link too ugly to send.

`robots.txt` and the noindex on the landing page stay. They are not about
secrecy. They stop a page that compares named local businesses turning up when
somebody searches for one of those businesses.

Do not rename these folders. The links are already in the clients' inboxes.

`outbox.json` is what the weekly workflow reads to decide who to email. It holds
each client's address and the message, and it is regenerated on every run. A
client with more than one branch is linked to their combined page.
