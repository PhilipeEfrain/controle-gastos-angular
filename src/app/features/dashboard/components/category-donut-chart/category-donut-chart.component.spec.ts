import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CategoryDonutChartComponent } from './category-donut-chart.component';
import { Expense } from '../../../../core/models/finance.model';

describe('CategoryDonutChartComponent', () => {
  let component: CategoryDonutChartComponent;
  let fixture: ComponentFixture<CategoryDonutChartComponent>;

  const mockExpenses: Expense[] = [
    {
      id: '1',
      descricao: 'Aluguel',
      valor: 1500,
      categoria: 'Moradia',
      quinzena: 1,
      status_pagamento: true,
      tipo: 'despesa',
    },
    {
      id: '2',
      descricao: 'Supermercado',
      valor: 500,
      categoria: 'Alimentação',
      quinzena: 1,
      status_pagamento: false,
      tipo: 'despesa',
    },
    {
      id: '3',
      descricao: 'Freelance',
      valor: 800,
      categoria: 'Outros',
      quinzena: 1,
      status_pagamento: true,
      tipo: 'renda_extra', // deve ser ignorado nos cálculos do donut de gastos
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryDonutChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoryDonutChartComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente', () => {
    fixture.componentRef.setInput('expenses', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('deve exibir empty state quando não houver despesas', () => {
    fixture.componentRef.setInput('expenses', []);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
    expect(component.totalExpenses()).toBe(0);
  });

  it('deve calcular corretamente os totais e percentuais por categoria excluindo rendas extras', () => {
    fixture.componentRef.setInput('expenses', mockExpenses);
    fixture.detectChanges();

    expect(component.totalExpenses()).toBe(2000); // 1500 + 500
    const categories = component.categoriesSpending();
    expect(categories.length).toBe(2);

    const moradia = categories.find((c) => c.category === 'Moradia');
    expect(moradia).toBeDefined();
    expect(moradia?.total).toBe(1500);
    expect(moradia?.percentage).toBe(75);

    const alimentacao = categories.find((c) => c.category === 'Alimentação');
    expect(alimentacao).toBeDefined();
    expect(alimentacao?.total).toBe(500);
    expect(alimentacao?.percentage).toBe(25);
  });

  it('deve atualizar hoveredCategory e activeCategoryData ao passar o mouse', () => {
    fixture.componentRef.setInput('expenses', mockExpenses);
    fixture.detectChanges();

    component.onCategoryHover('Moradia');
    expect(component.hoveredCategory()).toBe('Moradia');
    expect(component.activeCategoryData()?.category).toBe('Moradia');

    component.onCategoryHover(null);
    expect(component.hoveredCategory()).toBeNull();
    expect(component.activeCategoryData()).toBeNull();
  });
});
