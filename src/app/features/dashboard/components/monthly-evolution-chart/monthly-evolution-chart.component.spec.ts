import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MonthlyEvolutionChartComponent } from './monthly-evolution-chart.component';
import { MonthlyCycle } from '../../../../core/models/finance.model';

describe('MonthlyEvolutionChartComponent', () => {
  let component: MonthlyEvolutionChartComponent;
  let fixture: ComponentFixture<MonthlyEvolutionChartComponent>;

  const mockCycles: MonthlyCycle[] = [
    {
      mesAno: '2026-07',
      renda_quinzena_1: 3000,
      renda_quinzena_2: 3000,
      total_renda: 6000,
      total_gastos: 4500,
      saldo_final: 1500,
    },
    {
      mesAno: '2026-08',
      renda_quinzena_1: 3000,
      renda_quinzena_2: 3000,
      total_renda: 6000,
      total_gastos: 6800,
      saldo_final: -800,
    },
    {
      mesAno: '2026-09',
      renda_quinzena_1: 3500,
      renda_quinzena_2: 3500,
      total_renda: 7000,
      total_gastos: 5000,
      saldo_final: 2000,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MonthlyEvolutionChartComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MonthlyEvolutionChartComponent);
    component = fixture.componentInstance;
  });

  it('deve criar o componente', () => {
    fixture.componentRef.setInput('cycles', []);
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('deve exibir empty state quando não houver ciclos', () => {
    fixture.componentRef.setInput('cycles', []);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
    expect(component.chartData().length).toBe(0);
  });

  it('deve normalizar e calcular alturas das barras para histórico ordenado', () => {
    fixture.componentRef.setInput('cycles', mockCycles);
    fixture.componentRef.setInput('selectedMonth', '2026-09');
    fixture.detectChanges();

    const data = component.chartData();
    expect(data.length).toBe(3);
    expect(data[0].mesAno).toBe('2026-07');
    expect(data[1].mesAno).toBe('2026-08');
    expect(data[1].isDeficit).toBe(true);
    expect(data[2].mesAno).toBe('2026-09');
    expect(data[2].isCurrent).toBe(true);
    expect(data[2].isDeficit).toBe(false);
  });

  it('deve alternar hoveredMonth e activeMonthData', () => {
    fixture.componentRef.setInput('cycles', mockCycles);
    fixture.detectChanges();

    component.onMonthHover('2026-08');
    expect(component.hoveredMonth()).toBe('2026-08');
    expect(component.activeMonthData()?.saldo).toBe(-800);

    component.onMonthHover(null);
    expect(component.hoveredMonth()).toBeNull();
    expect(component.activeMonthData()).toBeNull();
  });
});
