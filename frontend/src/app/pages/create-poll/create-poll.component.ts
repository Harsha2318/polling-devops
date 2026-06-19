import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiErrorResponse, CreatePollRequest } from '../../models/poll.model';
import { PollService } from '../../core/services/poll.service';
import { ToastService } from '../../core/services/toast.service';
import { ErrorMessageComponent } from '../../shared/error-message/error-message.component';

@Component({
  selector: 'app-create-poll-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ErrorMessageComponent],
  templateUrl: './create-poll.component.html',
  styleUrl: './create-poll.component.css'
})
export class CreatePollComponent implements OnInit {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly pollService = inject(PollService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);

  readonly maxOptions = 6;
  loading = false;
  error = '';
  success = '';

  readonly form = this.fb.group({
    question: ['', [Validators.required, Validators.minLength(5)]],
    options: this.fb.array([])
  });

  ngOnInit(): void {
    this.addOption();
    this.addOption();
  }

  get options(): FormArray {
    return this.form.get('options') as FormArray;
  }

  get canAddOption(): boolean {
    return this.options.length < this.maxOptions;
  }

  addOption(value = ''): void {
    if (!this.canAddOption) {
      return;
    }

    this.options.push(this.fb.control(value, [Validators.required, Validators.minLength(1)]));
  }

  removeOption(index: number): void {
    if (this.options.length <= 2) {
      return;
    }

    this.options.removeAt(index);
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.error = '';
    this.success = '';

    if (this.form.invalid) {
      return;
    }

    const question = this.form.value.question?.trim() ?? '';
    const options = ((this.form.value.options ?? []) as string[]).map((option) => option.trim());
    const normalizedOptions = options.map((option) => option.toLowerCase());

    if (!question) {
      this.error = 'Question is required.';
      return;
    }

    if (question.length < 5) {
      this.error = 'Question must be at least 5 characters.';
      return;
    }

    if (options.length < 2) {
      this.error = 'At least 2 options are required.';
      return;
    }

    if (options.some((option) => !option)) {
      this.error = 'Option cannot be empty.';
      return;
    }

    if (new Set(normalizedOptions).size !== normalizedOptions.length) {
      this.error = 'Duplicate options are not allowed.';
      return;
    }

    const request: CreatePollRequest = {
      question,
      options
    };

    this.loading = true;
    this.pollService
      .createPoll(request)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: async () => {
          this.success = 'Poll created successfully.';
          this.toastService.success('Poll created', 'Your new poll is live and ready for voting.');
          await this.router.navigate(['/polls']);
        },
        error: (error) => {
          this.error = this.toErrorMessage(error, 'Could not create poll. Please check the form and try again.');
          this.toastService.error('Create failed', this.error);
          this.cdr.detectChanges();
        }
      });
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    const apiError = (error as { error?: ApiErrorResponse })?.error;
    return apiError?.message || fallback;
  }
}
