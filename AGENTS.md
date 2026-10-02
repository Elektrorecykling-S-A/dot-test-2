# Repository agent instructions

## Feature/fix deployment requests

When the user asks to deploy a feature or fix, use the branch deployment procedure
below. A deployment request authorizes updating ONLY its `deploy/<port>` branch.
It does not authorize merging to the base branch, altering another deployment,
deleting application data, or changing host security settings.

### Configuration and meaning

- Trusted integration base: `origin/main`. Change `BASE_BRANCH` below only when the
  repository documents another trusted deployment base or the user specifies it.
- Source: a committed and pushed feature/fix branch in this repository's `origin`.
  Never use a `deploy/*` branch as a source or as the base of feature development.
- Target: `deploy/<host-port>`, e.g. `deploy/30000`. Use an unpadded decimal port
  from 1024 through 65535. `00000` is a placeholder, not a literal port.
- Workflow: `.github/workflows/deploy.yml`. Runtime: Docker Compose on the
  designated Linux self-hosted runner. One port corresponds to one deployment.
- Resolve the source and port from the user's request and repository context.
  When either is genuinely unknown, ask; do not overwrite an arbitrary port.

### Non-negotiable clean-branch rule

Every request starts from a freshly fetched trusted base and merges ONLY the
requested source branch. Replace the remote deployment branch with that result.
Never check out the previous deployment and merge into it, `pull` it, merge it
back into the source/base, or retain its deployment-only commits.

Conceptually:

```text
new deploy/<port> = merge(fresh origin/main, requested source SHA)
NOT                merge(old deploy/<port>, requested source SHA)
```

This removes previous deployment-only changes, even when a previous deployment
failed. It cannot remove unwanted changes already present in `main` or in the
requested source. Review `base..source` history and the source diff first. If the
source itself contains unrelated deployment work, stop and repair the source on
a clean base; do not silently discard or cherry-pick other people's changes.

Use an isolated, temporary Git worktree. Do not reset, clean, stash, switch, or
otherwise discard changes in the user's existing checkout. Do not edit an
existing deployment checkout in place. The only allowed history rewrite is an
exact-SHA `--force-with-lease` push to the requested deployment branch. Never use
plain `--force`, delete/recreate the remote branch, or weaken repository rules.

### Required procedure

1. Confirm the requested source and port, source trust, and the repository's
   documented lint/test/build commands. Commit and push intended source changes;
   never silently include uncommitted edits or deploy a fork's unreviewed code.
2. Fetch the base and source into temporary refs and record both commit SHAs.
   Record the existing remote deployment SHA (or that the branch is absent).
3. Create a detached temporary worktree at the BASE SHA. Merge the SOURCE SHA
   there with a normal non-fast-forward merge. On a conflict, abort and report
   the conflicting files. Do not auto-resolve using `ours` or `theirs`.
4. Review the resulting diff and run the repository's checks in that worktree.
   Do not deploy if checks fail. Deployment workflow changes must first land on
   the trusted base through the normal reviewed process.
5. Push the tested result directly to `refs/heads/deploy/<port>` using the exact
   previously observed SHA as the lease. A rejected lease means another actor
   changed the branch: report the race, do not automatically retry or overwrite.
6. Locate and watch the workflow for that exact commit. A successful push is NOT
   a successful deployment. Report the branch, source/base/deployment SHAs, host
   port, workflow URL, and actual outcome. Treat stale, failed, cancelled, or
   approval-waiting runs as not deployed by this request.

### Reference Bash implementation: prepare, check, and publish

Run from the repository in Bash, with Git author identity and origin credentials
already configured. Set the following environment variables first:

```bash
export SOURCE_BRANCH='feature/my-feature'
export HOST_PORT='30000'
export BASE_BRANCH='main'
# Use this repository's real documented checks; this example is not universal.
export DEPLOY_CHECK_CMD='npm ci && npm test && npm run build'
```

Then run this block in a NEW Bash process (not by sourcing it into a user's shell).
It deliberately changes no local branch and cleans up only its own scratch files.

```bash
set -euo pipefail
: "${SOURCE_BRANCH:?Set the pushed source branch}"
: "${HOST_PORT:?Set the requested host port}"
: "${DEPLOY_CHECK_CMD:?Set the repository lint/test/build command}"
BASE_BRANCH="${BASE_BRANCH:-main}"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
[[ "$HOST_PORT" =~ ^[1-9][0-9]{3,4}$ ]] || fail 'Invalid host port'
(( HOST_PORT >= 1024 && HOST_PORT <= 65535 )) || fail 'Invalid host port'
git check-ref-format "refs/heads/$BASE_BRANCH" >/dev/null
git check-ref-format "refs/heads/$SOURCE_BRANCH" >/dev/null
[[ "$BASE_BRANCH" != deploy/* ]] || fail 'A deployment branch cannot be the base'
[[ "$SOURCE_BRANCH" != deploy/* && "$SOURCE_BRANCH" != "$BASE_BRANCH" ]] ||
  fail 'Use a feature/fix source branch, not the base or a deployment branch'

repo="$(git rev-parse --show-toplevel)"
cd "$repo"
target_ref="refs/heads/deploy/$HOST_PORT"
# Empty means absent. With an empty expected SHA, the push is create-only.
old_sha="$(git ls-remote --heads origin "$target_ref" | cut -f1)"

scratch="$(mktemp -d)"
worktree="$scratch/worktree"
ref_prefix="refs/agent-deploy/$(basename "$scratch")"
cleanup() {
  git -C "$repo" worktree remove --force "$worktree" >/dev/null 2>&1 || true
  git -C "$repo" update-ref -d "$ref_prefix/base" || true
  git -C "$repo" update-ref -d "$ref_prefix/source" || true
  rm -rf -- "$scratch"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# A shallow checkout may not contain the common ancestor needed for a merge.
if [[ "$(git rev-parse --is-shallow-repository)" == true ]]; then
  git fetch --unshallow --no-tags origin
fi
# Unique refs prevent other local fetches from changing our selected snapshots.
git fetch --no-tags origin \
  "refs/heads/$BASE_BRANCH:$ref_prefix/base" \
  "refs/heads/$SOURCE_BRANCH:$ref_prefix/source"
base_sha="$(git rev-parse "$ref_prefix/base^{commit}")"
source_sha="$(git rev-parse "$ref_prefix/source^{commit}")"

git worktree add --detach "$worktree" "$base_sha"
if ! git -C "$worktree" merge --no-ff \
    -m "Deploy $SOURCE_BRANCH ($source_sha) on port $HOST_PORT" "$source_sha"; then
  git -C "$worktree" diff --name-only --diff-filter=U
  git -C "$worktree" merge --abort || true
  fail 'Merge failed; the remote deployment branch was not changed'
fi

# Do not introduce feature-controlled Actions changes onto a self-hosted runner.
git -C "$worktree" diff --quiet "$base_sha" HEAD -- .github/workflows ||
  fail 'Workflow changes must first be reviewed and merged into the trusted base'
git -C "$worktree" diff --stat "$base_sha" HEAD

deploy_sha="$(git -C "$worktree" rev-parse HEAD)"
(
  cd "$worktree"
  bash -euo pipefail -c "$DEPLOY_CHECK_CMD"
)
[[ "$(git -C "$worktree" rev-parse HEAD)" == "$deploy_sha" ]] ||
  fail 'Checks changed the deployment commit'
git -C "$worktree" diff --quiet || fail 'Checks modified tracked files'
git -C "$worktree" diff --cached --quiet || fail 'Checks staged file changes'

# Atomic replacement of this ONE remote ref; safe against concurrent requests.
git -C "$worktree" push \
  --force-with-lease="$target_ref:$old_sha" \
  origin "$deploy_sha:$target_ref"

printf 'Published branch: deploy/%s\nBase SHA: %s\nSource SHA: %s\nDeployment SHA: %s\n' \
  "$HOST_PORT" "$base_sha" "$source_sha" "$deploy_sha"
printf 'This is a branch update, not proof of deployment. Watch GitHub Actions next.\n'
```

If the source is already an ancestor of the base, Git has nothing to merge; the
result is the base commit. Report that fact rather than claiming a new feature
merge. Never manufacture a change just to trigger a push event.

### Triggering and observing Actions

Normal authenticated pushes trigger `deploy.yml`. A push made by another Actions
job using its built-in `GITHUB_TOKEN` does not trigger a push workflow. Also, an
up-to-date push creates no new deployment. In either case, explicitly dispatch
this same workflow on the deployment branch:

```bash
gh workflow run deploy.yml --ref "deploy/$HOST_PORT"
```

Before dispatching, verify the remote branch still points to the SHA just
published. A dispatch targets the branch's current commit, not a caller-specified
SHA. For a caller that is itself an Actions job, pushing requires `contents: write`
and dispatching requires `actions: write`; the deployment job itself remains
`contents: read`. The workflow must already exist on the default branch for manual
dispatch. Do not dispatch a second time when a push-triggered run already exists.

Find the exact run (substitute the printed deployment SHA). Allow for GitHub's
short event-registration delay; do not select an unrelated latest run:

```bash
gh run list --workflow deploy.yml --branch "deploy/$HOST_PORT" \
  --commit "$DEPLOY_SHA" --json databaseId,status,conclusion,url
gh run watch "$RUN_ID" --exit-status
```

Check the run's `Deployment completed` summary and confirm the branch still points
to the deployed SHA before reporting success. Never fabricate a public URL from
the runner name. With the default bind address, access is host-local unless the
operator provides a reverse proxy or changes the bind address/firewall.

## Maintainer setup and runtime contract

Merge these files into the trusted base (and put the workflow on the default
branch) before using this protocol. Integrate these instructions with any existing
`AGENTS.md`; do not discard unrelated repository guidance.

Configure the `preview` GitHub environment, restrict who can deploy, and enable
required reviewers where appropriate. Give the intended Linux runner the custom
`deploy-host` label. All runners with that label must address the same Docker
host, or a port would not identify a stable deployment location. Install a current
Actions runner, Git, Bash, GNU coreutils, Docker Engine, and Docker Compose v2 with
`--wait` / `--wait-timeout` support. Git must support `GIT_CONFIG_COUNT` (2.31+).
The runner account must already be authorized to use Docker and any registries.
Do not grant broad host privileges dynamically from the workflow.

Permit the authorized deployment actor to perform non-fast-forward updates ONLY
to `deploy/*`, while keeping `main` protected. Do not disable repository rules or
broaden bypass rights to work around a denied deployment push. Reserve host ports
across repositories: GitHub concurrency is repository-scoped, not host-wide.

The default workflow reads `compose.yaml`. In the application's existing service,
use a variable HOST port and a fixed CONTAINER port. For an app listening on 8080,
the relevant fragment is:

```yaml
services:
  app:
    build: .
    ports:
      - "${BIND_ADDRESS:-127.0.0.1}:${HOST_PORT:?HOST_PORT must be set}:8080"
    # Keep/add the real application's healthcheck here.
```

Change `app`, the build context, and `8080` to match the repository. Do not replace
the entire existing Compose file with this fragment. For five-digit ports, for
example `deploy/30000`, the workflow exports `HOST_PORT=30000` to Compose.

Build application services from the checked-out source (or reference an image
uniquely tagged/digested for that exact commit). Omit a custom `image:` for locally
built services to let Compose project-scope their image names; otherwise include
the project or commit in the name. Never share a mutable app image tag across
ports. Do not bind-mount the runner checkout, its `.git` directory, or temporary
build files into running containers. Bake application code into images; keep
runtime state in project-scoped named volumes. Do not obscure image code with a
persistent volume. Avoid fixed `container_name`, `network_mode: host`, and shared
explicit volume/network names. Additional published ports also need collision-free
allocation. Compose project names do not isolate explicitly shared resources.

`DEPLOY_BIND_ADDRESS` is an optional repository/environment variable; default is
`127.0.0.1`. `DEPLOY_ENV_FILE` optionally names an absolute readable runner-side env
file; default is `/dev/null`. Protect that file and supply any required app secrets
through an approved mechanism. The workflow exports HOST_PORT itself; do not
hard-code a conflicting port. Do not print resolved Compose configuration or
unredacted application secrets into workflow logs.

A real healthcheck is required to verify application readiness: `up --wait`
otherwise confirms only that containers are running. A failed image build leaves
the running stack alone; a failed `up` may leave a partial update. This is NOT an
atomic/zero-downtime deploy and does NOT automatically roll back database changes.
Named volumes are intentionally preserved. Fresh Git history does not reset data,
undo migrations, remove external side effects, or sanitize a compromised host.
Never run `down --volumes`, `docker system prune`, or global container deletion as
part of this protocol. Branch deletion does not tear down a deployment; teardown
and data removal require a separate explicit request.

Use this runner only for trusted code. Branch-name checks and `AGENTS.md` are not
security boundaries: a user who can modify a workflow, Dockerfile, or Compose file
can execute code on the host or access its resources. Do not add pull-request
triggers or run unreviewed fork code on this privileged runner. Protect workflows
and runner access through repository rules, reviews, and runner-group controls.
