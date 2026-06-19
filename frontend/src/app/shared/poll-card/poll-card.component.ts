import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Poll } from '../../models/poll.model';

@Component({
  selector: 'app-poll-card',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './poll-card.component.html',
  styleUrl: './poll-card.component.css'
})
export class PollCardComponent {
  @Input({ required: true }) poll!: Poll;
  @Input() hasVoted = false;
  @Input() votingKey: string | null = null;
  @Input() showMeta = false;
  @Output() vote = new EventEmitter<number>();

  isVoting(optionIndex: number): boolean {
    return this.votingKey === `${this.poll.id}-${optionIndex}`;
  }

  canVote(): boolean {
    return this.poll.status === 'ACTIVE' && !this.hasVoted;
  }

  submitVote(optionIndex: number): void {
    if (!this.canVote()) {
      return;
    }

    this.vote.emit(optionIndex);
  }
}
