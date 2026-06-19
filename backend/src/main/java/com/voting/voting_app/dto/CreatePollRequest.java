package com.voting.voting_app.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreatePollRequest(
        @NotBlank(message = "Question is required")
        @Size(min = 5, message = "Question must be at least 5 characters long")
        String question,

        @NotEmpty(message = "At least 2 options are required")
        @Size(min = 2, max = 6, message = "Poll options must be between 2 and 6")
        List<@NotBlank(message = "Option text is required") String> options
) {
}
