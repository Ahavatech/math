# Nginx and rate-limiter IP note

## How client IP is read

The app reads the client IP from `x-forwarded-for` (first value in the
comma-separated list) in the search page and other rate-limited routes:

```
const ip =
  headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
  headerList.get("x-real-ip") ??
  "unknown";
```

## Why a client cannot spoof this behind Nginx

A client behind a properly configured Nginx cannot spoof this because
Nginx overwrites (not appends to) the `X-Forwarded-For` header before
forwarding the request. The Nginx configuration must include:

```nginx
proxy_set_header X-Forwarded-For $remote_addr;
```

Using `$remote_addr` (the TCP source address, which the client cannot
forge) rather than `$proxy_add_x_forwarded_for` (which appends to any
header the client sent) ensures that a client cannot inject a fake IP
by sending their own `X-Forwarded-For: 1.2.3.4` header.

## Nginx example block

```nginx
server {
    listen 80;
    server_name maths.oauife.edu.ng;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Overwrite X-Forwarded-For with the real TCP source address.
        # Do NOT use $proxy_add_x_forwarded_for here - clients can
        # spoof that by sending their own X-Forwarded-For header.
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Real-IP       $remote_addr;
        proxy_set_header Host            $host;
        proxy_set_header Upgrade         $http_upgrade;
        proxy_set_header Connection      "upgrade";
    }
}
```

## Spoofing test

With the above config, a client sending:
`curl -H "X-Forwarded-For: 1.2.3.4" https://maths.oauife.edu.ng/search?q=test`

will arrive at the app with `X-Forwarded-For: <client-real-ip>`, not
`1.2.3.4`, because Nginx overwrites the header.

## Multi-instance note

The `InMemoryRateLimiter` in `src/lib/rate-limit.ts` does not share state
across processes. If the app is ever scaled to multiple instances, switch to
a Redis-backed limiter using the same `RateLimiter` interface (see
`docs/DECISIONS.md`).
