import { Routes } from '@angular/router';
import { CreatePollComponent } from './pages/create-poll/create-poll.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { PollDetailsComponent } from './pages/poll-details/poll-details.component';
import { PollListComponent } from './pages/poll-list/poll-list.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'polls' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'polls', component: PollListComponent },
  { path: 'polls/:id', component: PollDetailsComponent },
  { path: 'create', component: CreatePollComponent },
  { path: '**', redirectTo: 'polls' }
];
