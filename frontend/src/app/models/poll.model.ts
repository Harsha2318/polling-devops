export type PollStatus = 'ACTIVE' | 'CLOSED';

export interface OptionVote {
  voteOption: string;
  voteCount: number;
  percentage: number;
}

export interface Poll {
  id: number;
  question: string;
  status: PollStatus;
  options: OptionVote[];
  totalVotes: number;
  winningOption: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePollRequest {
  question: string;
  options: string[];
}

export interface VoteRequest {
  optionIndex: number;
}

export interface DashboardStats {
  totalPolls: number;
  activePolls: number;
  closedPolls: number;
  totalVotes: number;
  mostVotedPollQuestion: string | null;
  mostVotedPollVotes: number;
}

export interface PollQueryParams {
  search?: string;
  sort?: 'newest' | 'oldest' | 'mostVotes' | 'leastVotes';
  status?: PollStatus;
}

export interface ApiErrorResponse {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
}
