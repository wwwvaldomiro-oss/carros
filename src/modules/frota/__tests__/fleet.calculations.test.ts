import { describe, expect, it } from 'vitest';
import { fuelingFormSchema } from '../components/FuelingForm';
import { createSeedSnapshot } from '../services/fleet.seed';
import type { FuelingRecord } from '../types/fleet.types';
import {
  computeFleetKpis,
  computeRouteAudit,
  computeVehicleTcoSummary,
  detectConsumptionAnomalies,
  evaluateCnhStatus,
  evaluateReminderStatus,
  getEffectiveFineAmount,
  parseNfceQrPayload,
  recalculateFuelingAverages,
  suggestDriverForDate,
} from '../utils/fleet.calculations';

describe('Fleet Calculations Engine', () => {
  it('calculates full-tank-to-full-tank km/L accurately including intermediate partial fills', () => {
    const records: FuelingRecord[] = [
      {
        id: 'f1',
        vehicleId: 'v1',
        driverId: 'd1',
        date: '2026-10-01',
        odometer: 10000,
        fuelType: 'GASOLINA',
        quantity: 40,
        unitPrice: 6.0,
        totalCost: 240,
        fullTank: true,
      },
      {
        id: 'f2',
        vehicleId: 'v1',
        driverId: 'd1',
        date: '2026-10-05',
        odometer: 10200,
        fuelType: 'GASOLINA',
        quantity: 15,
        unitPrice: 6.0,
        totalCost: 90,
        fullTank: false,
      },
      {
        id: 'f3',
        vehicleId: 'v1',
        driverId: 'd1',
        date: '2026-10-12',
        odometer: 10550,
        fuelType: 'GASOLINA',
        quantity: 35,
        unitPrice: 6.0,
        totalCost: 210,
        fullTank: true,
      },
    ];

    const calculated = recalculateFuelingAverages(records);
    const f1 = calculated.find((r) => r.id === 'f1');
    const f2 = calculated.find((r) => r.id === 'f2');
    const f3 = calculated.find((r) => r.id === 'f3');

    expect(f1?.calculatedAvg).toBeUndefined();
    expect(f2?.calculatedAvg).toBeUndefined();
    // 550 km / (15 + 35) L = 11.00 km/L
    expect(f3?.calculatedAvg).toBe(11);
  });

  it('detects consumption anomalies when efficiency drops >= 15% below vehicle baseline', () => {
    const seed = createSeedSnapshot();
    const anomalies = detectConsumptionAnomalies(seed.fuelings, 'TODOS', 15);
    // veh-3 tem uma queda acentuada em 2026-11-05 (850 km / 118 L = 7.20 vs ~9.42 km/L)
    expect(anomalies.length).toBeGreaterThanOrEqual(1);
    expect(anomalies[0].vehicleId).toBe('veh-3');
    expect(anomalies[0].dropPercent).toBeGreaterThanOrEqual(15);
  });

  it('computes KPIs and TCO summary including FIPE depreciation and SNE-discounted fines', () => {
    const seed = createSeedSnapshot();
    const kpis = computeFleetKpis(seed, 'TODOS', '90D');
    expect(kpis.totalCost).toBeGreaterThan(0);
    expect(kpis.finesCost).toBeGreaterThan(0);
    expect(kpis.costPerKm).toBeGreaterThan(0);

    const tco = computeVehicleTcoSummary(seed, 'veh-1');
    expect(tco).toHaveLength(1);
    expect(tco[0].fixedAndDepreciationMonthly).toBeGreaterThan(1180);
    expect(tco[0].totalTcoCost).toBeGreaterThan(tco[0].totalOperationalCost);
  });

  it('evaluates reminder and CNH statuses correctly', () => {
    const seed = createSeedSnapshot();
    const v3 = seed.vehicles.find((v) => v.id === 'veh-3');
    const overdueRem = seed.reminders.find((r) => r.id === 'rem-4')!;
    const evalOverdue = evaluateReminderStatus(overdueRem, v3, '2026-11-17');
    expect(evalOverdue.status).toBe('VENCIDO');

    const expiringDriver = seed.drivers.find((d) => d.id === 'drv-2')!;
    const cnhStatus = evaluateCnhStatus(expiringDriver, '2026-11-17');
    expect(cnhStatus.status).toBe('ATENCAO');
  });

  it('parses SEFAZ NFC-e QR payloads and suggests driver for fine date', () => {
    const parsed = parseNfceQrPayload(
      'https://www.nfce.fazenda.sp.gov.br/consulta?p=35261144221100001999650010001245121004512349|2|1|1|A1B2&vNF=286.40&dhEmi=2026-11-17&xNome=Posto%20Ipiranga'
    );
    expect(parsed).not.toBeNull();
    expect(parsed?.nfceKey).toBe('35261144221100001999650010001245121004512349');
    expect(parsed?.totalCost).toBe(286.4);
    expect(parsed?.date).toBe('2026-11-17');
    expect(parsed?.stationName).toBe('Posto Ipiranga');

    const seed = createSeedSnapshot();
    const driver = suggestDriverForDate(seed, 'veh-2', '2026-11-14');
    expect(driver).toBe('drv-2');

    const fineWithSne = seed.fines[0];
    expect(getEffectiveFineAmount(fineWithSne)).toBeCloseTo(fineWithSne.amount * 0.6, 2);
  });

  it('flags route distance deviations >= 15% vs Maps estimate', () => {
    const seed = createSeedSnapshot();
    const flaggedRoute = seed.routes.find((r) => r.id === 'rt-2')!;
    const audit = computeRouteAudit(flaggedRoute);
    expect(audit?.flagged).toBe(true);
    expect(audit?.deltaPercent).toBeGreaterThan(15);
  });

  it('validates FuelingForm schema via Zod', () => {
    const valid = fuelingFormSchema.safeParse({
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      date: '2026-11-17',
      odometer: 49000,
      fuelType: 'DIESEL',
      quantity: 50,
      unitPrice: 6.2,
      totalCost: 310,
      fullTank: true,
    });
    expect(valid.success).toBe(true);

    const invalid = fuelingFormSchema.safeParse({
      vehicleId: 'veh-1',
      driverId: 'drv-1',
      date: '2026-11-17',
      odometer: -10,
      fuelType: 'DIESEL',
      quantity: 0,
      unitPrice: 6.2,
      totalCost: 0,
      fullTank: true,
    });
    expect(invalid.success).toBe(false);
  });
});
