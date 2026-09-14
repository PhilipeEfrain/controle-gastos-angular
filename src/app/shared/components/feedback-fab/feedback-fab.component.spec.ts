import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeedbackFabComponent } from './feedback-fab.component';
import { NavigationModalService } from '../../../core/services/navigation-modal.service';
import { signal } from '@angular/core';

describe('FeedbackFabComponent', () => {
  let component: FeedbackFabComponent;
  let fixture: ComponentFixture<FeedbackFabComponent>;
  let mockNavModalService: {
    openFeedback: ReturnType<typeof vi.fn>;
    closeFeedback: ReturnType<typeof vi.fn>;
    isFeedbackOpen: ReturnType<typeof signal<boolean>>;
    feedbackContext: ReturnType<typeof signal<null>>;
    activeModal: ReturnType<typeof signal<null>>;
  };

  beforeEach(async () => {
    mockNavModalService = {
      openFeedback: vi.fn(),
      closeFeedback: vi.fn(),
      isFeedbackOpen: signal(false),
      feedbackContext: signal(null),
      activeModal: signal(null)
    };

    await TestBed.configureTestingModule({
      imports: [FeedbackFabComponent],
      providers: [
        { provide: NavigationModalService, useValue: mockNavModalService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackFabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('deve criar o componente', () => {
    expect(component).toBeTruthy();
  });

  it('deve renderizar o botão FAB com aria-label correto', () => {
    const button = fixture.nativeElement.querySelector('.feedback-fab') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('Enviar feedback ou reportar erro');
  });

  it('deve renderizar o ícone SVG dentro do botão', () => {
    const svg = fixture.nativeElement.querySelector('.fab-icon');
    expect(svg).toBeTruthy();
  });

  it('deve chamar openFeedback() ao clicar no FAB', () => {
    const button = fixture.nativeElement.querySelector('.feedback-fab') as HTMLButtonElement;
    button.click();
    expect(mockNavModalService.openFeedback).toHaveBeenCalledTimes(1);
  });
});
