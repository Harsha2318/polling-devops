import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { ToastStackComponent } from './shared/toast-stack/toast-stack.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavbarComponent, RouterOutlet, ToastStackComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
}
