---
name: angular-scss-design-system
description: Guia de arquitetura e melhores práticas para SCSS Modular, Design Tokens, Mixins e Dark Mode no Angular.
---

# Skill: Angular SCSS Architecture & Design System

Esta skill estabelece o padrão de excelência para estilização em **SCSS** na aplicação **Controle de Gastos Quinzenais**, utilizando padrões modernos do **Dart Sass** (`@use`, `@forward`), **Design Tokens** via CSS Custom Properties e arquitetura modular escalável.

---

## 1. Estrutura de Diretórios SCSS (`src/styles/`)

```
src/styles/
├── abstracts/               # Ferramentas e variáveis (não geram CSS direto)
│   ├── _colors.scss         # Paleta financeira (Emerald, Carmine, Slate, etc.)
│   ├── _variables.scss      # Tokens de espaçamento, bordas, sombras e transições
│   ├── _typography.scss     # Escala tipográfica e font families
│   ├── _functions.scss      # Funções de conversão (ex: rem($px))
│   ├── _mixins.scss         # Mixins responsivos, glassmorphism, flex helpers
│   └── _index.scss          # Encaminhador (@forward) de todas as abstrações
│
├── base/                    # Estilos globais e reset
│   ├── _reset.scss          # Box-sizing, reset de margens e normalizações
│   └── _base.scss           # Estilos base do <body>, inputs, scrollbar e foco
│
├── layout/                  # Estruturas de layout macro
│   └── _grid.scss           # Containers e grid quinzenal (desktop 2 colunas / mobile empilhado)
│
├── utilities/               # Classes utilitárias auxiliares
│   └── _utilities.scss      # Helpers de alinhamento, badges e texto financeiro
│
└── styles.scss              # Ponto de entrada global (importa base, layout e utilities)
```

---

## 2. Configuração no Angular (`angular.json`)

Para evitar caminhos relativos longos como `../../../../styles/abstracts`, configuramos o `stylePreprocessorOptions`:

```json
"projects": {
  "controle-gastos-angular": {
    "architect": {
      "build": {
        "options": {
          "stylePreprocessorOptions": {
            "includePaths": ["src/styles"]
          }
        }
      }
    }
  }
}
```

---

## 3. Padrão de Abstrações e Design Tokens

### A. Cores e Variáveis (`src/styles/abstracts/_colors.scss`)
```scss
:root {
  // Primárias e Ações
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  
  // Financeiras (Superávit / Entrada)
  --color-success: #10b981;
  --color-success-bg: rgba(16, 185, 129, 0.12);
  --color-success-border: rgba(16, 185, 129, 0.3);
  
  // Financeiras (Déficit / Saída)
  --color-danger: #ef4444;
  --color-danger-bg: rgba(239, 68, 68, 0.12);
  --color-danger-border: rgba(239, 68, 68, 0.3);
  
  // Atenção / Compensação
  --color-warning: #f59e0b;
  --color-warning-bg: rgba(245, 158, 11, 0.12);
  
  // Dark Mode Surface & Text (Default)
  --bg-app: #0b0f19;
  --bg-surface: #111827;
  --bg-surface-elevated: #1f2937;
  --border-color: rgba(255, 255, 255, 0.08);
  --text-primary: #f9fafb;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  
  // Glassmorphism
  --glass-bg: rgba(17, 24, 39, 0.75);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: blur(12px);
}
```

### B. Mixins Úteis (`src/styles/abstracts/_mixins.scss`)
```scss
@use 'sass:math';

// Responsividade por Breakpoints
$breakpoints: (
  'sm': 640px,
  'md': 768px,
  'lg': 1024px,
  'xl': 1280px
);

@mixin respond-to($breakpoint) {
  @if map-has-key($breakpoints, $breakpoint) {
    @media (min-width: map-get($breakpoints, $breakpoint)) {
      @content;
    }
  } @else {
    @media (min-width: $breakpoint) {
      @content;
    }
  }
}

// Glassmorphism Card
@mixin glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 1rem;
}

// Flex Center
@mixin flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### C. Encaminhador Central (`src/styles/abstracts/_index.scss`)
```scss
@forward 'colors';
@forward 'variables';
@forward 'typography';
@forward 'functions';
@forward 'mixins';
```

---

## 4. Uso nos Componentes Standalone

Em qualquer componente `.component.scss`, importe as abstrações de forma limpa:

```scss
@use 'abstracts' as *;

:host {
  display: block;
}

.fortnight-card {
  @include glass-card;
  padding: 1.5rem;
  transition: transform 0.2s ease, border-color 0.2s ease;

  &--deficit {
    border-color: var(--color-danger-border);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  &__balance {
    font-size: 1.25rem;
    font-weight: 700;

    &.is-positive {
      color: var(--color-success);
    }

    &.is-negative {
      color: var(--color-danger);
    }
  }
}
```

---

## 5. Diretrizes de Qualidade SCSS

1. **Nunca use `@import`**: Utilize sempre a sintaxe moderna `@use 'abstracts' as *;`.
2. **Encapsulamento**: Mantenha estilos específicos dentro do `.component.scss` de cada componente standalone.
3. **Valores Dinâmicos via CSS Variables**: Permite temas (dark/light) e customizações em tempo de execução sem re-compilação de CSS.
4. **Mobile First**: Escreva os estilos padrão para mobile e expanda com `@include respond-to('md')` e `@include respond-to('lg')`.
