import { TestBed } from '@angular/core/testing';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from './seo.service';

describe('SeoService (SEO On-Page & Metatags)', () => {
  let service: SeoService;
  let titleServiceSpy: { setTitle: ReturnType<typeof vi.fn> };
  let metaServiceSpy: { updateTag: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    titleServiceSpy = { setTitle: vi.fn() };
    metaServiceSpy = { updateTag: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        SeoService,
        { provide: Title, useValue: titleServiceSpy },
        { provide: Meta, useValue: metaServiceSpy }
      ]
    });

    service = TestBed.inject(SeoService);
  });

  it('deve instanciar o serviço com sucesso', () => {
    expect(service).toBeTruthy();
  });

  it('deve atualizar o título e metatags com sufixo da aplicação', () => {
    service.updateTags({
      title: 'Planos & Preços',
      description: 'Conheça os planos do Quinzena para você ou casal.',
      keywords: 'planos quinzena, pro, duo'
    });

    expect(titleServiceSpy.setTitle).toHaveBeenCalledWith('Planos & Preços | Quinzena');
    expect(metaServiceSpy.updateTag).toHaveBeenCalledWith({
      name: 'description',
      content: 'Conheça os planos do Quinzena para você ou casal.'
    });
    expect(metaServiceSpy.updateTag).toHaveBeenCalledWith({
      name: 'keywords',
      content: 'planos quinzena, pro, duo'
    });
    expect(metaServiceSpy.updateTag).toHaveBeenCalledWith({
      name: 'robots',
      content: 'index, follow'
    });
  });

  it('deve configurar noindex para rotas privadas', () => {
    service.updateTags({
      title: 'Dashboard Privado',
      noIndex: true
    });

    expect(metaServiceSpy.updateTag).toHaveBeenCalledWith({
      name: 'robots',
      content: 'noindex, nofollow'
    });
  });

  it('deve configurar OpenGraph e Twitter Cards corretamente', () => {
    service.updateTags({
      title: 'Landing Page',
      description: 'Controle de gastos quinzenal',
      canonicalUrl: 'https://quinzena.app/'
    });

    expect(metaServiceSpy.updateTag).toHaveBeenCalledWith({
      property: 'og:title',
      content: 'Landing Page | Quinzena'
    });
    expect(metaServiceSpy.updateTag).toHaveBeenCalledWith({
      name: 'twitter:card',
      content: 'summary_large_image'
    });
  });
});
