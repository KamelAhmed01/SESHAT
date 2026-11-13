# SESHAT security and hosting contract

## Static export and browser boundaries

SESHAT serves a **public static** Next.js export; there is no authentication, personal data store, API secret, or server authority. Mission conclusions are explicitly research scenarios. Never add secrets to `NEXT_PUBLIC_*`, client code, or `public/`.

Vercel applies the declarative security headers in `vercel.json` on its HTTP responses. Local `python -m http.server` will **not** send these headers; don't confuse a config-file test with a **production response** inspection.

The CSP permits `'unsafe-inline'` for script/style to preserve Next static hydration and Astryx runtime styling until the actual production build allows a narrower nonced or hashed policy. This is a deliberate compromise, **not** a claim of strict CSP security. `unsafe-eval` is not permitted. Check browser console for CSP violations and validate the Vercel route before freeze.

### Release probes on the deployed host

```bash
curl -sSI https://seshat.kmls.dev/ | grep -iE 'content-security-policy|x-frame-options|x-content-type-options|strict-transport|referrer-policy|permissions-policy'
# Optional non-blocking passive scan after TLS and CSP pass:
# docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://seshat.kmls.dev/ -I
```

Do **not** infer secure deployment just because these files are checked into git. Do not include remote URLs in CSP sources without a documented functional need. Verify all images, fonts, JS, generated binaries and scientific citations offline; external *links* may leave the site but the core workflow must not.

## Cloudflare / Vercel DNS

Point the selected subdomain CNAME at the exact hostname provided by Vercel. Start with Cloudflare proxy **DNS-only (grey cloud)**, verify Vercel domain ownership/TLS, then decide whether a proxy is beneficial. Never claim that proxying is categorically unsupported. Keep the live site and a complete local `out/` export on two laptops.

## GitHub and provenance

Use PRs with one reviewer and passing science/web checks on `main` as soon as repo permissions permit. Avoid strict protections that stop all six developers during the clock. Declare `tests/oracles/` code ownership only **after actual GitHub handles are confirmed**; do not guess handles. Review and commit AI-assisted code just like human code. Preserve real Git timestamps.
