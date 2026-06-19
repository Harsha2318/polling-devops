package com.voting.voting_app.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class Vote {
    @NotNull(message = "Poll id is required")
    private Long pollId;

    @NotNull(message = "Option index is required")
    @Min(value = 0, message = "Option index must be zero or greater")
    private Integer optionIndex;
}
