import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Poll } from '../../models/poll.model';

@Component({
  selector: 'app-poll-results',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './poll-results.component.html',
  styleUrl: './poll-results.component.css'
})
export class PollResultsComponent {
  @Input({ required: true }) poll!: Poll;

  get totalVotes(): number {
    return this.poll.totalVotes;
  }

  getPercentage(voteCount: number): number {
    if (!this.totalVotes) {
      return 0;
    }

    return Math.round((voteCount / this.totalVotes) * 100);
  }
}
