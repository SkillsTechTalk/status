# Status

Automated uptime checks for Skills Tech Talk products, every 15 minutes.

`check.mjs` makes read-only requests to public pages and endpoints and fails the run when any of them is down. Run it locally with `node check.mjs` (Node 20+).
