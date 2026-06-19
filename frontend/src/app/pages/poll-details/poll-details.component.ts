import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, interval } from 'rxjs';
import { ApiErrorResponse, Poll } from '../../models/poll.model';
import { PollService } from '../../core/services/poll.service';
import { ToastService } from '../../core/services/toast.service';
import { VoteStorageService } from '../../core/services/vote-storage.service';
import { ErrorMessageComponent } from '../../shared/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { PollCardComponent } from '../../shared/poll-card/poll-card.component';

@Component({
  selector: 'app-poll-details-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ErrorMessageComponent, LoadingSpinnerComponent, PollCardComponent],
  templateUrl: './poll-details.component.html',
  styleUrl: './poll-details.component.css'
})
export class PollDetailsComponent implements OnInit {
  private readonly autoRefreshMs = 4000;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pollService = inject(PollService);
  private readonly toastService = inject(ToastService);
  private readonly voteStorageService = inject(VoteStorageService);

  poll: Poll | null = null;
  loading = false;
  refreshing = false;
  closing = false;
  deleting = false;
  error = '';
  votingKey: string | null = null;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id)) {
      this.error = 'Poll not found.';
      return;
    }

    this.loadPoll(id);
    interval(this.autoRefreshMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isDocumentVisible()) {
          this.loadPoll(id, true);
        }
      });
  }

  loadPoll(id: number, silent = false): void {
    if (!silent || !this.poll) {
      this.loading = true;
    }
    this.refreshing = silent;

    if (!silent) {
      this.error = '';
    }

    this.pollService
      .getPollById(id)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.refreshing = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (poll) => {
          this.poll = poll;
          this.cdr.detectChanges();
        },
        error: (error) => {
          if (!silent) {
            this.error = this.toErrorMessage(error, 'Poll not found.');
          }
          this.cdr.detectChanges();
        }
      });
  }

  vote(optionIndex: number): void {
    if (!this.poll || this.voteStorageService.hasVoted(this.poll.id) || this.poll.status === 'CLOSED') {
      return;
    }

    this.votingKey = `${this.poll.id}-${optionIndex}`;
    this.pollService
      .vote(this.poll.id, optionIndex)
      .pipe(
        finalize(() => {
          this.votingKey = null;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (poll) => {
          this.voteStorageService.markAsVoted(poll.id);
          this.poll = poll;
          this.toastService.success('Vote recorded', 'This poll was updated with your latest vote.');
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.error = this.toErrorMessage(error, 'Could not submit vote. Please try again.');
          this.toastService.error('Vote failed', this.error);
          this.cdr.detectChanges();
        }
      });
  }

  closePoll(): void {
    if (!this.poll || this.poll.status === 'CLOSED' || this.closing) {
      return;
    }

    this.closing = true;
    this.pollService
      .closePoll(this.poll.id)
      .pipe(
        finalize(() => {
          this.closing = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (poll) => {
          this.poll = poll;
          this.toastService.info('Poll closed', 'Voting has been stopped for this poll.');
          this.cdr.detectChanges();
        },
        error: (error) => {
          this.error = this.toErrorMessage(error, 'Could not close poll. Please try again.');
          this.toastService.error('Close failed', this.error);
          this.cdr.detectChanges();
        }
      });
  }

  async deletePoll(): Promise<void> {
    if (!this.poll || this.deleting || !window.confirm('Delete this poll permanently?')) {
      return;
    }

    this.deleting = true;
    this.pollService
      .deletePoll(this.poll.id)
      .pipe(
        finalize(() => {
          this.deleting = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: async () => {
          this.voteStorageService.clearVote(this.poll!.id);
          this.toastService.success('Poll deleted', 'The poll was removed successfully.');
          await this.router.navigate(['/polls']);
        },
        error: (error) => {
          this.error = this.toErrorMessage(error, 'Could not delete poll. Please try again.');
          this.toastService.error('Delete failed', this.error);
          this.cdr.detectChanges();
        }
      });
  }

  hasVoted(): boolean {
    return this.poll ? this.voteStorageService.hasVoted(this.poll.id) : false;
  }

  refreshPoll(): void {
    if (this.poll) {
      this.loadPoll(this.poll.id);
    }
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    const apiError = (error as { error?: ApiErrorResponse })?.error;
    return apiError?.message || fallback;
  }

  private isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
}
