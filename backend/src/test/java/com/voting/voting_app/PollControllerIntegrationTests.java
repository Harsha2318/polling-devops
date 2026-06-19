package com.voting.voting_app;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.voting.voting_app.dto.CreatePollRequest;
import com.voting.voting_app.dto.VoteRequest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class PollControllerIntegrationTests {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void createVoteStatsAndCloseFlowWorks() throws Exception {
        String createPayload = objectMapper.writeValueAsString(new CreatePollRequest(
                "Which DevOps tool is best?",
                List.of("Jenkins", "Docker", "Kubernetes")
        ));

        String createResponse = mockMvc.perform(post("/api/polls")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.options.length()").value(3))
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long pollId = objectMapper.readTree(createResponse).get("id").asLong();

        mockMvc.perform(get("/api/polls"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        mockMvc.perform(post("/api/polls/" + pollId + "/vote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new VoteRequest(0))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalVotes").value(1))
                .andExpect(jsonPath("$.winningOption").value("Jenkins"));

        mockMvc.perform(get("/api/polls/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPolls").value(1))
                .andExpect(jsonPath("$.totalVotes").value(1));

        mockMvc.perform(patch("/api/polls/" + pollId + "/close"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));

        mockMvc.perform(delete("/api/polls/" + pollId))
                .andExpect(status().isNoContent());
    }

    @Test
    void invalidVoteReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/polls/999/vote")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new VoteRequest(0))))
                .andExpect(status().isNotFound());
    }
}
