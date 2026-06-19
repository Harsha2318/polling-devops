import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private readonly toastsSubject = new BehaviorSubject<ToastMessage[]>([]);
  private nextId = 1;

  readonly toasts$ = this.toastsSubject.asObservable();

  success(title: string, message: string, durationMs = 3200): void {
    this.show('success', title, message, durationMs);
  }

  error(title: string, message: string, durationMs = 4200): void {
    this.show('error', title, message, durationMs);
  }

  info(title: string, message: string, durationMs = 2600): void {
    this.show('info', title, message, durationMs);
  }

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((toast) => toast.id !== id));
  }

  private show(type: ToastType, title: string, message: string, durationMs: number): void {
    const toast: ToastMessage = {
      id: this.nextId++,
      type,
      title,
      message
    };

    this.toastsSubject.next([...this.toastsSubject.value, toast]);
    window.setTimeout(() => this.dismiss(toast.id), durationMs);
  }
}
