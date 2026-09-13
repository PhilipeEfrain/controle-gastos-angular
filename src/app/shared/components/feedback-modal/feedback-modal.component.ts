import {
  Component,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
  HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FeedbackService } from '../../../core/services/feedback.service';
import { NotificationService } from '../../../core/services/notification.service';
import {
  FeedbackType,
  FeedbackSeverity,
  FeedbackTechnicalData,
  FeedbackContextData
} from '../../../core/models/feedback.model';

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback-modal.component.html',
  styleUrls: ['./feedback-modal.component.scss']
})
export class FeedbackModalComponent {
  private readonly feedbackService = inject(FeedbackService);
  private readonly notificationService = inject(NotificationService);

  readonly isOpen = input<boolean>(false);
  readonly context = input<FeedbackContextData | null>(null);
  readonly close = output<void>();

  readonly tipo = signal<FeedbackType>('sugestao');
  readonly assunto = signal<string>('');
  readonly mensagem = signal<string>('');
  readonly gravidade = signal<FeedbackSeverity>('media');

  readonly isSubmitting = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showDiagnostics = signal<boolean>(false);
  readonly diagnostics = signal<FeedbackTechnicalData | null>(null);

  readonly assuntoLength = computed(() => this.assunto().trim().length);
  readonly mensagemLength = computed(() => this.mensagem().trim().length);

  readonly isFormValid = computed(() => {
    const aLen = this.assuntoLength();
    const mLen = this.mensagemLength();
    return aLen >= 3 && aLen <= 120 && mLen >= 5 && mLen <= 2000 && !this.isSubmitting();
  });

  constructor() {
    effect(
      () => {
        if (this.isOpen()) {
          const ctx = this.context();
          if (ctx) {
            this.tipo.set(ctx.tipo || 'sugestao');
            this.assunto.set(ctx.assunto || '');
            this.gravidade.set(ctx.gravidade || 'media');
          } else {
            this.tipo.set('sugestao');
            this.assunto.set('');
            this.gravidade.set('media');
          }
          this.mensagem.set('');
          this.errorMessage.set(null);
          this.isSubmitting.set(false);
          this.showDiagnostics.set(false);

          // Coleta passiva dos dados de diagnóstico
          const technicalData = this.feedbackService.collectTechnicalData(ctx?.errorMessage);
          this.diagnostics.set(technicalData);
        }
      }
    );
  }

  setTipo(t: FeedbackType): void {
    this.tipo.set(t);
  }

  setGravidade(g: FeedbackSeverity): void {
    this.gravidade.set(g);
  }

  toggleDiagnostics(): void {
    this.showDiagnostics.update(prev => !prev);
  }

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.isOpen() && !this.isSubmitting()) {
      this.onClose();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('feedback-backdrop') && !this.isSubmitting()) {
      this.onClose();
    }
  }

  onClose(): void {
    this.close.emit();
  }

  async onSubmit(): Promise<void> {
    if (!this.isFormValid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    try {
      await this.feedbackService.sendFeedback({
        tipo: this.tipo(),
        assunto: this.assunto().trim(),
        mensagem: this.mensagem().trim(),
        gravidade: this.tipo() === 'erro' ? this.gravidade() : undefined,
        dadosTecnicos: this.diagnostics() || undefined
      });

      this.notificationService.success('Obrigado! Seu feedback foi enviado com sucesso à nossa equipe.');
      this.onClose();
    } catch (err: any) {
      const msg = err?.message || 'Falha ao enviar feedback. Tente novamente mais tarde.';
      this.errorMessage.set(msg);
      this.notificationService.error(msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
