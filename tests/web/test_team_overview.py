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


def test_agent_arena_board_uses_visual_specialist_profiles():
    script = textwrap.dedent(
        """
        import { buildTeamOverview, chooseTeamRoles } from './web/src/lib/team.ts';

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
          profile('aaplanner'),
          profile('aaimplementor'),
          profile('aadesigner'),
          profile('aavisionqa'),
          profile('aacurator'),
        ];
        const board = {
          columns: [
            { name: 'running', tasks: [{ id: 'aa_visual', title: 'Polish live table', assignee: 'aadesigner', status: 'running' }] },
            { name: 'review', tasks: [{ id: 'aa_qa', title: 'Inspect screenshot OCR', assignee: 'aavisionqa', status: 'review' }] },
          ],
        };

        const overview = buildTeamOverview(profiles, board, [], chooseTeamRoles('agent-arena'));
        console.log(JSON.stringify({
          roleProfiles: overview.map((member) => member.role.profileName),
          roleLabels: overview.map((member) => member.role.label),
          designerRunning: overview.find((row) => row.role.key === 'designer')?.byStatus.running,
          visionReview: overview.find((row) => row.role.key === 'visionqa')?.byStatus.review,
        }));
        """
    )

    result = run_node_team_script(script)

    assert result == {
        "roleProfiles": ["aaplanner", "aaimplementor", "aadesigner", "aavisionqa", "aacurator"],
        "roleLabels": ["Arena Planner", "Implementor", "Creative Director", "Vision QA", "Curator"],
        "designerRunning": 1,
        "visionReview": 1,
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


def test_team_sidebar_item_sits_directly_under_launchpad():
    app_source = (REPO_ROOT / "web" / "src" / "App.tsx").read_text()

    launchpad_index = app_source.index('path: "/launchpad"')
    team_index = app_source.index('path: "/team"')
    knowledge_index = app_source.index('path: "/knowledge-base"')

    assert launchpad_index < team_index < knowledge_index


def test_team_page_does_not_render_profile_paths_or_env_values():
    source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()

    assert ".path" not in source
    assert "has_env" not in source
    assert "__HERMES_SESSION_TOKEN__" not in source
    assert "revealEnvVar" not in source
    assert "No destructive actions, no commits/pushes" in source
    assert "window.confirm" in source


def test_team_page_condenses_roster_into_meet_the_team_orbs_with_modal_details():
    source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()

    assert "Meet the Team" in source
    assert "Blue profile-agent circles keep the roster compact" in source
    assert source.index("Meet the Team") < source.index("Pipeline status")
    assert "setSelectedTeamMemberKey(member.role.key)" in source
    assert "selectedTeamMember &&" in source
    assert "role=\"dialog\"" in source
    assert "TeamMemberDetails" in source
    assert "Current assignment" in source
    assert "SOUL.md" in source
    assert source.count("Meet the Team") == 1
    assert "w-24 flex-col" not in source


def test_team_page_load_error_handler_is_stable_to_avoid_fetch_loop():
    source = (REPO_ROOT / "web" / "src" / "pages" / "TeamPage.tsx").read_text()

    assert "const handleLoadError = useCallback(" in source
    assert "useTeamDashboardData({ onLoadError: handleLoadError })" in source
    assert "onLoadError: (error)" not in source


def test_mission_control_keeps_projected_pty_activity_rows_visible():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert 'record.source !== "dashboard" && !record.activity_id.startsWith("pty:")' not in source
    assert "approval/review prompts turn" in source


def test_mission_control_attention_queue_excludes_ready_work():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert 'const MISSION_QUEUE_ATTENTION_STATUSES = new Set(["blocked", "review", "running"]);' in source
    assert 'tasks.filter((task) => ["blocked", "review", "running", "ready"].includes(task.status))' not in source
    assert "Ready work is available under All." in source


def test_mission_control_score_ignores_stale_disabled_cron_and_unassigned_profiles():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert "job.enabled && job.last_error" in source
    assert "data.cronJobs.filter((job) => job.last_error)" not in source
    assert "data.activity?.profile_teams" in source
    assert "data.profiles.filter((profile) => !profile.has_env)" not in source


def test_mission_control_team_role_glyphs_cover_domain_specialists():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert 'normalized.includes("strategist")' in source
    assert 'normalized.includes("scout")' in source
    assert 'normalized.includes("analyst")' in source
    assert 'normalized.includes("fact")' in source
    assert 'normalized.includes("analytics")' in source
    assert "Profile-backed role agents per project team" in source
    assert "Five profile-backed role agents per coding team" not in source


def test_mission_control_team_role_lights_open_dossier_with_profile_chat_launch():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert "function profileChatPath" in source
    assert "Launch chat" in source
    assert "onClick={() => openLightAgent(item)}" in source
    assert "to={launchHref}" in source
    assert "Launch ${item.profileName} in Chat" not in source
    assert "to={profileChatPath(item.profileName)}" not in source
    assert "Details\n" not in source
    assert "/chat?profile=" in source


def test_chat_page_honors_profile_query_from_team_launch():
    source = (REPO_ROOT / "web" / "src" / "pages" / "ChatPage.tsx").read_text()

    assert 'const profileParam = searchParams.get("profile")?.trim() ?? "";' in source
    assert "const chatProfile = profileParam || scopedProfile;" in source
    assert "buildWsUrl(authParam, resumeParam, channel, chatProfile)" in source
    assert "[channel, resumeParam, chatProfile]" in source


def test_mission_control_active_sessions_metric_uses_terminal_lights():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert 'const terminalLights = buildOperationsItems(data).filter((item) => activitySegment(item) === "terminals").length;' in source
    assert "value: formatCount(terminalLights)" in source
    assert "tone: terminalLights > 0 ? \"success\" : \"secondary\"" in source
    assert "const activeSessions =" not in source


def test_mission_control_profile_light_dossier_shows_current_work_and_output_plan():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert "Current work" in source
    assert "Planned output use" in source
    assert "outputPlanForTask" in source
    assert "currentTaskByProfile" in source
    assert "feeds forward" in source
    assert "next teammate" in source
    assert "Working: {item.currentTask.title || item.currentTask.id}" in source
    assert "taskByProfile={teamTaskByProfile}" in source
    assert "No running Kanban item is assigned to this profile right now." in source


def test_mission_control_collapsed_team_orbs_are_clickable_role_lights_not_fake_icons():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert "aria-label={`Open ${item.roleName || item.roleGlyph || item.kind} details`}" in source
    assert "onClick={() => openLightAgent(item)}" in source
    assert "max-w-[1.55rem] truncate text-center font-mono-ui" in source
    assert "profile agents" not in source
    assert "w-full text-center" not in source
    assert "max-w-[8rem] text-center font-mono-ui text-[0.5rem] uppercase" not in source
    assert "top-full pt-1" not in source
    assert "const fanW = 64;" in source
    assert "relative flex w-24 shrink-0 self-stretch" in source
    assert "agent-wire__dot--y" not in source
    assert "relative flex h-5 w-px" not in source
    assert "aria-hidden=\"true\">\n                                      {allTeamItems.map" not in source


def test_mission_control_sound_controls_are_real_switches_and_terminal_voice_toggle_exists():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert 'import { Switch } from "@nous-research/ui/ui/components/switch";' in source
    assert "function SoundToggle" in source
    assert "Approval sound {soundSettings.approval" not in source
    assert "Done sound {soundSettings.done" not in source
    assert "11 Labs announce {soundSettings.announce" not in source
    assert 'label="Approval ding"' in source
    assert 'label="Done ding"' in source
    assert 'label="Voice task updates"' in source
    assert 'label="Announce terminal results"' in source
    assert 'terminalAnnounce: false' in source
    assert 'onSoundSettingChange("terminalAnnounce", checked)' in source


def test_mission_control_terminal_result_announcements_cover_done_and_approval():
    source = (REPO_ROOT / "web" / "src" / "pages" / "MissionControlPage.tsx").read_text()

    assert "function terminalResultAnnouncement" in source
    assert "Juror Research task" in source
    assert "Hermes Team UI task" in source
    assert "Dev task" in source
    assert "needs your approval" in source
    assert "completed." in source
    assert 'tone === "review" ? "approval" : "done"' in source
    assert "soundSettings.terminalAnnounce && previousTones" in source
