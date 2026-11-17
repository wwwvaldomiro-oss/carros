import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useFleet } from '../context/FleetContext';
import {
  expenseOrRevenueSchema,
  fineSchema,
  maintenanceSchema,
  routeTripSchema,
} from '../schemas/fleet.schemas';
import type { FineStatus, LedgerKind, MaintenanceType } from '../types/fleet.types';
import {
  formatBRL,
  formatKm,
  formatNumberBR,
  suggestDriverForDate,
} from '../utils/fleet.calculations';
import { FuelingForm } from './FuelingForm';

export type QuickEntryKind =
  | 'ABASTECIMENTO'
  | 'MANUTENCAO'
  | 'FINANCEIRO'
  | 'PERCURSO'
  | 'MULTA';

interface QuickEntryModalProps {
  open: boolean;
  initialKind?: QuickEntryKind;
  onClose: () => void;
}

const TODAY_ISO = '2026-11-17';

export const QuickEntryModal: React.FC<QuickEntryModalProps> = ({
  open,
  initialKind = 'ABASTECIMENTO',
  onClose,
}) => {
  const {
    snapshot,
    selectedVehicleFilter,
    addMaintenance,
    addLedgerEntry,
    addRouteTrip,
    addFine,
  } = useFleet();

  const [kind, setKind] = useState<QuickEntryKind>(initialKind);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultVehicleId =
    selectedVehicleFilter !== 'TODOS'
      ? selectedVehicleFilter
      : snapshot.vehicles[0]?.id ?? '';
  const selectedVehicle = snapshot.vehicles.find((v) => v.id === defaultVehicleId);

  const [vehicleId, setVehicleId] = useState(defaultVehicleId);
  const [driverId, setDriverId] = useState(
    selectedVehicle?.assignedDriverId ?? snapshot.drivers[0]?.id ?? ''
  );
  const [date, setDate] = useState(TODAY_ISO);

  // Manutenção
  const [maintType, setMaintType] = useState<MaintenanceType>('PREVENTIVA');
  const [maintOdometer, setMaintOdometer] = useState(
    String(selectedVehicle?.currentOdometer ?? 0)
  );
  const [maintCategory, setMaintCategory] = useState('Troca de óleo e filtros');
  const [providerName, setProviderName] = useState('');
  const [partsCost, setPartsCost] = useState('0');
  const [laborCost, setLaborCost] = useState('0');
  const [maintNotes, setMaintNotes] = useState('');

  // Financeiro (Despesa / Receita)
  const [ledgerKind, setLedgerKind] = useState<LedgerKind>('DESPESA');
  const [ledgerCategory, setLedgerCategory] = useState('Pedágio');
  const [ledgerAmount, setLedgerAmount] = useState('');
  const [ledgerDescription, setLedgerDescription] = useState('');

  // Percurso
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [startOdometer, setStartOdometer] = useState(
    String(selectedVehicle?.currentOdometer ?? 0)
  );
  const [endOdometer, setEndOdometer] = useState(
    String((selectedVehicle?.currentOdometer ?? 0) + 80)
  );
  const [estimatedKm, setEstimatedKm] = useState('');
  const [purpose, setPurpose] = useState('');

  // Multa
  const [fineTime, setFineTime] = useState('10:00');
  const [infractionCode, setInfractionCode] = useState('7455-0');
  const [fineDescription, setFineDescription] = useState('');
  const [fineLocation, setFineLocation] = useState('');
  const [finePoints, setFinePoints] = useState('4');
  const [fineAmount, setFineAmount] = useState('130.16');
  const [sneDiscountApplied, setSneDiscountApplied] = useState(true);
  const [driverIndicationDeadline, setDriverIndicationDeadline] = useState('2026-12-10');
  const [fineStatus, setFineStatus] = useState<FineStatus>('PENDENTE');

  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setErrorMsg(null);
      const vehId =
        selectedVehicleFilter !== 'TODOS'
          ? selectedVehicleFilter
          : snapshot.vehicles[0]?.id ?? '';
      const veh = snapshot.vehicles.find((v) => v.id === vehId);
      setVehicleId(vehId);
      setDriverId(veh?.assignedDriverId ?? snapshot.drivers[0]?.id ?? '');
      if (veh) {
        setMaintOdometer(String(veh.currentOdometer));
        setStartOdometer(String(veh.currentOdometer));
        setEndOdometer(String(veh.currentOdometer + 60));
      }
    }
  }, [open, initialKind, selectedVehicleFilter, snapshot.vehicles, snapshot.drivers]);

  // Auto-sugerir condutor ao mudar data ou veículo no lançamento de multa
  useEffect(() => {
    if (kind === 'MULTA' && vehicleId && date) {
      const matched = suggestDriverForDate(snapshot, vehicleId, date);
      if (matched) setDriverId(matched);
    }
  }, [kind, vehicleId, date, snapshot]);

  if (!open) return null;

  const currentVeh = snapshot.vehicles.find((v) => v.id === vehicleId);

  const handleVehicleChange = (newVehId: string) => {
    setVehicleId(newVehId);
    const veh = snapshot.vehicles.find((v) => v.id === newVehId);
    if (veh) {
      if (veh.assignedDriverId) setDriverId(veh.assignedDriverId);
      setMaintOdometer(String(veh.currentOdometer));
      setStartOdometer(String(veh.currentOdometer));
      setEndOdometer(String(veh.currentOdometer + 60));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      if (kind === 'MANUTENCAO') {
        const pCost = parseFloat(partsCost) || 0;
        const lCost = parseFloat(laborCost) || 0;
        const parsed = maintenanceSchema.safeParse({
          vehicleId,
          driverId: driverId || undefined,
          type: maintType,
          status: 'CONCLUIDA',
          date,
          odometer: maintOdometer,
          category: maintCategory,
          providerName,
          partsCost: pCost,
          laborCost: lCost,
          notes: maintNotes,
        });
        if (!parsed.success) {
          setErrorMsg(parsed.error.issues[0]?.message ?? 'Verifique os campos.');
          setSubmitting(false);
          return;
        }
        await addMaintenance({
          ...parsed.data,
          totalCost: Number((parsed.data.partsCost + parsed.data.laborCost).toFixed(2)),
        });
      } else if (kind === 'FINANCEIRO') {
        const parsed = expenseOrRevenueSchema.safeParse({
          vehicleId,
          driverId: driverId || undefined,
          kind: ledgerKind,
          category: ledgerCategory,
          date,
          amount: ledgerAmount,
          description: ledgerDescription,
        });
        if (!parsed.success) {
          setErrorMsg(parsed.error.issues[0]?.message ?? 'Verifique os campos.');
          setSubmitting(false);
          return;
        }
        await addLedgerEntry(parsed.data);
      } else if (kind === 'PERCURSO') {
        const parsed = routeTripSchema.safeParse({
          vehicleId,
          driverId,
          date,
          origin,
          destination,
          startOdometer,
          endOdometer,
          estimatedKm: estimatedKm ? Number(estimatedKm) : undefined,
          purpose,
        });
        if (!parsed.success) {
          setErrorMsg(parsed.error.issues[0]?.message ?? 'Verifique os campos.');
          setSubmitting(false);
          return;
        }
        await addRouteTrip(parsed.data);
      } else if (kind === 'MULTA') {
        const parsed = fineSchema.safeParse({
          vehicleId,
          driverId: driverId || undefined,
          date,
          time: fineTime || undefined,
          infractionCode,
          description: fineDescription,
          location: fineLocation || undefined,
          points: finePoints,
          amount: fineAmount,
          sneDiscountApplied,
          driverIndicationDeadline: driverIndicationDeadline || undefined,
          status: fineStatus,
        });
        if (!parsed.success) {
          setErrorMsg(parsed.error.issues[0]?.message ?? 'Verifique os campos.');
          setSubmitting(false);
          return;
        }
        await addFine(parsed.data);
      }

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const distancePreview = Math.max(
    0,
    (parseFloat(endOdometer) || 0) - (parseFloat(startOdometer) || 0)
  );
  const maintTotalPreview = (parseFloat(partsCost) || 0) + (parseFloat(laborCost) || 0);
  const effectiveFinePreview =
    (parseFloat(fineAmount) || 0) * (sneDiscountApplied ? 0.6 : 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0C1928]/60 backdrop-blur-[1px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-entry-title"
        className="w-full max-w-2xl bg-white border border-[#E7E1D5] rounded-[10px] shadow-xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="px-6 py-4 border-b border-[#E7E1D5] flex items-center justify-between">
          <h2 id="quick-entry-title" className="font-display text-lg font-semibold text-[#0C1928]">
            Novo Registro de Frota
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#5C6B7A] hover:text-[#0C1928] hover:bg-[#F7F8FA] transition-colors"
            aria-label="Fechar janela"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented Control de Tipo */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 p-1 bg-[#F7F8FA] border border-[#E7E1D5] rounded-lg">
            {(
              [
                { id: 'ABASTECIMENTO', label: 'Abastecimento' },
                { id: 'MANUTENCAO', label: 'Manutenção' },
                { id: 'FINANCEIRO', label: 'Desp. / Rec.' },
                { id: 'PERCURSO', label: 'Percurso' },
                { id: 'MULTA', label: 'Multa' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setKind(tab.id);
                  setErrorMsg(null);
                }}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  kind === tab.id
                    ? 'bg-[#173D4A] text-white'
                    : 'text-[#5C6B7A] hover:text-[#0C1928]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {kind === 'ABASTECIMENTO' ? (
          <div className="p-6 overflow-y-auto">
            <FuelingForm
              onSuccess={onClose}
              onCancel={onClose}
              submitLabel="Salvar Abastecimento"
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {errorMsg && (
              <div className="p-3 rounded-lg bg-[#9E3B3B]/10 border border-[#9E3B3B]/30 text-xs font-medium text-[#9E3B3B]">
                {errorMsg}
              </div>
            )}

            {/* Veículo e Motorista */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Veículo</label>
                <select
                  value={vehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E7E1D5] bg-white px-3 text-sm text-[#0C1928] focus:outline-none focus:ring-2 focus:ring-[#173D4A]"
                >
                  {snapshot.vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} — {v.brand} {v.model}
                    </option>
                  ))}
                </select>
                {currentVeh && (
                  <p className="mt-1 text-[11px] text-[#5C6B7A] font-mono-tabular">
                    Odômetro atual: {formatKm(currentVeh.currentOdometer)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                  {kind === 'MULTA' ? 'Condutor identificado' : 'Motorista'}
                </label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E7E1D5] bg-white px-3 text-sm text-[#0C1928] focus:outline-none focus:ring-2 focus:ring-[#173D4A]"
                >
                  {snapshot.drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {kind === 'MANUTENCAO' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Tipo</label>
                    <select
                      value={maintType}
                      onChange={(e) => setMaintType(e.target.value as MaintenanceType)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                    >
                      <option value="PREVENTIVA">Preventiva</option>
                      <option value="CORRETIVA">Corretiva</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Data</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Odômetro (km)
                    </label>
                    <input
                      type="number"
                      value={maintOdometer}
                      onChange={(e) => setMaintOdometer(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Serviço realizado
                    </label>
                    <input
                      type="text"
                      value={maintCategory}
                      onChange={(e) => setMaintCategory(e.target.value)}
                      placeholder="Ex: Troca de óleo, Pastilhas de freio"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Oficina / Fornecedor
                    </label>
                    <input
                      type="text"
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      placeholder="Ex: Concessionária ou Centro Automotivo"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Peças (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={partsCost}
                      onChange={(e) => setPartsCost(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Mão de obra (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={laborCost}
                      onChange={(e) => setLaborCost(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <span className="text-[11px] text-[#5C6B7A]">Total calculado</span>
                    <span className="h-10 flex items-center text-sm font-semibold text-[#173D4A] font-mono-tabular">
                      {formatBRL(maintTotalPreview)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                    Observações / NF
                  </label>
                  <textarea
                    rows={2}
                    value={maintNotes}
                    onChange={(e) => setMaintNotes(e.target.value)}
                    placeholder="Detalhes das peças substituídas ou número da NF-e"
                    className="w-full rounded-lg border border-[#E7E1D5] px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {kind === 'FINANCEIRO' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Natureza
                    </label>
                    <select
                      value={ledgerKind}
                      onChange={(e) => {
                        const val = e.target.value as LedgerKind;
                        setLedgerKind(val);
                        setLedgerCategory(val === 'RECEITA' ? 'Frete contratado' : 'Pedágio');
                      }}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                    >
                      <option value="DESPESA">Despesa</option>
                      <option value="RECEITA">Receita</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Data</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={ledgerAmount}
                      onChange={(e) => setLedgerAmount(e.target.value)}
                      placeholder="0,00"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={ledgerCategory}
                    onChange={(e) => setLedgerCategory(e.target.value)}
                    placeholder={
                      ledgerKind === 'RECEITA'
                        ? 'Ex: Frete, Reembolso de viagem, Diária'
                        : 'Ex: Pedágio, IPVA, Seguro, Lavagem'
                    }
                    className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={ledgerDescription}
                    onChange={(e) => setLedgerDescription(e.target.value)}
                    placeholder="Histórico ou centro de custo"
                    className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                  />
                </div>
              </>
            )}

            {kind === 'PERCURSO' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Origem</label>
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      placeholder="Ex: Base Órion São Paulo"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Destino</label>
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      placeholder="Ex: Unidade Campinas"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Data</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-2.5 text-xs font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Odom. inicial
                    </label>
                    <input
                      type="number"
                      value={startOdometer}
                      onChange={(e) => setStartOdometer(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-2.5 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Odom. final
                    </label>
                    <input
                      type="number"
                      value={endOdometer}
                      onChange={(e) => setEndOdometer(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-2.5 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Km Maps (opc.)
                    </label>
                    <input
                      type="number"
                      value={estimatedKm}
                      onChange={(e) => setEstimatedKm(e.target.value)}
                      placeholder="Rota"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-2.5 text-sm font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#F7F8FA] border border-[#E7E1D5]">
                  <span className="text-xs text-[#5C6B7A]">Distância calculada</span>
                  <span className="text-sm font-semibold font-mono-tabular text-[#173D4A]">
                    {formatNumberBR(distancePreview, 0)} km
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                    Finalidade da viagem
                  </label>
                  <input
                    type="text"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="Ex: Visita técnica ou transporte de carga"
                    className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                  />
                </div>
              </>
            )}

            {kind === 'MULTA' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Data infração
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">Hora</label>
                    <input
                      type="time"
                      value={fineTime}
                      onChange={(e) => setFineTime(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Código CTB
                    </label>
                    <input
                      type="text"
                      value={infractionCode}
                      onChange={(e) => setInfractionCode(e.target.value)}
                      placeholder="Ex: 7455-0"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                    Descrição da infração
                  </label>
                  <input
                    type="text"
                    value={fineDescription}
                    onChange={(e) => setFineDescription(e.target.value)}
                    placeholder="Ex: Transitar em velocidade superior à máxima em até 20%"
                    className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Pontos CNH
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={21}
                      value={finePoints}
                      onChange={(e) => setFinePoints(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Valor nominal (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm font-mono-tabular"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Prazo indicação
                    </label>
                    <input
                      type="date"
                      value={driverIndicationDeadline}
                      onChange={(e) => setDriverIndicationDeadline(e.target.value)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-2.5 text-xs font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Situação
                    </label>
                    <select
                      value={fineStatus}
                      onChange={(e) => setFineStatus(e.target.value as FineStatus)}
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-2.5 text-sm"
                    >
                      <option value="PENDENTE">Pendente</option>
                      <option value="INDICADO">Condutor indicado</option>
                      <option value="PAGA">Paga</option>
                      <option value="RECORRIDA">Em recurso</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block text-xs font-medium text-[#0C1928] mb-1.5">
                      Local da ocorrência
                    </label>
                    <input
                      type="text"
                      value={fineLocation}
                      onChange={(e) => setFineLocation(e.target.value)}
                      placeholder="Rodovia / Avenida / Município"
                      className="w-full h-10 rounded-lg border border-[#E7E1D5] px-3 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 sm:pt-5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sneDiscountApplied}
                      onChange={(e) => setSneDiscountApplied(e.target.checked)}
                      className="h-4 w-4 rounded border-[#E7E1D5] text-[#173D4A]"
                    />
                    <span className="text-xs font-medium text-[#0C1928]">
                      Adesão SNE (-40%):{' '}
                      <strong className="font-mono-tabular text-[#173D4A]">
                        {formatBRL(effectiveFinePreview)}
                      </strong>
                    </span>
                  </label>
                </div>
              </>
            )}

            <div className="pt-3 border-t border-[#E7E1D5] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-lg border border-[#E7E1D5] text-sm font-medium text-[#0C1928] hover:bg-[#F7F8FA] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 px-5 rounded-lg bg-[#173D4A] hover:bg-[#0C1928] text-white text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Salvando...' : 'Salvar Registro'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
