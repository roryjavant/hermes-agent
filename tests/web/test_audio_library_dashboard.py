from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (REPO_ROOT / path).read_text()


def test_audio_library_route_nav_title_and_api_are_wired():
    app_source = read("web/src/App.tsx")
    title_source = read("web/src/lib/resolve-page-title.ts")
    api_source = read("web/src/lib/api.ts")

    assert 'import AudioLibraryPage from "@/pages/AudioLibraryPage";' in app_source
    assert '"/audio-library": AudioLibraryPage' in app_source
    assert 'path: "/audio-library"' in app_source
    assert 'label: "Audio Library"' in app_source
    assert 'icon: Music2' in app_source
    assert '"/audio-library"' in app_source.split("const PRIMARY_DASHBOARD_TAB_PATHS", 1)[1].split("]);", 1)[0]
    assert '"/audio-library": "Audio Library"' in title_source
    assert "getAudioLibrary" in api_source
    assert "getAudioLibraryQuota" in api_source
    assert "getElevenLabsVoices" in api_source
    assert "previewAudioLibraryVoice" in api_source
    assert "generateAudioLibraryAsset" in api_source
    assert "importAudioLibraryAsset" in api_source
    assert "updateAudioLibraryMapping" in api_source
    assert "deleteAudioLibraryAsset" in api_source
    assert "AudioLibraryResponse" in api_source


def test_audio_library_page_supports_generation_quota_playback_and_event_mappings():
    source = read("web/src/pages/AudioLibraryPage.tsx")

    assert "Audio Library" in source
    assert "Check quota" in source
    assert "Generate" in source
    assert "Events" in source
    assert "api.getAudioLibrary" in source
    assert "api.getKanbanBoards" in source
    assert "api.getMissionControlActivity" in source
    assert "MissionControlProfileTeam" in source
    assert "api.getAudioLibraryQuota" in source
    assert "api.generateAudioLibraryAsset" in source
    assert "api.updateAudioLibraryMapping" in source
    assert "api.deleteAudioLibraryAsset" in source
    assert "Voice settings" in source
    assert "Generate type" in source
    assert "Voice / spoken clip" in source
    assert '<option value="music">Music</option>' in source
    assert "Music prompt" in source
    assert "Music settings" in source
    assert "music_length_ms" in source
    assert "elevenlabs_music" in source
    assert "api.getElevenLabsVoices" in source
    assert "api.previewAudioLibraryVoice" in source
    assert "Test voice" in source
    assert "Custom voice ID" in source
    assert "PRESET_VOICES" in source
    assert "displayVoices.map" in source
    assert "Account list unavailable; showing presets" in source
    assert "Speaker boost" in source
    assert "Stability" in source
    assert "similarity_boost" in source
    assert "use_speaker_boost" in source
    assert "Team completion" in source
    assert "Team member clips" in source
    assert "teamTaskCompleteEventKey" in source
    assert "teamMemberTaskCompleteEventKey" in source
    assert "Team task completion" in source
    assert "Team member task completion" in source
    assert "Inherit team/default" in source
    assert "Test ${agent.profile} completion audio" in source
    assert 'Current built-in audio' in source
    assert 'asset.source !== "bundled"' in source
    assert "authedFetch(asset.url)" in source
    assert "URL.createObjectURL" in source
    assert "new Audio(src)" in source
    assert "HERMES_BASE_PATH" in source
    # Mapping dropdowns group clips: event-specific built-ins, other built-ins, then custom.
    assert 'optgroup label="For this event"' in source
    assert 'optgroup label="Other built-ins"' in source
    assert 'optgroup label="Custom clips"' in source
    # Bundled clips render in a separate, non-deletable library group.
    assert "Built-in" in source
    assert "Custom" in source
    assert "SECTION_HEADER_CLASS" in source
    assert "1 · Event sounds" in source
    assert "2 · Generate" in source
    assert "3 · Clips" in source


def test_mission_control_uses_configurable_audio_library_event_mappings_with_fallbacks():
    source = read("web/src/pages/MissionControlPage.tsx")

    assert "api.getAudioLibrary" in source
    assert "configuredAudioClipPath" in source
    assert "playConfiguredMissionControlClip" in source
    assert "authedFetch(clipPath)" in source
    assert '"mission_control.launch"' in source
    assert '"terminal.ready.juror_research"' in source
    assert '"terminal.ready.dev_task"' in source
    assert '"terminal.ready.default"' in source
    assert '"terminal.review"' in source
    assert "playMissionControlConfiguredLaunchClip" in source
    assert "playMissionControlConfiguredJurorResearchCompleteClip" in source
    assert "playMissionControlConfiguredDevTaskCompleteClip" in source
    assert "playMissionControlConfiguredDefaultReadyClip" in source
    assert "playMissionControlConfiguredTeamTaskCompleteClip" in source
    assert "teamTaskCompleteAudioEventKey" in source
    assert "teamMemberTaskCompleteAudioEventKey" in source
    assert "task.assignee" in source
    assert "missionTaskDoneTasks" in source
    assert "playMissionControlConfiguredReviewClip" in source
    assert "audioLibrary === undefined" in source
