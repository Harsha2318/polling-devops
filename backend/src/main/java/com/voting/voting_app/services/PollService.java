package com.voting.voting_app.services;

import com.voting.voting_app.dto.CreatePollRequest;
import com.voting.voting_app.dto.DashboardStatsResponse;
import com.voting.voting_app.dto.OptionVoteResponse;
import com.voting.voting_app.dto.PollResponse;
import com.voting.voting_app.model.OptionVote;
import com.voting.voting_app.model.Poll;
import com.voting.voting_app.model.PollStatus;
import com.voting.voting_app.repository.PollRepository;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
public class PollService {

    private final PollRepository pollRepository;

    public PollService(PollRepository pollRepository) {
        this.pollRepository = pollRepository;
    }

    @Transactional
    public PollResponse createPoll(CreatePollRequest request) {
        validateQuestion(request.question());
        validateOptions(request.options());

        Poll poll = new Poll();
        poll.setQuestion(request.question().trim());
        poll.setStatus(PollStatus.ACTIVE);

        List<OptionVote> options = new ArrayList<>();
        for (String option : request.options()) {
            OptionVote vote = new OptionVote();
            vote.setVoteOption(option.trim());
            vote.setVoteCount(0L);
            options.add(vote);
        }
        poll.setOptions(options);
        return toResponse(pollRepository.save(poll));
    }

    public List<PollResponse> getAllPolls(String search, String sort, PollStatus status) {
        List<Poll> polls = new ArrayList<>(pollRepository.findAll());
        polls = polls.stream()
                .filter(poll -> matchesSearch(poll, search))
                .filter(poll -> status == null || poll.getStatus() == status)
                .sorted(buildComparator(sort))
                .toList();
        return polls.stream().map(this::toResponse).toList();
    }

    public PollResponse getPollById(Long id) {
        return toResponse(findPoll(id));
    }

    @Transactional
    public PollResponse vote(Long pollId, Integer optionIndex) {
        Poll poll = findPoll(pollId);
        validateCanVote(poll, optionIndex);
        OptionVote selected = poll.getOptions().get(optionIndex);
        selected.setVoteCount((selected.getVoteCount() == null ? 0L : selected.getVoteCount()) + 1);
        return toResponse(pollRepository.save(poll));
    }

    @Transactional
    public PollResponse closePoll(Long id) {
        Poll poll = findPoll(id);
        poll.setStatus(PollStatus.CLOSED);
        return toResponse(pollRepository.save(poll));
    }

    @Transactional
    public void deletePoll(Long id) {
        Poll poll = findPoll(id);
        pollRepository.delete(poll);
    }

    public DashboardStatsResponse getDashboardStats() {
        List<Poll> polls = pollRepository.findAll();
        long totalVotes = 0L;
        long active = 0L;
        long closed = 0L;
        Poll mostVoted = null;
        long mostVotes = 0L;

        for (Poll poll : polls) {
            if (poll.getStatus() == PollStatus.CLOSED) {
                closed++;
            } else {
                active++;
            }

            long pollVotes = totalVotes(poll);
            totalVotes += pollVotes;
            if (mostVoted == null || pollVotes > mostVotes) {
                mostVoted = poll;
                mostVotes = pollVotes;
            }
        }

        return new DashboardStatsResponse(
                polls.size(),
                active,
                closed,
                totalVotes,
                mostVoted == null ? null : mostVoted.getQuestion(),
                mostVoted == null ? 0L : mostVotes
        );
    }

    private Poll findPoll(Long id) {
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Poll id is required");
        }
        return pollRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Poll not found"));
    }

    private void validateQuestion(String question) {
        if (question == null || question.trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Question is required");
        }
        if (question.trim().length() < 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Question must be at least 5 characters long");
        }
    }

    private void validateOptions(List<String> options) {
        if (options == null || options.size() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least 2 options are required");
        }
        if (options.size() > 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Poll options must be between 2 and 6");
        }
        List<String> normalized = new ArrayList<>();
        for (String option : options) {
            if (option == null || option.trim().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Option text is required");
            }
            String candidate = option.trim().toLowerCase(Locale.ROOT);
            if (normalized.contains(candidate)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duplicate options are not allowed");
            }
            normalized.add(candidate);
        }
    }

    private void validateCanVote(Poll poll, Integer optionIndex) {
        if (poll.getStatus() != PollStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Voting is closed for this poll");
        }
        if (optionIndex == null || optionIndex < 0 || optionIndex >= poll.getOptions().size()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid option index");
        }
    }

    private boolean matchesSearch(Poll poll, String search) {
        if (search == null || search.isBlank()) {
            return true;
        }
        String needle = search.trim().toLowerCase(Locale.ROOT);
        return poll.getQuestion() != null && poll.getQuestion().toLowerCase(Locale.ROOT).contains(needle);
    }

    private Comparator<Poll> buildComparator(String sort) {
        String normalized = sort == null ? "newest" : sort.trim();
        return switch (normalized) {
            case "oldest" -> Comparator.comparing(Poll::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "mostVotes" -> Comparator.comparingLong(this::totalVotes).reversed();
            case "leastVotes" -> Comparator.comparingLong(this::totalVotes);
            default -> Comparator.comparing(Poll::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed();
        };
    }

    private long totalVotes(Poll poll) {
        return poll.getOptions().stream()
                .mapToLong(option -> option.getVoteCount() == null ? 0L : option.getVoteCount())
                .sum();
    }

    private PollResponse toResponse(Poll poll) {
        long totalVotes = totalVotes(poll);
        List<OptionVoteResponse> optionResponses = poll.getOptions().stream()
                .map(option -> new OptionVoteResponse(
                        option.getVoteOption(),
                        option.getVoteCount() == null ? 0L : option.getVoteCount(),
                        totalVotes == 0 ? 0 : (int) Math.round(((double) (option.getVoteCount() == null ? 0L : option.getVoteCount()) * 100.0) / totalVotes)
                ))
                .toList();

        String winningOption = poll.getOptions().stream()
                .filter(option -> option.getVoteCount() != null)
                .max(Comparator.comparingLong(OptionVote::getVoteCount))
                .map(OptionVote::getVoteOption)
                .orElse(null);

        return new PollResponse(
                poll.getId(),
                poll.getQuestion(),
                poll.getStatus(),
                optionResponses,
                totalVotes,
                winningOption,
                poll.getCreatedAt(),
                poll.getUpdatedAt()
        );
    }

    private void validateLegacyVotePayload(Long pollId, Integer optionIndex) {
        if (pollId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Poll id is required");
        }
        validateCanVote(findPoll(pollId), optionIndex);
    }

    public PollResponse voteLegacy(Long pollId, Integer optionIndex) {
        return vote(pollId, optionIndex);
    }
}
