import json
import subprocess
import textwrap
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def run_node_team_script(script: str):
    proc = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", script],
        cwd=REPO_ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(proc.stdout)


def test_team_overview_joins_profiles_tasks_workers_and_skills():
    script = textwrap.dedent(
        """
        import { buildTeamOverview } from './web/src/lib/team.ts';

        const profiles = [
          {
            name: 'hermesplanner',
            path: '/must/not/render',
            is_default: false,
            model: 'claude-sonnet-4',
            provider: 'anthropic',
            has_env: true,
            skill_count: 3,
            gateway_running: false,
            description: 'Plans the work',
            description_auto: false,
            distribution_name: null,
            distribution_version: null,
            distribution_source: null,
            has_alias: false,
          },
          {
            name: 'hermesbuilder',
            path: '/must/not/render',
            is_default: false,
            model: null,
            provider: null,
            has_env: false,
            skill_count: 2,
            gateway_running: false,
            description: '',
            description_auto: false,
            distribution_name: null,
            distribution_version: null,
            distribution_source: null,
            has_alias: false,
          },
        ];
        const board = {
          columns: [
            { name: 'ready', tasks: [{ id: 't_plan', title: 'Map seams', assignee: 'hermesplanner', status: 'ready', skills: ['planning-and-discovery'] }] },
            { name: 'todo', tasks: [{ id: 't_backlog', title: 'Backlog item', assignee: 'hermesbuilder', status: 'todo', created_at: 99, skills: [] }] },
            { name: 'running', tasks: [{ id: 't_build', title: 'Build Team page', assignee: 'hermesbuilder', status: 'running', skills: ['hermes-agent', 'software-quality-lifecycle'] }] },
            { name: 'blocked', tasks: [{ id: 't_blocked', title: 'Review copy', assignee: 'hermesbuilder', status: 'blocked', skills: ['software-quality-lifecycle'] }] },
          ],
        };
        const workers = [
          { run_id: 7, task_id: 't_build', task_title: 'Build Team page', task_status: 'running', task_assignee: 'hermesbuilder', profile: 'hermesbuilder', worker_pid: 123, started_at: 1, last_heartbeat_at: 2 },
        ];

        const overview = buildTeamOverview(profiles, board, workers);
        const planner = overview.find((row) => row.role.key === 'planner');
        const builder = overview.find((row) => row.role.key === 'builder');
        console.log(JSON.stringify({
          roleCount: overview.length,
          plannerProfile: planner?.profile?.name,
          plannerReady: planner?.byStatus.ready,
          builderTotal: builder?.assignedTotal,
          builderRunning: builder?.byStatus.running,
          builderBlocked: builder?.blockedCount,
          builderWorkers: builder?.activeWorkers.length,
          builderSkills: builder?.attachedSkills,
          builderCurrentAssignment: builder?.latestTask?.id,
          reviewerFallback: overview.find((row) => row.role.key === 'reviewer')?.profile,
        }));
        """
    )

    result = run_node_team_script(script)

    assert result == {
        "roleCount": 5,
        "plannerProfile": "hermesplanner",
        "plannerReady": 1,
        "builderTotal": 3,
        "builderRunning": 1,
        "builderBlocked": 1,
        "builderWorkers": 1,
        "builderSkills": ["hermes-agent", "software-quality-lifecycle"],
        "builderCurrentAssignment": "t_blocked",
        "reviewerFallback": None,
    }


def test_juror_research_board_uses_jr_profiles_for_pipeline_counts():
    script = textwrap.dedent(
        """
        import { buildPipelineTimeline, buildTeamOverview, chooseTeamRoles } from './web/src/lib/team.ts';

        const profile = (name) => ({
          name,
          path: '/must/not/render',
          is_default: false,
          model: 'gpt-5.5',
          provider: 'openai-codex',
          has_env: true,
          skill_count: 3,
          gateway_running: false,
          description: '',
          description_auto: false,
          distribution_name: null,
          distribution_version: null,
          distribution_source: null,
          has_alias: false,
        });
        const profiles = [
          profile('jrplanner'),
          profile('jrbuilder'),
          profile('jrreviewer'),
          profile('jrsynth'),
          profile('jrcurator'),
        ];
        const board = {
          columns: [
            { name: 'running', tasks: [{ id: 't_85421307', title: 'JR-STRIKE-SETTINGS-002 implement Box adherence to strike settings', assignee: 'jrbuilder', status: 'running' }] },
          ],
        };
        const workers = [
          { run_id: 1078, task_id: 't_85421307', task_title: 'JR-STRIKE-SETTINGS-002 implement Box adherence to strike settings', task_status: 'running', task_assignee: 'jrbuilder', profile: 'jrbuilder', worker_pid: 123, started_at: 1, last_heartbeat_at: 1000 },
        ];

        const overview = buildTeamOverview(profiles, board, workers, chooseTeamRoles('juror-research'));
        const timeline = buildPipelineTimeline(overview, 1000);
        const builder = timeline.find((stage) => stage.key === 'builder');
        console.log(JSON.stringify({
          roleProfiles: overview.map((member) => member.role.profileName),
          builderProfile: builder?.profileName,
          builderActive: builder?.activeCount,
          builderCurrentTask: builder?.currentTask?.id,
        }));
        """
    )

    result = run_node_team_script(script)

    assert result == {
        "roleProfiles": ["jrplanner", "jrbuilder", "jrreviewer", "jrsynth", "jrcurator"],
        "builderProfile": "jrbuilder",
        "builderActive": 2,
        "builderCurrentTask": "t_85421307",
    }


def test_team_activity_maps_events_safely_and_caps_latest_unique_ids():
    script = textwrap.dedent(
        """
        import { buildTeamActivity } from './web/src/lib/team.ts';

        const board = {
          columns: [
            { name: 'running', tasks: [{ id: 't_build', title: 'Build Team page', assignee: 'hermesbuilder', status: 'running' }] },
            { name: 'blocked', tasks: [{ id: 't_block', title: 'Needs input', assignee: 'hermesplanner', status: 'blocked' }] },
          ],
        };
        const workers = [
          { run_id: 7, task_id: 't_build', task_title: 'Build Team page', task_status: 'running', task_assignee: 'hermesbuilder', profile: 'hermesbuilder', worker_pid: 123, started_at: 1, last_heartbeat_at: 90 },
        ];
        const events = [
          { id: 1, task_id: 't_build', run_id: 7, kind: 'claimed', payload: null, created_at: 10 },
          { id: 2, task_id: 't_build', run_id: 7, kind: 'heartbeat', payload: null, created_at: 20 },
          { id: 3, task_id: 't_build', run_id: 7, kind: 'completed', payload: null, created_at: 30 },
          { id: 4, task_id: 't_block', run_id: null, kind: 'blocked', payload: null, created_at: 40 },
          { id: 5, task_id: 't_misc', run_id: null, kind: 'custom_event', payload: { status: 'ready' }, created_at: 50 },
          { id: 5, task_id: 't_misc', run_id: null, kind: 'custom_event', payload: { status: 'done' }, created_at: 55 },
        ];

        const activity = buildTeamActivity(events, board, workers, 4);
        console.log(JSON.stringify(activity.map((item) => ({ id: item.id, summary: item.summary, tone: item.tone, icon: item.icon, status: item.status }))));
        """
    )

    result = run_node_team_script(script)

    assert result == [
        {"id": 5, "summary": "Kanban event: custom_event", "tone": "outline", "icon": "info", "status": "done"},
        {"id": 4, "summary": "Needs input needs input", "tone": "destructive", "icon": "block", "status": "blocked"},
        {"id": 3, "summary": "hermesbuilder completed Build Team page", "tone": "success", "icon": "check", "status": "running"},
        {"id": 2, "summary": "hermesbuilder checked in", "tone": "success", "icon": "heartbeat", "status": "running"},
    ]


def test_team_readiness_priority_and_pipeline_counts():
    script = textwrap.dedent(
        """
        import { buildPipelineTimeline, buildTeamOverview, computeMemberReadiness } from './web/src/lib/team.ts';

        const profile = (name, overrides = {}) => ({
          name,
          path: '/must/not/render',
          is_default: false,
          model: 'claude',
          provider: 'anthropic',
          has_env: true,
          skill_count: 1,
          gateway_running: false,
          description: '',
          description_auto: false,
          distribution_name: null,
          distribution_version: null,
          distribution_source: null,
          has_alias: false,
          ...overrides,
        });
        const profiles = [
          profile('hermesplanner'),
          profile('hermesbuilder'),
          profile('hermesreviewer', { has_env: false }),
        ];
        const board = {
          columns: [
            { name: 'blocked', tasks: [{ id: 't_block', title: 'Blocked', assignee: 'hermesplanner', status: 'blocked' }] },
            { name: 'running', tasks: [{ id: 't_run', title: 'Running', assignee: 'hermesbuilder', status: 'running' }] },
            { name: 'ready', tasks: [{ id: 't_ready', title: 'Ready', assignee: 'hermesreviewer', status: 'ready' }] },
            { name: 'done', tasks: [{ id: 't_done', title: 'Done', assignee: 'hermessynth', status: 'done' }] },
          ],
        };
        const workers = [
          { run_id: 9, task_id: 't_run', task_title: 'Running', task_status: 'running', task_assignee: 'hermesbuilder', profile: 'hermesbuilder', worker_pid: 999, started_at: 1, last_heartbeat_at: 950 },
        ];
        const overview = buildTeamOverview(profiles, board, workers);
        const byRole = Object.fromEntries(overview.map((member) => [member.role.key, computeMemberReadiness(member, 1000).state]));
        const timeline = buildPipelineTimeline(overview, 1000);
        console.log(JSON.stringify({
          byRole,
          timeline: timeline.map((stage) => ({ key: stage.key, active: stage.activeCount, queued: stage.queuedCount, blocked: stage.blockedCount, done: stage.doneCount, current: stage.currentTask?.id ?? null })),
        }));
        """
    )

    result = run_node_team_script(script)

    assert result["byRole"] == {
        "planner": "blocked",
        "builder": "live",
        "reviewer": "queued",
        "synth": "offline",
        "curator": "offline",
    }
    assert result["timeline"] == [
        {"key": "planner", "active": 0, "queued": 0, "blocked": 1, "done": 0, "current": "t_block"},
        {"key": "builder", "active": 2, "queued": 0, "blocked": 0, "done": 0, "current": "t_run"},
        {"key": "reviewer", "active": 0, "queued": 1, "blocked": 0, "done": 0, "current": "t_ready"},
        {"key": "synth", "active": 0, "queued": 0, "blocked": 0, "done": 1, "current": "t_done"},
        {"key": "curator", "active": 0, "queued": 0, "blocked": 0, "done": 0, "current": None},
    ]


def test_team_board_choice_prefers_team_board_then_valid_selection():
    script = textwrap.dedent(
        """
        import { chooseTeamBoardSlug, formatTeamBoardName } from './web/src/lib/team.ts';

        const boards = [
          { slug: 'default' },
          { slug: 'agent-arena' },
          { slug: 'hermes-team-ui' },
        ];

        console.log(JSON.stringify({
          initial: chooseTeamBoardSlug(boards, 'agent-arena', ''),
          selected: chooseTeamBoardSlug(boards, 'agent-arena', 'default'),
          invalidSelected: chooseTeamBoardSlug(boards, 'agent-arena', 'missing-board'),
          fallbackCurrent: chooseTeamBoardSlug([{ slug: 'default' }, { slug: 'agent-arena' }], 'agent-arena', ''),
          boardLabel: formatTeamBoardName({ slug: 'hermes-team-ui', name: 'Hermes Team UI' }, 'fallback'),
          slugLabel: formatTeamBoardName({ slug: 'agent-arena' }, 'fallback'),
        }));
        """
    )

    result = run_node_team_script(script)

    assert result == {
        "initial": "hermes-team-ui",
        "selected": "default",
        "invalidSelected": "hermes-team-ui",
        "fallbackCurrent": "agent-arena",
        "boardLabel": "Hermes Team UI",
        "slugLabel": "agent-arena",
    }


def test_team_latest_work_and_operational_cues_surface_review_readiness():
    script = textwrap.dedent(
        """
        import { buildTeamLatestWork, buildTeamOperationalCues, buildTeamOverview } from './web/src/lib/team.ts';

        const profile = (name) => ({
          name,
          path: '/must/not/render',
          is_default: false,
          model: 'claude',
          provider: 'anthropic',
          has_env: true,
          skill_count: 1,
          gateway_running: false,
          description: '',
          description_auto: false,
          distribution_name: null,
          distribution_version: null,
          distribution_source: null,
          has_alias: false,
        });
        const team = buildTeamOverview(
          [profile('hermesbuilder'), profile('hermesreviewer')],
          { columns: [
            { name: 'ready', tasks: [{ id: 't_ready', title: 'Dispatch me', assignee: 'hermesbuilder', status: 'ready', created_at: 10 }] },
            { name: 'review', tasks: [{ id: 't_review', title: 'Review diff', assignee: 'hermesreviewer', status: 'review', created_at: 20, latest_summary: 'review-required: inspect safe controls' }] },
            { name: 'done', tasks: [{ id: 't_done', title: 'Finished', assignee: 'hermesbuilder', status: 'done', created_at: 5, latest_summary: 'Implementation ready for review' }] },
          ] },
          [],
        );
        const latest = buildTeamLatestWork(team, 100, 3).map((item) => ({
          id: item.task.id,
          needsReview: item.needsReview,
          hasSummary: item.hasSummary,
          summary: item.summary,
        }));
        const cues = buildTeamOperationalCues(team);
        console.log(JSON.stringify({ latest, cues }));
        """
    )

    result = run_node_team_script(script)

    assert result["latest"] == [
        {"id": "t_review", "needsReview": True, "hasSummary": True, "summary": "review-required: inspect safe controls"},
        {"id": "t_ready", "needsReview": False, "hasSummary": False, "summary": "No worker summary captured yet."},
        {"id": "t_done", "needsReview": False, "hasSummary": True, "summary": "Implementation ready for review"},
    ]
    assert result["cues"]["readyToDispatch"] == 1
    assert result["cues"]["needsReview"] == 1
    assert result["cues"]["hasLatestSummaries"] == 2
    assert result["cues"]["cue"] == "1 task waiting on review/readiness."


def test_team_presentation_route_is_unlisted_read_only_and_uses_shared_hook():
    app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()
    team_source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()
    present_source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPresentPage.tsx").read_text()

    assert '"/team/present": TeamPresentPage' in app_source
    assert '{ path: "/team/present"' not in app_source
    assert 'to="/team/present"' in team_source
    assert "useTeamDashboardData" in present_source
    assert "Presentation mode" in team_source
    assert "Team presentation mode" in present_source
    assert "without inventing demo data" in present_source
    assert "dispatchKanban" not in present_source
    assert "window.confirm" not in present_source
    assert "__HERMES_SESSION_TOKEN__" not in present_source


def test_team_page_does_not_render_profile_paths_or_env_values():
    source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()

    assert ".path" not in source
    assert "has_env" not in source
    assert "__HERMES_SESSION_TOKEN__" not in source
    assert "revealEnvVar" not in source
    assert "No destructive actions, no commits/pushes" in source
    assert "window.confirm" in source


def test_team_page_load_error_handler_is_stable_to_avoid_fetch_loop():
    source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()

    assert "const handleLoadError = useCallback(" in source
    assert "useTeamDashboardData({ onLoadError: handleLoadError })" in source
    assert "onLoadError: (error)" not in source


def test_team_topology_classifies_graph_shape_and_truthful_copy():
    script = textwrap.dedent(
        """
        import { buildTeamTopology, chooseTeamRoles } from './web/src/lib/team.ts';
        const task = (id, status, assignee = 'jrbuilder', extra = {}) => ({ id, title: id, status, assignee, ...extra });
        const board = (tasks, links) => ({ columns: [{ name: 'work', tasks }], ...(links === undefined ? {} : { links }) });
        const roles = chooseTeamRoles('juror-research');
        const chain = buildTeamTopology(board([task('Foundation', 'done'), task('Builder', 'running'), task('Proof', 'todo'), task('Synth', 'todo')], [{parent_id:'Foundation',child_id:'Builder'},{parent_id:'Builder',child_id:'Proof'},{parent_id:'Proof',child_id:'Synth'}]), [], roles);
        const parallel = buildTeamTopology(board([task('Foundation', 'done'), task('A', 'running'), task('B', 'running')], [{parent_id:'Foundation',child_id:'A'},{parent_id:'Foundation',child_id:'B'}]), [], roles);
        const mixed = buildTeamTopology(board([task('Foundation', 'running'), task('A', 'todo'), task('B', 'todo')], [{parent_id:'Foundation',child_id:'A'},{parent_id:'Foundation',child_id:'B'}]), [], roles);
        const blocked = buildTeamTopology(board([task('Foundation', 'done'), task('Builder', 'blocked'), task('Proof', 'todo')], [{parent_id:'Foundation',child_id:'Builder'},{parent_id:'Builder',child_id:'Proof'}]), [], roles);
        const activeWithSeparateBlock = buildTeamTopology(board([task('Foundation', 'done'), task('Builder', 'running'), task('This title must not appear in the topology badge because it is intentionally much longer than a concise status', 'blocked')], [{parent_id:'Foundation',child_id:'Builder'},{parent_id:'Foundation',child_id:'This title must not appear in the topology badge because it is intentionally much longer than a concise status'}]), [], roles);
        const done = buildTeamTopology(board([task('Foundation', 'done'), task('Builder', 'done')], [{parent_id:'Foundation',child_id:'Builder'}]), [], roles);
        const missing = buildTeamTopology(board([task('A', 'running')]), [], roles);
        const external = buildTeamTopology(board([task('Foundation', 'running', 'rorycodex-cli', {workspace_kind:'dir',workspace_path:'/safe/shared'}), task('Builder', 'todo', 'jrbuilder', {workspace_kind:'dir',workspace_path:'/safe/shared'})], [{parent_id:'Foundation',child_id:'Builder'}]), [{run_id:1,task_id:'Foundation',task_title:'Foundation',task_status:'running',task_assignee:'rorycodex-cli',profile:'rorycodex-cli',worker_pid:1,started_at:1,last_heartbeat_at:2}], roles);
        const selected = buildTeamTopology(board([task('Selected', 'running'), task('Foreign', 'ready')], [{parent_id:'Selected',child_id:'Foreign'}]), [], roles);
        const orphanEdge = buildTeamTopology(board([task('A', 'running')], [{parent_id:'A',child_id:'Missing'}]), [], roles);
        const cycle = buildTeamTopology(board([task('A', 'running'), task('B', 'ready')], [{parent_id:'A',child_id:'B'},{parent_id:'B',child_id:'A'}]), [], roles);
        const unrelatedCurrent = buildTeamTopology(board([task('A', 'running'), task('B', 'ready'), task('C', 'ready'), task('D', 'todo')], [{parent_id:'A',child_id:'B'},{parent_id:'C',child_id:'D'}]), [], roles);
        const missingWorkspace = buildTeamTopology(board([task('A', 'running'), task('B', 'todo')], [{parent_id:'A',child_id:'B'}]), [], roles);
        const mixedWorkspace = buildTeamTopology(board([task('A', 'running', 'jrbuilder', {workspace_kind:'dir',workspace_path:'/safe/one'}), task('B', 'todo', 'jrbuilder', {workspace_kind:'dir',workspace_path:'/safe/two'})], [{parent_id:'A',child_id:'B'}]), [], roles);
        const worktreeWorkspace = buildTeamTopology(board([task('A', 'running', 'jrbuilder', {workspace_kind:'worktree',workspace_path:'/safe/shared'}), task('B', 'todo', 'jrbuilder', {workspace_kind:'worktree',workspace_path:'/safe/shared'})], [{parent_id:'A',child_id:'B'}]), [], roles);
        console.log(JSON.stringify({chain,parallel,mixed,blocked,activeWithSeparateBlock,done,missing,external,selected,orphanEdge,cycle,unrelatedCurrent,missingWorkspace,mixedWorkspace,worktreeWorkspace}));
        """
    )
    result = run_node_team_script(script)

    assert result["chain"]["label"] == "RELAY · 1 ACTIVE AT A TIME"
    assert result["chain"]["nextLine"] == "Next: Builder after Builder"
    assert result["chain"]["waitingLine"] == "2 stages waiting — not blocked"
    assert result["parallel"]["label"] == "PARALLEL SWARM · 2 BRANCHES ACTIVE"
    assert result["mixed"]["label"] == "MIXED · RELAY NOW, SWARM NEXT"
    assert result["blocked"]["phase"] == "blocked"
    assert result["blocked"]["label"] == "RELAY · BLOCKED"
    assert result["blocked"]["waitingLine"] is None
    assert result["activeWithSeparateBlock"]["phase"] == "active"
    assert result["activeWithSeparateBlock"]["label"] == "MIXED · RELAY NOW, SWARM NEXT"
    assert result["activeWithSeparateBlock"]["reason"] == "Active work continues; a separate handoff is paused"
    assert result["activeWithSeparateBlock"]["nextLine"] == "Next handoff paused until the block is resolved"
    assert result["activeWithSeparateBlock"]["blockedTaskIds"] == ["This title must not appear in the topology badge because it is intentionally much longer than a concise status"]
    assert "This title must not appear" not in result["activeWithSeparateBlock"]["label"]
    assert result["done"]["label"] == "RELAY COMPLETE · 2 STAGES"
    assert result["missing"]["label"] == "TOPOLOGY UNKNOWN"
    assert result["external"]["externalExecutors"][0]["name"] == "rorycodex-cli"
    assert result["external"]["nextLine"] == "Next: Builder after Foundation"
    assert result["external"]["verifiedSharedWorkspace"]["kind"] == "dir"
    assert result["selected"]["activeTaskIds"] == ["Selected"]
    for invalidGraph in ("orphanEdge", "cycle", "unrelatedCurrent"):
        assert result[invalidGraph]["kind"] == "unknown"
        assert result[invalidGraph]["evidenceComplete"] is False
    assert result["orphanEdge"]["reason"] == "Dependency data is invalid"
    assert result["cycle"]["reason"] == "Dependency data is invalid"
    assert result["unrelatedCurrent"]["reason"] == "Multiple independent work graphs"
    for incompleteWorkspace in ("missingWorkspace", "mixedWorkspace", "worktreeWorkspace"):
        assert result[incompleteWorkspace]["verifiedSharedWorkspace"] is None


def test_team_topology_is_shared_by_both_surfaces_with_visible_accessible_copy():
    hook_source = (REPO_ROOT / "web" / "src" / "hooks" / "useTeamDashboardData.ts").read_text()
    team_source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()
    present_source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPresentPage.tsx").read_text()

    assert "buildTeamTopology(board, activeWorkers, teamRoles)" in hook_source
    for source in (team_source, present_source):
        assert "Execution topology" in source
        assert "aria-live=\"polite\"" in source
        assert 'className="sr-only" aria-live="polite">{topology.announcement}' in source
        assert source.count("topology.announcement") == 1
        assert "External executor" in source
        assert "topology.label" in source
        assert 'text-muted-foreground">{topology.reason}</div>' in source


def test_team_topology_distinguishes_fan_in_current_join_and_ready_only_fan_out():
    script = textwrap.dedent(
        """
        import { buildTeamTopology, chooseTeamRoles } from './web/src/lib/team.ts';
        const task = (id, status, assignee = 'jrbuilder') => ({ id, title: id, status, assignee });
        const board = (tasks, links) => ({ columns: [{ name: 'work', tasks }], links });
        const roles = chooseTeamRoles('juror-research');
        const fanIn = buildTeamTopology(board(
          [task('A', 'running'), task('B', 'ready'), task('Join', 'todo')],
          [{ parent_id: 'A', child_id: 'Join' }, { parent_id: 'B', child_id: 'Join' }],
        ), [], roles);
        const currentJoin = buildTeamTopology(board(
          [task('Fork', 'done'), task('A', 'done'), task('B', 'done'), task('Join', 'running'), task('After', 'todo')],
          [{ parent_id: 'Fork', child_id: 'A' }, { parent_id: 'Fork', child_id: 'B' }, { parent_id: 'A', child_id: 'Join' }, { parent_id: 'B', child_id: 'Join' }, { parent_id: 'Join', child_id: 'After' }],
        ), [], roles);
        const readyFanOut = buildTeamTopology(board(
          [task('Fork', 'done'), task('A', 'ready'), task('B', 'ready')],
          [{ parent_id: 'Fork', child_id: 'A' }, { parent_id: 'Fork', child_id: 'B' }],
        ), [], roles);
        const readyChain = buildTeamTopology(board(
          [task('Foundation', 'done'), task('Builder', 'ready')],
          [{ parent_id: 'Foundation', child_id: 'Builder' }],
        ), [], roles);
        console.log(JSON.stringify({ fanIn, currentJoin, readyFanOut, readyChain }));
        """
    )

    result = run_node_team_script(script)

    assert result["fanIn"]["kind"] == "converging"
    assert result["fanIn"]["label"] == "CONVERGING GATES · NO FAN-OUT VERIFIED"
    assert "fan-out" in result["fanIn"]["reason"]
    assert result["currentJoin"]["label"] == "MIXED · JOIN NOW"
    assert result["currentJoin"]["reason"] == "Verified branches converge at the current dependency join"
    assert result["readyFanOut"]["phase"] == "ready"
    assert result["readyFanOut"]["label"] == "PARALLEL FAN-OUT · 2 BRANCHES READY"
    assert result["readyChain"]["phase"] == "ready"
    assert result["readyChain"]["label"] == "RELAY · READY TO DISPATCH"


def test_external_live_worker_updates_operational_cues_without_lighting_a_roster_lane():
    script = textwrap.dedent(
        """
        import { buildTeamOperationalCues, buildTeamOverview, chooseTeamRoles } from './web/src/lib/team.ts';
        const workers = [{
          run_id: 1, task_id: 'external', task_title: 'External current work', task_status: 'running',
          task_assignee: 'rorycodex-cli', profile: 'rorycodex-cli', worker_pid: 10, started_at: 1, last_heartbeat_at: 2,
        }];
        const team = buildTeamOverview([], {
          columns: [{ name: 'running', tasks: [{ id: 'external', title: 'External current work', assignee: 'rorycodex-cli', status: 'running' }] }],
        }, workers, chooseTeamRoles('juror-research'));
        const cues = buildTeamOperationalCues(team, workers, chooseTeamRoles('juror-research'));
        console.log(JSON.stringify({
          cues,
          rosterActiveCounts: team.map((member) => member.activeWorkers.length),
          rosterAssignments: team.map((member) => member.assignedTotal),
        }));
        """
    )

    result = run_node_team_script(script)

    assert result["cues"]["liveWorkers"] == 1
    assert result["cues"]["externalLiveWorkers"] == 1
    assert result["cues"]["cue"] == "1 external live worker active now."
    assert result["rosterActiveCounts"] == [0, 0, 0, 0, 0]
    assert result["rosterAssignments"] == [0, 0, 0, 0, 0]

    team_page_source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()
    assert "operationalCues.externalLiveWorkers > 0 ? \"External worker is active now\"" in team_page_source
    assert "no roster lane is marked active for that worker" in team_page_source
