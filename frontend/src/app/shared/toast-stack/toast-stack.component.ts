import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  templateUrl: './toast-stack.component.html',
  styleUrl: './toast-stack.component.css'
})
export class ToastStackComponent {
  readonly toastService = inject(ToastService);
}
