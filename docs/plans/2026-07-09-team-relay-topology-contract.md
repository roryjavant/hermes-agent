# Team Relay / Parallel Swarm Topology Contract

## Goal

Make the existing Team room explain verified Kanban execution topology at a glance:

- a dependency chain is a **relay**, not an idle/broken swarm;
- a real dependency fork with concurrently eligible branches is a **parallel swarm**;
- a graph that changes between serial and parallel phases is **mixed**;
- missing/incomplete dependency evidence stays **unknown** rather than being guessed;
- an active assignee outside the five-role roster remains visible as the executor without falsely lighting a roster role.

This is a compact status/copy addition to the existing pipeline. It is not a graph-editor rewrite, a second Kanban board, or an animation project.

## Current-state findings

### Client data flow

- `web/src/hooks/useTeamDashboardData.ts:71-79` loads `/api/plugins/kanban/board` and `/api/plugins/kanban/workers/active`; `:198-233` derives roster-only overview, pipeline, cues, and totals.
- `web/src/lib/team.ts:313-357` flattens board tasks and then filters them into the configured five-role roster. A task assigned to `rorycodex-cli` is therefore absent from `team`, pipeline counts, latest work, and live-worker totals.
- `web/src/lib/team.ts:555-572` builds a role timeline from status counts only. It has no dependency edges and cannot distinguish relay from fan-out.
- `web/src/pages/TeamPage.tsx:668-743` is the compact pipeline seam in the normal room. The five role lanes are rendered at `:687-721`.
- `web/src/pages/TeamPresentPage.tsx:180-209` is the matching read-only presentation seam.
- Existing role health dots are status/readiness indicators, not topology indicators. Do not overload them to claim that a roster role is executing external work.

### Available Kanban payload

`GET /api/plugins/kanban/board` is mounted by `hermes_cli/web_server.py:14014-14123`, not by `tui_gateway/server.py`. `tui_gateway` is not in this data path and needs no change.

The board endpoint in `plugins/kanban/dashboard/plugin_api.py:378-508` currently emits:

- all non-archived tasks grouped by status;
- task fields serialized through `_task_dict()` / `asdict(task)` at `plugin_api.py:158-176`, including `workspace_kind` and `workspace_path` from `hermes_cli/kanban_db.py:838-875`;
- only per-task `link_counts` at `plugin_api.py:409-419,467-470`, not parent/child IDs;
- no board-level dependency-edge list.

The task-detail endpoint returns exact `parents` and `children` for one task at `plugin_api.py:517-571`, but fetching every detail would create an avoidable N+1 request pattern.

Current TypeScript declarations at `web/src/lib/api.ts:2216-2232` omit `workspace_kind` and `workspace_path`, despite those fields being present at runtime. They expose only `link_counts`. `KanbanTaskDetailResponse.links` is incorrectly broad (`Array<Record<string, unknown>>`) at `:2264-2271`; the runtime shape is `{ parents: string[]; children: string[] }`.

### Live graph evidence inspected

The current `juror-research` SQLite payload changed while this plan was being prepared, which is exactly why the UI must describe data rather than assume a permanent lane. The newest Box selection component is a verified chain:

```text
ROOT (done, jurorcoordinator)
  → map (done, rorycodex-cli)
  → foundation (done, rorycodex-cli)
  → compact UI (blocked/review-required, jrbuilder)
  → proof (todo, jrreviewer)
  → synth (todo, jrsynth)
  → land (todo, jurorcoordinator)
```

Events `10311-10335` show the non-roster `rorycodex-cli` lane claimed and completed the map/foundation stages sequentially; event `10336` then promoted the roster Builder. By inspection time, the external lane was no longer active and Builder had moved to a review-required block (`10349`). A correct live UI would therefore have shown `External executor · rorycodex-cli` during those claims, then transitioned to `RELAY · BLOCKED AT BUILDER` without leaving stale external activity behind. Every task in this component explicitly carries `workspace_kind=dir` and the same workspace path, so this particular component qualifies for generic `Shared directory verified` copy; that fact must still be recomputed per payload.

The isolated `hermes-team-relay-ui` board for this implementation is also a strict chain (`root → planner → builder → reviewer → synth`) and all cards explicitly share one `dir` workspace. These two observed graphs validate the relay use case but are not hard-coded fixtures or title-based conventions.

### Smallest safe DTO addition

Extend the existing board response, without adding an endpoint:

```text
KanbanBoardResponse {
  ...existing fields,
  links: Array<{ parent_id: string; child_id: string }>;
}

KanbanTaskSummary {
  ...existing fields,
  workspace_kind?: "scratch" | "dir" | "worktree" | string;
  workspace_path?: string | null;
}
```

Implementation seam: retain the already-fetched `task_links` rows in `plugins/kanban/dashboard/plugin_api.py:409-419` and emit them as top-level `links` at `:500-508`. Do not issue a second query. Include only edges whose endpoints are included in the returned board task set when board filters (`tenant`, workflow filters, archived exclusion) are active; otherwise the client receives orphaned edges and must downgrade to unknown.

Backwards compatibility: make `links` optional in TypeScript for one release (`links?: KanbanTaskLink[]`). Absence means `unknown`; it never means “no dependencies.” No `tui_gateway/server.py` edit is warranted.

## Deterministic topology model

Add pure helpers in `web/src/lib/team.ts`; keep React components declarative.

Suggested public contract:

```text
TeamTopologyKind = "relay" | "parallel" | "mixed" | "idle" | "unknown"
TeamTopologyPhase = "active" | "waiting" | "blocked" | "complete" | "idle"

TeamTopology {
  kind
  phase
  label
  reason
  activeTaskIds
  activeExecutors
  waitingTaskIds
  blockedTaskIds
  nextTaskIds
  verifiedSharedWorkspace: { kind: "dir"; path: string } | null
  evidenceComplete: boolean
}
```

### Graph scope and validation

1. Flatten all board columns; exclude archived tasks (normally already excluded by the endpoint).
2. Build edges only from `board.links`.
3. Validate every endpoint exists, no self-edge exists, and the graph is acyclic.
4. A weakly connected component is “current” when it contains a nonterminal task (`triage`, `todo`, `scheduled`, `ready`, `running`, `blocked`, or `review`). Include its done ancestors so the current handoff can be explained.
5. If more than one unrelated current component exists, do not call it a swarm. Return `unknown` with reason `Multiple independent work graphs` unless a future payload explicitly groups them.
6. A task is dependency-waiting only when it is `todo` or `scheduled` and at least one explicit parent is not done. `blocked` is never counted as dependency-waiting.
7. A task is frontier-eligible when every explicit parent is done and status is `ready`, `running`, or `review`. `review` is a live handoff lane, not a worker claim.
8. An active executor comes from `/workers/active` when available, then the running task assignee as a fallback. Preserve unknown/non-roster names verbatim.

### Classification

- **idle**: board has no tasks, or no current component and no completed dependency component worth summarizing.
- **unknown**: `links` is absent; validation fails; active tasks have nonzero `link_counts` not represented by exact edges; active tasks exist but are unrelated standalone cards; or multiple independent current components exist. Copy must say dependency data is incomplete/unrelated, not relay or swarm.
- **relay**: exactly one current component, at least one edge, no node has more than one child or more than one parent, and the component is a single chain. Runtime worker count does not define this state.
- **parallel**: a verified fork exists (a node has two or more child branches with unfinished descendants) and at least two frontier-eligible/running tasks lie on distinct fork branches now. Multiple todo cards alone cannot satisfy this rule.
- **mixed**: a verified fork exists but the current frontier width is less than two (serial foundation now, fan-out later), or the component contains both a multi-branch phase and a serial join/tail. Copy identifies the current phase (`Relay now · swarm next` or `Swarm now · join next`).

Phase is orthogonal:

- `blocked` if any task on the next required frontier is truly blocked;
- `active` if any worker/running task exists;
- `waiting` if unfinished dependency-gated tasks exist but no worker is active;
- `complete` if the verified component is fully done;
- `idle` only for an empty/no-current board.

### Truth table

| Input graph / status | Result | Required explanation |
|---|---|---|
| `A(done) → B(running) → C(todo) → D(todo)` | relay / active | `RELAY · 1 ACTIVE AT A TIME`; `Sequential by dependency`; `B running`; `Next: C after B`; `2 stages waiting — not blocked` |
| `A(done) → {B(running), C(running)}` | parallel / active | `PARALLEL SWARM · 2 BRANCHES ACTIVE`; `Fan-out verified from A`; name B/C executors |
| `A(running) → {B(todo), C(todo)}` | mixed / active | `MIXED · RELAY NOW, SWARM NEXT`; `Foundation running`; `Next: 2 branches after A` |
| `{B(running), C(running)} → D(todo)` after a verified fork | mixed / active | `MIXED · SWARM NOW, JOIN NEXT`; `Next: D after 2 branches` |
| `A(done) → B(blocked) → C(todo)` | relay / blocked | `RELAY · BLOCKED AT B`; never `2 waiting — not blocked`; `Next handoff paused until B is resolved` |
| `A(done) → B(done) → C(done)` | relay / complete | `RELAY COMPLETE · 3 STAGES`; no active/waiting claim |
| tasks present, `links` absent, while `link_counts` are nonzero | unknown | `TOPOLOGY UNKNOWN`; `Dependency details unavailable`; still show factual worker/task status |
| several unrelated todo/ready cards with no verified edges | unknown | `TOPOLOGY UNKNOWN`; never `parallel swarm` |
| no tasks | idle | `TEAM IDLE`; `No current board work` |
| malformed/orphan/cyclic edge payload | unknown | `TOPOLOGY UNKNOWN`; optional console diagnostic, no confident UI claim |

## Copy contract

Copy is assembled from verified facts, not task-title parsing.

Primary badge:

- relay active: `RELAY · 1 ACTIVE AT A TIME`
- parallel active: `PARALLEL SWARM · N BRANCHES ACTIVE`
- mixed serial phase: `MIXED · RELAY NOW, SWARM NEXT`
- mixed branch phase: `MIXED · SWARM NOW, JOIN NEXT`
- blocked: append/replace with `BLOCKED AT <stage/task>`
- complete: `<RELAY|SWARM|MIXED> COMPLETE`
- unknown: `TOPOLOGY UNKNOWN`
- empty: `TEAM IDLE`

Reason line examples:

- `Sequential by dependency`
- `Foundation running`
- `Next: Builder after Foundation`
- `4 stages waiting — not blocked`
- `Fan-out verified from Foundation`
- `Dependency details unavailable`

Rules:

- Prefer roster role label when the assignee exactly maps to a configured role; otherwise use the task title or assignee, never infer a role from title text.
- “Next” requires an explicit edge from the current task/branch to the child and satisfied ordering semantics.
- “waiting — not blocked” includes only dependency-waiting todo/scheduled tasks and is suppressed if any counted task is blocked.
- “shared checkout” is allowed only when every unfinished task in the current component has explicit `workspace_kind === "dir"`, a nonempty `workspace_path`, and the same normalized path. Never infer it from board name, repo name, a single active task, `scratch`, `worktree`, or missing fields. Prefer generic UI copy (`Shared directory verified`) and do not display the full local path in the Team room.
- Never call a `review-required` block ordinary dependency waiting; existing review copy remains authoritative.

## External / non-roster executor contract

Do not silently drop active `rorycodex-cli`, `mattcodex-cli`, or future external assignees.

- Derive `externalExecutors` from active workers and running tasks whose normalized assignee/profile does not map to `chooseTeamRoles()`.
- Render one compact bridge row inside the pipeline card, above the five role lanes: `External executor · rorycodex-cli` + current task + factual worker/readiness badge.
- The dependency node/task is active in the topology strip even though no roster role owns it.
- Keep all five role rings truthful: do not pulse Planner or Builder merely because an external executor is active.
- If an explicit child edge points to a roster assignee, mark that roster lane `next / dependency waiting`, e.g. `Next: Builder after Foundation`. This prevents the room from looking dead without claiming fake activity.
- If multiple external executors are verified active, show up to two names plus `+N`; the topology badge carries the authoritative branch count.

## Placement and behavior

### Normal Team room

At `web/src/pages/TeamPage.tsx:668-686`, add a compact topology header between the section description and existing badges (or replace the overly generic active-worker badge group):

1. primary topology badge;
2. one reason line;
3. optional active executor / next handoff line;
4. optional external-executor bridge row immediately before the lane grid at `:687`.

Keep the existing five lane cards and horizontal overflow behavior. Do not add a large node-link canvas.

### Presentation room

Mirror the same derived `topology` object at `web/src/pages/TeamPresentPage.tsx:180-209`: primary badge + reason above the existing cards, and the same external bridge row. The presentation page remains read-only.

### Mobile and accessibility

- At narrow widths, stack badge, reason, current executor, and next handoff vertically; retain the existing horizontally scrollable five-lane strip rather than shrinking text below `text-xs`.
- Use visible text for state; color and pulsing dots are supplementary only.
- Wrap the topology summary in a named region (`aria-labelledby`) and use an `aria-live="polite"` text node for topology changes caused by WebSocket refresh. Do not announce heartbeat-only updates when the topology/copy string is unchanged.
- External executor row must include task title and assignee in text; the icon may be `aria-hidden`.
- Honor reduced motion; no new animation is required.
- Use semantic text tokens and the repository’s 12px minimum from `web/README.md:55-80`.

## Builder scope by file

1. `plugins/kanban/dashboard/plugin_api.py:409-419,500-508`
   - reuse fetched link rows;
   - filter edges to emitted task IDs;
   - add top-level `links`.
2. `web/src/lib/api.ts:2216-2232,2295-2301`
   - type workspace fields;
   - add `KanbanTaskLink` and optional `KanbanBoardResponse.links`.
   - optionally correct task-detail `links` shape while touching the contract, only if no consumers rely on the broad type.
3. `web/src/lib/team.ts:31-151,313-357,555-618`
   - consolidate the duplicate local Kanban summary shape with imported API types if practical;
   - add graph validation/classification, shared-workspace proof, executor mapping, and copy builders as pure functions;
   - preserve existing readiness behavior.
4. `web/src/hooks/useTeamDashboardData.ts:198-233,244-274`
   - compute `topology` from board + active workers + selected roster and return it;
   - ensure external workers contribute to topology without corrupting roster totals.
5. `web/src/pages/TeamPage.tsx:668-721`
   - render compact topology summary and external executor bridge.
6. `web/src/pages/TeamPresentPage.tsx:180-209`
   - render the same read-only summary.
7. `tests/plugins/test_kanban_dashboard_plugin.py:67-112,268-290`
   - assert board payload exact edge IDs, filtered-board orphan exclusion, and workspace fields.
8. `tests/web/test_team_overview.py:21-266,303-390`
   - add table-driven Node tests for classification/copy/external executor/shared-workspace invariants.

No production change is needed in `tui_gateway/server.py`.

## Focused tests

Backend behavior:

- chain emits exact ordered edge pairs and existing link counts;
- fan-out emits both sibling edges;
- tenant/workflow-filtered board omits edges to tasks not in payload;
- task summaries expose explicit `workspace_kind/path` without adding new filesystem reads.

Pure TypeScript behavior (table-driven, relationship assertions rather than snapshots of roster size):

- chain, active fan-out, pre-fork mixed, post-fork join mixed, blocked frontier, all done, missing links, orphan edge, cycle, unrelated cards, empty board;
- multiple todo cards without edges never classify parallel;
- external active worker is preserved and no roster member becomes falsely live;
- exact child edge produces next-role copy;
- shared-dir proof requires all unfinished component tasks to agree; missing/mixed/worktree data returns null;
- waiting count excludes blocked tasks.

UI/source behavior:

- both Team pages consume the same `topology` object/helper;
- presentation remains free of dispatch/update calls;
- visible text exists for every topology state;
- aria-live is polite and tied to stable topology copy, not raw heartbeat count.

Verification commands:

```text
scripts/run_tests.sh tests/plugins/test_kanban_dashboard_plugin.py -q
scripts/run_tests.sh tests/web/test_team_overview.py -q
npm --workspace web run typecheck
npm --workspace web run test
npm --workspace web run build
```

Preview (do not restart an existing service implicitly):

```text
# terminal 1, repo root — backend on 9119
python -m hermes_cli.main web --no-open

# terminal 2 — Vite/HMR on 5173, proxying /api to 9119
npm --workspace web run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/team` and `http://127.0.0.1:5173/team/present`. The built dashboard on 9119 will not reflect source edits until the web build is produced.

## Risks and stop conditions

- **Filtered orphan edges:** backend must filter to emitted tasks. Stop if a board filter cannot guarantee this.
- **Historic graph noise:** classify only the one current connected component. Stop and show unknown if multiple unrelated current components exist; do not invent a “swarm.”
- **Cycles/bad links:** downgrade to unknown; do not attempt graph repair client-side.
- **Role inference:** never infer Planner/Builder from title words. Stop at external executor when assignee is not in the roster.
- **Workspace privacy/truth:** do not render full local paths and do not claim shared checkout unless every unfinished task proves the same explicit dir path.
- **Status conflation:** dependency waiting is not blocked; review-required remains a human gate.
- **Scope:** no animation framework, topology editor, new endpoint, task-title convention, service restart, credential change, commit, or push.

## Handoff acceptance

The builder is done when focused tests prove graph classification and DTO integrity, both Team surfaces show the same compact truthful topology summary, external executors remain visible, and `typecheck`, web tests, and build pass. The reviewer should reject any implementation that derives parallelism from card count/current worker count, lights a roster ring for an external executor, or claims shared checkout from incomplete workspace evidence.
