package com.voting.voting_app.dto;

public record DashboardStatsResponse(
        long totalPolls,
        long activePolls,
        long closedPolls,
        long totalVotes,
        String mostVotedPollQuestion,
        long mostVotedPollVotes
) {
}
