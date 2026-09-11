# Sign-in escape from company setup

This note records the local fix before deployment was authorized. The user
subsequently requested a push; the completed deployment is recorded in
[the release report](neutronium-signin-release-2026-09-10.md). Future changes
remain local until explicitly authorized for deployment, as recorded in
`AGENTS.md`.

An authenticated account without an active company membership was shown the
employee or administrator setup form, which had no sign-out or sign-in control.
Changing the Employee/Admin dropdown changed the setup form but did not switch
accounts. The membership error in the supplied screenshot means the session
was authenticated but had no matching active company membership; it is not a
password rejection.

The local fix shows the signed-in email and adds **Sign in with a different
account** to both setup forms. It ends the current session before presenting
the login form. If sign-out fails, it keeps the setup screen and displays the
error. The employee form no longer shows an unusable Create workspace button.
The explanatory text makes clear that the account is already signed in.

Validation: all 56 backend tests, all five authentication browser scenarios,
and Neutronium lint passed. TypeScript and lint also passed in the isolated
verification container before the deployment preference changed. Both affected
browser tests passed again locally after the final copy change and the added
administrator account-switch assertion.

A remote build was started before the user's local-only instruction, then
canceled. The two staged source files were restored from
`/opt/neutronium-source-20260910T110623Z.tar.gz`, and the app image tag was reset
to the running release. The app container was not replaced during that canceled
attempt. At that point the live image remained
`sha256:ef50c8a09a3600c96f3f5f1b673358f6388891b37fff3bd4a3d3a4577fb0dbd8`.

The backup from that canceled release remains at
`/opt/neutronium/deploy/neutronium/backups/neutronium-20260910T110622Z.dump`
with the matching `.files.tar.gz` archive. These backups and the running image
were left intact. This document and the updated instructions stayed local until
the subsequent explicitly authorized release.
