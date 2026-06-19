package com.voting.voting_app.dto;

import com.voting.voting_app.model.PollStatus;

import java.time.LocalDateTime;
import java.util.List;

public record PollResponse(
        Long id,
        String question,
        PollStatus status,
        List<OptionVoteResponse> options,
        Long totalVotes,
        String winningOption,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
