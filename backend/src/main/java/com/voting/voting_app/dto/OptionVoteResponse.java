package com.voting.voting_app.dto;

public record OptionVoteResponse(
        String voteOption,
        Long voteCount,
        Integer percentage
) {
}
