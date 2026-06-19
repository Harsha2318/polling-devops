package com.voting.voting_app.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record VoteRequest(
        @NotNull(message = "Option index is required")
        @Min(value = 0, message = "Option index must be zero or greater")
        Integer optionIndex
) {
}
