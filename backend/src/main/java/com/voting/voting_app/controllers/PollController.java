package com.voting.voting_app.controllers;

import com.voting.voting_app.dto.CreatePollRequest;
import com.voting.voting_app.dto.DashboardStatsResponse;
import com.voting.voting_app.dto.PollResponse;
import com.voting.voting_app.dto.VoteRequest;
import com.voting.voting_app.model.PollStatus;
import com.voting.voting_app.request.Vote;
import com.voting.voting_app.services.PollService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/polls")
public class PollController {

    private final PollService pollService;

    public PollController(PollService pollService) {
        this.pollService = pollService;
    }

    @PostMapping
    public ResponseEntity<PollResponse> createPoll(@Valid @RequestBody CreatePollRequest request) {
        PollResponse response = pollService.createPoll(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(response.id())
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    @GetMapping
    public List<PollResponse> getPolls(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) PollStatus status
    ) {
        return pollService.getAllPolls(search, sort, status);
    }

    @GetMapping("/{id}")
    public PollResponse getPoll(@PathVariable Long id) {
        return pollService.getPollById(id);
    }

    @PostMapping("/{id}/vote")
    public PollResponse vote(@PathVariable Long id, @Valid @RequestBody VoteRequest request) {
        return pollService.vote(id, request.optionIndex());
    }

    @PostMapping("/vote")
    public PollResponse voteLegacy(@Valid @RequestBody Vote vote) {
        return pollService.voteLegacy(vote.getPollId(), vote.getOptionIndex());
    }

    @PatchMapping("/{id}/close")
    public PollResponse closePoll(@PathVariable Long id) {
        return pollService.closePoll(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePoll(@PathVariable Long id) {
        pollService.deletePoll(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/stats")
    public DashboardStatsResponse stats() {
        return pollService.getDashboardStats();
    }
}
