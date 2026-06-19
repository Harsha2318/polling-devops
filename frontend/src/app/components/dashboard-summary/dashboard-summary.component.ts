import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-dashboard-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-summary.component.html',
  styleUrl: './dashboard-summary.component.css'
})
export class DashboardSummaryComponent {
  @Input() totalPolls = 0;
  @Input() totalVotes = 0;
  @Input() votedPolls = 0;
  @Input() mostActivePoll = 'No active poll yet';
}
