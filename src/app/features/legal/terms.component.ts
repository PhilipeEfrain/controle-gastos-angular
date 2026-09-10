import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterLink, BrandLogoComponent],
  templateUrl: './terms.component.html',
  styleUrls: ['./legal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TermsComponent {}
