import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class VoteStorageService {
  private readonly prefix = 'voted_poll_';

  hasVoted(pollId: number): boolean {
    return localStorage.getItem(this.getKey(pollId)) === 'true';
  }

  markAsVoted(pollId: number): void {
    localStorage.setItem(this.getKey(pollId), 'true');
  }

  clearVote(pollId: number): void {
    localStorage.removeItem(this.getKey(pollId));
  }

  private getKey(pollId: number): string {
    return `${this.prefix}${pollId}`;
  }
}
