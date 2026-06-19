import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, interval, of } from 'rxjs';
import { DashboardStats, Poll } from '../../models/poll.model';
import { PollService } from '../../core/services/poll.service';
import { ToastService } from '../../core/services/toast.service';
import { VoteStorageService } from '../../core/services/vote-storage.service';
import { ErrorMessageComponent } from '../../shared/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { PollCardComponent } from '../../shared/poll-card/poll-card.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ErrorMessageComponent, LoadingSpinnerComponent, PollCardComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly autoRefreshMs = 4000;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pollService = inject(PollService);
  private readonly toastService = inject(ToastService);
  private readonly voteStorageService = inject(VoteStorageService);

  stats: DashboardStats = {
    totalPolls: 0,
    activePolls: 0,
    closedPolls: 0,
    totalVotes: 0,
    mostVotedPollQuestion: null,
    mostVotedPollVotes: 0
  };
  polls: Poll[] = [];
  loading = false;
  refreshing = false;
  error = '';
  votingKey: string | null = null;

  ngOnInit(): void {
    this.loadDashboard(true);
    interval(this.autoRefreshMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isDocumentVisible()) {
          this.loadDashboard(false, true);
        }
      });
  }

  loadDashboard(showLoader = false, silent = false): void {
    this.loading = showLoader;
    this.refreshing = !showLoader;
    if (!silent) {
      this.error = '';
    }

    forkJoin({
      stats: this.pollService.getDashboardStats().pipe(catchError(() => of(null))),
      polls: this.pollService.getAllPolls({ sort: 'mostVotes', status: 'ACTIVE' })
    })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.refreshing = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: ({ stats, polls }) => {
          this.polls = polls.slice(0, 4);
          this.stats = stats ?? this.buildFallbackStats(polls);
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.error = this.toErrorMessage(error, 'Could not load dashboard. Please check if backend is running.');
          this.cdr.detectChanges();
        }
      });
  }

  vote(pollId: number, optionIndex: number): void {
    if (this.votingKey || this.voteStorageService.hasVoted(pollId)) {
      return;
    }

    this.votingKey = `${pollId}-${optionIndex}`;
    this.pollService
      .vote(pollId, optionIndex)
      .pipe(
        finalize(() => {
          this.votingKey = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (poll) => {
          this.voteStorageService.markAsVoted(pollId);
          this.polls = this.polls.map((item) => (item.id === poll.id ? poll : item));
          this.toastService.success('Vote recorded', 'The dashboard results were updated.');
          this.loadDashboard(false, true);
        },
        error: (error) => {
          this.error = this.toErrorMessage(error, 'Could not submit vote. Please try again.');
          this.toastService.error('Vote failed', this.error);
          this.cdr.detectChanges();
        }
      });
  }

  hasVoted(pollId: number): boolean {
    return this.voteStorageService.hasVoted(pollId);
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

  private toErrorMessage(error: unknown, fallback: string): string {
    const message = (error as { error?: { message?: string } })?.error?.message;
    return message || fallback;
  }

  private isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
}
