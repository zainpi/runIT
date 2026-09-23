# Higgsfield video ads for the coding agent

This is a local agent tool, not an application endpoint. It creates short video
ads for the AI templates using the documented Seedance 2.0 text-to-video model.
The agent can propose copy and prompts, estimate the cost, submit once, track
progress, and download an MP4. No site visitor can access the API key or jobs.

## Set up

1. Create a Higgsfield account and obtain an API key ID and secret in the
   [Higgsfield Console](https://console.higgsfield.ai/). Model access and limits
   depend on that account. This repository has not verified your account's
   access or made a paid generation request.
2. Put `HF_API_KEY_ID` and `HF_API_KEY_SECRET` in the ignored
   `.env.higgsfield.local` file at the repository root, or export them in the
   trusted local agent shell. The CLI loads that file automatically. See
   `.env.higgsfield.example` for names. Never use `NEXT_PUBLIC_` variables
   or place credentials in agent prompts, screenshots, commits, or logs.
3. Use Node.js 20 or later. Run commands from the repository root.

```sh
npm run higgsfield -- estimate --prompt 'Vertical cinematic ad: a photorealistic adult Asian woman working on an original app concept at a desk; show the AI template as abstract interface shapes without legible text or brand logos; warm studio light, natural motion, polished commercial look' --duration 5 --resolution 720p --aspect 9:16 --audio true
npm run higgsfield -- submit --job 11111111-1111-4111-8111-111111111111 --prompt 'Vertical cinematic ad: a photorealistic adult Asian woman working on an original app concept at a desk; show the AI template as abstract interface shapes without legible text or brand logos; warm studio light, natural motion, polished commercial look' --duration 5 --resolution 720p --aspect 9:16 --audio true
npm run higgsfield -- wait --job 11111111-1111-4111-8111-111111111111
npm run higgsfield -- download --job 11111111-1111-4111-8111-111111111111
```

Use a fresh UUID for each distinct concept (`uuidgen` or the agent's UUID
generator). Reusing a job ID never creates another submission. If `--job` is
omitted, the tool creates one and prints it. An uncertain network outcome is
saved and must be checked in the Higgsfield dashboard before deciding whether
to create a new job. Never automatically retry an ambiguous generation POST.

`status` performs one authenticated status check. `wait` starts at two seconds,
backs off to ten seconds with jitter, and stops at completed, failed, NSFW, or
canceled. It times out locally after 20 minutes, leaving the job available for
later checks. The status URL from submission is validated and stored. Job
records and downloaded videos live in ignored `.higgsfield/` with local
permissions; commands accept only job IDs found in this workspace. They are
not multiuser or tenant records. `download --output /absolute/path/ad.mp4`
chooses another output path; the destination must not already exist.

Review generated footage and add real ad copy, offer details, and brand marks
in an editor. Do not imply that the generated actor is an actual customer or
use a real person's likeness without permission. Higgsfield output URLs are
available for at least seven days, so download approved results promptly.

The implementation uses direct REST so it can persist the asynchronous request
ID and control polling explicitly. The current TypeScript SDK documents
automatic `subscribe` polling; the model-specific docs direct explicit
lifecycle use toward Python. No webhook is needed for this local CLI.

Docs checked September 23, 2026:

- [Seedance 2.0 request schema](https://open.higgsfield.ai/models/bytedance/seedance-2.0/text-to-video/api-reference)
- [Authentication](https://docs.higgsfield.ai/docs/authentication)
- [Requests and lifecycle](https://docs.higgsfield.ai/docs/concepts/requests)
- [Polling](https://docs.higgsfield.ai/docs/concepts/polling)
- [Errors and retries](https://docs.higgsfield.ai/docs/concepts/errors)
- [Rate limits](https://docs.higgsfield.ai/docs/concepts/rate-limits)
- [Webhooks](https://docs.higgsfield.ai/docs/how-to/webhooks)
