# Security

## Reporting

Email **sohilmomin2000@gmail.com** with the details. Please do not open a public issue for a
vulnerability.

## The design that makes it small

- **No network at runtime.** The app never calls `fetch` or `XMLHttpRequest`; the directory is a
  script that ships with the page. `node test-node.js` asserts this on the engine and on the UI.
- **No remote code.** Zero CDNs, zero third-party scripts. The page loads five local files.
- **No credentials.** The app never asks for, holds or sends an API key.
- **No eval.** Nothing in the dataset is executed; it is rendered as text through `textContent`,
  never as HTML, so a hostile entry in the source table cannot inject markup.
- **Bounded input.** Filter values are validated against fixed vocabularies and refused otherwise;
  search terms are plain strings passed to a local index.

## What it cannot protect you from

The links go to third-party sites. Whether those sites are safe, still free, or still online is
outside this app — and it does not claim otherwise.
