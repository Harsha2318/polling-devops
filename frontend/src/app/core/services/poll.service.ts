import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap, tap, throwError, timeout } from 'rxjs';
import {
  CreatePollRequest,
  DashboardStats,
  OptionVote,
  Poll,
  PollQueryParams,
  VoteRequest
} from '../../models/poll.model';

@Injectable({
  providedIn: 'root'
})
export class PollService {
  private readonly apiUrl = '/api/polls';
  private readonly requestTimeoutMs = 10000;
  private createMode: 'modern' | 'legacy' | null = null;
  private voteMode: 'modern' | 'legacy' | null = null;
  private statsMode: 'modern' | 'fallback' | null = null;

  constructor(private readonly http: HttpClient) {}

  getAllPolls(params?: PollQueryParams): Observable<Poll[]> {
    let httpParams = new HttpParams();

    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }

    if (params?.sort) {
      httpParams = httpParams.set('sort', params.sort);
    }

    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }

    return this.http
      .get<Poll[]>(this.apiUrl, { params: httpParams })
      .pipe(
        tap((polls) => this.updateCompatibilityModesFromPollList(polls)),
        map((polls) => polls.map((poll) => this.normalizePoll(poll))),
        map((polls) => this.applyQueryParams(polls, params)),
        timeout(this.requestTimeoutMs)
      );
  }

  getPollById(id: number): Observable<Poll> {
    return this.http
      .get<Poll>(`${this.apiUrl}/${id}`)
      .pipe(
        tap((poll) => this.updateCompatibilityModesFromPoll(poll)),
        map((poll) => this.normalizePoll(poll)),
        timeout(this.requestTimeoutMs)
      );
  }

  createPoll(request: CreatePollRequest): Observable<Poll> {
    if (this.createMode === 'legacy') {
      return this.createPollLegacy(request);
    }

    return this.http
      .post<Poll>(this.apiUrl, request)
      .pipe(
        map((poll) => this.normalizePoll(poll)),
        tap(() => (this.createMode = 'modern')),
        timeout(this.requestTimeoutMs),
        catchError((error) => (this.shouldFallback(error) ? this.createPollLegacy(request) : throwError(() => error)))
      );
  }

  vote(pollId: number, optionIndex: number): Observable<Poll> {
    if (this.voteMode === 'legacy') {
      return this.voteLegacy(pollId, optionIndex);
    }

    const request: VoteRequest = { optionIndex };
    return this.http
      .post<Poll>(`${this.apiUrl}/${pollId}/vote`, request)
      .pipe(
        map((poll) => this.normalizePoll(poll)),
        tap(() => (this.voteMode = 'modern')),
        timeout(this.requestTimeoutMs),
        catchError((error) => (this.shouldFallback(error) ? this.voteLegacy(pollId, optionIndex) : throwError(() => error)))
      );
  }

  closePoll(pollId: number): Observable<Poll> {
    return this.http
      .patch<Poll>(`${this.apiUrl}/${pollId}/close`, {})
      .pipe(map((poll) => this.normalizePoll(poll)), timeout(this.requestTimeoutMs));
  }

  deletePoll(pollId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${pollId}`).pipe(timeout(this.requestTimeoutMs));
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.getFallbackDashboardStats();
  }

  private createPollLegacy(request: CreatePollRequest): Observable<Poll> {
    const legacyRequest = {
      question: request.question,
      options: request.options.map((voteOption) => ({
        voteOption,
        voteCount: 0
      }))
    };

    return this.http
      .post<Poll>(this.apiUrl, legacyRequest)
      .pipe(
        map((poll) => this.normalizePoll(poll)),
        tap(() => (this.createMode = 'legacy')),
        timeout(this.requestTimeoutMs)
      );
  }

  private voteLegacy(pollId: number, optionIndex: number): Observable<Poll> {
    const legacyRequest = {
      pollId,
      optionIndex
    };

    return this.http
      .post<Poll | null>(`${this.apiUrl}/vote`, legacyRequest)
      .pipe(
        switchMap((poll) => (poll ? of(poll) : this.http.get<Poll>(`${this.apiUrl}/${pollId}`))),
        map((poll) => this.normalizePoll(poll)),
        tap(() => (this.voteMode = 'legacy')),
        timeout(this.requestTimeoutMs)
      );
  }

  private getFallbackDashboardStats(): Observable<DashboardStats> {
    return this.getAllPolls({ sort: 'mostVotes' }).pipe(
      map((polls) => this.buildFallbackStats(polls)),
      tap(() => (this.statsMode = 'fallback'))
    );
  }

  private buildFallbackStats(polls: Poll[]): DashboardStats {
    const totalVotes = polls.reduce((total, poll) => total + poll.totalVotes, 0);
    const mostVotedPoll = [...polls].sort((left, right) => right.totalVotes - left.totalVotes)[0];

    return {
      totalPolls: polls.length,
      activePolls: polls.filter((poll) => poll.status === 'ACTIVE').length,
      closedPolls: polls.filter((poll) => poll.status === 'CLOSED').length,
      totalVotes,
      mostVotedPollQuestion: mostVotedPoll?.question ?? null,
      mostVotedPollVotes: mostVotedPoll?.totalVotes ?? 0
    };
  }

  private shouldFallback(error: unknown): boolean {
    const status = (error as HttpErrorResponse)?.status;
    return status === 400 || status === 404 || status === 405;
  }

  private updateCompatibilityModesFromPollList(polls: Array<Partial<Poll> & { options?: Array<Partial<OptionVote>> }>): void {
    if (polls.length === 0) {
      return;
    }

    const looksLegacy = polls.every((poll) => this.looksLikeLegacyPoll(poll));
    if (looksLegacy) {
      this.createMode = 'legacy';
      this.voteMode = 'legacy';
      this.statsMode = 'fallback';
    }
  }

  private updateCompatibilityModesFromPoll(poll: Partial<Poll> & { options?: Array<Partial<OptionVote>> }): void {
    if (this.looksLikeLegacyPoll(poll)) {
      this.createMode = 'legacy';
      this.voteMode = 'legacy';
      this.statsMode = 'fallback';
    }
  }

  private looksLikeLegacyPoll(poll: Partial<Poll> & { options?: Array<Partial<OptionVote>> }): boolean {
    return poll.status === undefined && poll.totalVotes === undefined && poll.createdAt === undefined && poll.updatedAt === undefined;
  }

  private applyQueryParams(polls: Poll[], params?: PollQueryParams): Poll[] {
    const search = params?.search?.trim().toLowerCase();
    let filtered = [...polls];

    if (search) {
      filtered = filtered.filter((poll) => poll.question.toLowerCase().includes(search));
    }

    if (params?.status) {
      filtered = filtered.filter((poll) => poll.status === params.status);
    }

    switch (params?.sort) {
      case 'oldest':
        filtered.sort((left, right) => left.id - right.id);
        break;
      case 'mostVotes':
        filtered.sort((left, right) => right.totalVotes - left.totalVotes);
        break;
      case 'leastVotes':
        filtered.sort((left, right) => left.totalVotes - right.totalVotes);
        break;
      case 'newest':
      default:
        filtered.sort((left, right) => right.id - left.id);
        break;
    }

    return filtered;
  }

  private normalizePoll(poll: Partial<Poll> & { options?: Array<Partial<OptionVote>> }): Poll {
    const normalizedOptions = (poll.options ?? []).map((option) => ({
      voteOption: option.voteOption ?? '',
      voteCount: option.voteCount ?? 0,
      percentage: option.percentage ?? 0
    }));
    const totalVotes =
      poll.totalVotes ??
      normalizedOptions.reduce((total, option) => total + option.voteCount, 0);
    const optionsWithPercentage = normalizedOptions.map((option) => ({
      ...option,
      percentage: totalVotes ? Math.round((option.voteCount / totalVotes) * 100) : 0
    }));
    const winningOption =
      poll.winningOption ??
      optionsWithPercentage.sort((left, right) => right.voteCount - left.voteCount)[0]?.voteOption ??
      null;

    return {
      id: poll.id ?? 0,
      question: poll.question ?? '',
      status: poll.status ?? 'ACTIVE',
      options: optionsWithPercentage,
      totalVotes,
      winningOption,
      createdAt: poll.createdAt ?? '',
      updatedAt: poll.updatedAt ?? ''
    };
  }
}
