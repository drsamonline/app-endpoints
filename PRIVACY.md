# Privacy

Version: 1.0
Effective: 10 November 2026
Owner: Dr Sohil Momin — sohilmomin2000@gmail.com
Changes: Initial version.

## What this app is

Endpoints — an offline directory of public APIs that you can filter by auth, CORS and HTTPS.

## What it collects

**Nothing.** There is no account, no sign-in, no analytics, no telemetry, no cookie, no third-party
script, no CDN, and no advertising identifier. The page loads only files that ship with it.

## What leaves your device

**Nothing.** The directory is bundled in the page; the app makes no network request at runtime.
Following a link to an API's own documentation is an ordinary browser navigation that you started —
it goes to that site, under that site's privacy policy, not through this app.

## What is stored on your device

One item, in this browser's `localStorage`: the ids of the entries you pinned
(`endpoints.pins.v1`). It never leaves the device, and Reset (or clearing site data) removes it.
If storage is unavailable or full, the app says the pins were not saved rather than pretending
they were.

## API keys

The app never asks for, stores, or transmits an API key. It records that an API *needs* one; it
never handles one.

## Children

No data is collected from anyone, of any age.

## Changes

This file is versioned in the repository; every change is a commit you can read.
