import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, interval, Subject } from 'rxjs';
import { ApiErrorResponse, Poll, PollQueryParams, PollStatus } from '../../models/poll.model';
import { PollService } from '../../core/services/poll.service';
import { ToastService } from '../../core/services/toast.service';
import { VoteStorageService } from '../../core/services/vote-storage.service';
import { ErrorMessageComponent } from '../../shared/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../shared/loading-spinner/loading-spinner.component';
import { PollCardComponent } from '../../shared/poll-card/poll-card.component';

@Component({
  selector: 'app-poll-list-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ErrorMessageComponent, LoadingSpinnerComponent, PollCardComponent],
  templateUrl: './poll-list.component.html',
  styleUrl: './poll-list.component.css'
})
export class PollListComponent implements OnInit {
  private readonly autoRefreshMs = 4000;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pollService = inject(PollService);
  private readonly toastService = inject(ToastService);
  private readonly voteStorageService = inject(VoteStorageService);
  private readonly filtersChanged$ = new Subject<string>();

  polls: Poll[] = [];
  loading = false;
  refreshing = false;
  error = '';
  votingKey: string | null = null;

  searchTerm = '';
  sortBy: NonNullable<PollQueryParams['sort']> = 'newest';
  statusFilter: 'ALL' | PollStatus = 'ALL';

  ngOnInit(): void {
    this.loadPolls(true);
    this.filtersChanged$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadPolls(false));

    interval(this.autoRefreshMs)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.isDocumentVisible()) {
          this.loadPolls(false, true);
        }
      });
  }

  loadPolls(showLoader = false, silent = false): void {
    if (showLoader) {
      this.loading = true;
    } else {
      this.refreshing = true;
    }

    if (!silent) {
      this.error = '';
    }

    this.pollService
      .getAllPolls(this.getQueryParams())
      .pipe(
        finalize(() => {
          this.loading = false;
          this.refreshing = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (polls) => {
          this.polls = polls;
          this.cdr.detectChanges();
        },
        error: (error) => {
          if (!silent) {
            this.error = this.toErrorMessage(error, 'Could not load polls. Please check if backend is running.');
          }
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
          this.toastService.success('Vote recorded', 'Your vote has been saved and results were refreshed.');
          this.cdr.detectChanges();
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

  onFiltersChanged(): void {
    this.filtersChanged$.next(JSON.stringify(this.getQueryParams()));
  }

  private getQueryParams(): PollQueryParams {
    return {
      search: this.searchTerm.trim() || undefined,
      sort: this.sortBy,
      status: this.statusFilter === 'ALL' ? undefined : this.statusFilter
    };
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    const apiError = (error as { error?: ApiErrorResponse })?.error;
    return apiError?.message || fallback;
  }

  private isDocumentVisible(): boolean {
    return typeof document === 'undefined' || document.visibilityState === 'visible';
  }
}
