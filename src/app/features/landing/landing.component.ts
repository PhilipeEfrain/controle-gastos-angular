import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/state/auth.store';

interface FeatureItem {
  icon: string;
  badge: string;
  title: string;
  description: string;
}

interface FaqItem {
  question: string;
  answer: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingComponent {
  private authStore = inject(AuthStore);
  private router = inject(Router);

  readonly isAuthenticated = this.authStore.isAuthenticated;
  readonly user = this.authStore.currentUser;

  readonly features: FeatureItem[] = [
    {
      icon: '📅',
      badge: 'Exclusivo',
      title: 'Fluxo Quinzenal Inteligente',
      description: 'Divida suas despesas pelo dia de pagamento real (Dia 31 e Dia 15). O sistema calcula automaticamente se a sobra da 1ª quinzena cobre o déficit da 2ª.'
    },
    {
      icon: '💳',
      badge: 'Organização',
      title: 'Controle de Parcelamentos',
      description: 'Acompanhe o progresso de cada compra a prazo (ex: 3/10) e realize quitação antecipada ou cancelamento de parcelas futuras em lote.'
    },
    {
      icon: '✈️',
      badge: 'Colaborativo',
      title: 'Gastos de Viagem & Rateio',
      description: 'Registre gastos de viagens com múltiplos participantes, separe itens individuais de compartilhados e gere cobranças formatadas para WhatsApp e Pix.'
    },
    {
      icon: '🏛️',
      badge: 'Previsibilidade',
      title: 'Tributos & Contas Anuais',
      description: 'Provisione e compare valores orçados vs. quitados de IPTU, IPVA e licenciamentos para nunca mais ser surpreendido no início do ano.'
    },
    {
      icon: '⚡',
      badge: 'Tecnologia',
      title: 'PWA & 100% Offline First',
      description: 'Instale na tela inicial do seu celular ou computador. Registre despesas mesmo sem internet — tudo é salvo no dispositivo e sincronizado ao reconectar.'
    },
    {
      icon: '📊',
      badge: 'Inteligência',
      title: 'Gráficos e Exportação',
      description: 'Visualize a distribuição por categorias em gráfico Donut, analise a evolução mensal histórica e exporte relatórios em PDF A4 ou planilhas Excel/CSV.'
    }
  ];

  readonly faqs = signal<FaqItem[]>([
    {
      question: 'Por que o Quinzena organiza o orçamento em duas quinzenas?',
      answer: 'Porque a maioria dos trabalhadores recebe renda fracionada (adiantamento no dia 15 e salário no dia 31). Apps tradicionais juntam tudo em um bloco mensal único, criando falsas impressões de sobra ou descompasso de caixa. O Quinzena sincroniza suas contas com os dias reais em que o dinheiro cai na conta.',
      isOpen: false
    },
    {
      question: 'O aplicativo funciona sem internet no celular?',
      answer: 'Sim! O Quinzena é um Progressive Web App (PWA) com cache local no IndexedDB via Firebase Modular SDK. Você pode abrir o app, consultar seu orçamento e registrar despesas mesmo em locais sem sinal. Ao restabelecer a conexão, os dados são sincronizados automaticamente com a nuvem.',
      isOpen: false
    },
    {
      question: 'Como funciona o rateio de viagens?',
      answer: 'Você cria a viagem, cadastra os gastos e define quais itens são compartilhados e quais foram compras individuais. O app calcula a cota exata por participante, exibe quanto você tem a receber e permite copiar uma mensagem pronta para enviar no WhatsApp ou gerar a cobrança via Pix com 1 clique.',
      isOpen: false
    },
    {
      question: 'Meus dados e histórico financeiro estão seguros?',
      answer: 'Totalmente. Cada conta é isolada por autenticação criptografada no Firebase Auth e protegida por regras rígidas de segurança no Cloud Firestore, onde somente o próprio usuário tem permissão de leitura e escrita em seus dados.',
      isOpen: false
    },
    {
      question: 'O uso do Quinzena é gratuito?',
      answer: 'Sim! O aplicativo é 100% gratuito e não possui limites de despesas, viagens ou ciclos cadastrados.',
      isOpen: false
    }
  ]);

  toggleFaq(index: number): void {
    this.faqs.update(items =>
      items.map((item, i) => (i === index ? { ...item, isOpen: !item.isOpen } : item))
    );
  }

  navigateToAuth(mode: 'login' | 'register' = 'register'): void {
    this.router.navigate(['/auth'], { queryParams: { tab: mode } });
  }

  navigateToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}
