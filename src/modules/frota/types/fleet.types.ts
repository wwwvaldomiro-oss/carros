export type FuelType = 'GASOLINA' | 'ETANOL' | 'DIESEL' | 'GNV' | 'ELETRICO' | 'FLEX';
export type VehicleStatus = 'ATIVO' | 'MANUTENCAO' | 'INATIVO';
export type MaintenanceType = 'PREVENTIVA' | 'CORRETIVA';
export type MaintenanceStatus = 'ABERTA' | 'EM_EXECUCAO' | 'CONCLUIDA';
export type LedgerKind = 'DESPESA' | 'RECEITA';
export type FineStatus = 'PENDENTE' | 'INDICADO' | 'PAGA' | 'RECORRIDA';

export type FleetTab =
  | 'dashboard'
  | 'veiculos'
  | 'lancamentos'
  | 'checklists'
  | 'percursos';

export interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number;
  fuelType: FuelType;
  currentOdometer: number;
  status: VehicleStatus;
  assignedDriverId?: string;
  renavam?: string;
  chassis?: string;
  tankCapacityLiters?: number;
  fipeValue?: number; // Valor de mercado FIPE para cálculo de depreciação e TCO
  monthlyFixedCost?: number; // Custo fixo mensal rateado (seguro, IPVA, financiamento)
  notes?: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  userId: string; // Vínculo com o usuário do app principal (Órion / Conecta)
  name: string;
  cnhNumber: string;
  cnhCategory: string;
  cnhExpiry: string; // ISO YYYY-MM-DD
  phone?: string;
  allowedVehicleIds: string[];
  active: boolean;
}

export interface FuelingRecord {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string; // ISO YYYY-MM-DD
  odometer: number;
  fuelType: FuelType;
  quantity: number; // Litros ou kWh
  unitPrice: number;
  totalCost: number;
  fullTank: boolean; // Essencial para cálculo real de autonomia entre tanques cheios
  stationName?: string;
  calculatedAvg?: number; // km/L ou km/kWh
  nfceKey?: string; // Chave ou URL de NFC-e escaneada via QR Code
  odometerPhotoUrl?: string; // Foto do painel / comprovante
  notes?: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  driverId?: string;
  type: MaintenanceType;
  status?: MaintenanceStatus;
  originChecklistId?: string; // Vínculo automático quando originado de Checklist Não Conforme
  date: string; // ISO YYYY-MM-DD
  odometer: number;
  category: string; // Ex: "Troca de óleo", "Pneus", "Revisão"
  providerName?: string;
  partsCost: number;
  laborCost: number;
  totalCost: number;
  notes?: string;
  attachmentUrl?: string;
}

export interface ExpenseOrRevenue {
  id: string;
  vehicleId: string;
  driverId?: string;
  kind: LedgerKind;
  category: string; // Ex: "Pedágio", "IPVA", "Multa", "Frete"
  date: string; // ISO YYYY-MM-DD
  amount: number;
  description?: string;
  bankReferenceId?: string; // ID de conciliação Open Finance (Pluggy)
}

export interface FineRecord {
  id: string;
  vehicleId: string;
  driverId?: string;
  date: string; // ISO YYYY-MM-DD
  time?: string; // HH:mm
  infractionCode: string; // Ex: "7455-0"
  description: string;
  location?: string;
  points: number;
  amount: number;
  sneDiscountApplied: boolean; // Desconto de 40% via SNE
  driverIndicationDeadline?: string; // ISO YYYY-MM-DD
  status: FineStatus;
}

export interface ChecklistItemResult {
  id: string;
  label: string;
  compliant: boolean;
  photoUrl?: string;
  note?: string;
}

export interface VehicleChecklist {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string; // ISO YYYY-MM-DD
  odometer: number;
  items: ChecklistItemResult[];
  hasIssues: boolean;
  generatedMaintenanceId?: string;
  generalNotes?: string;
}

export interface RouteTrip {
  id: string;
  vehicleId: string;
  driverId: string;
  date: string; // ISO YYYY-MM-DD
  origin: string;
  destination: string;
  startOdometer: number;
  endOdometer: number;
  distanceKm: number;
  estimatedKm?: number; // Distância estimada via Maps para auditoria de desvio
  purpose?: string;
}

export interface FleetReminder {
  id: string;
  vehicleId: string;
  title: string; // Ex: "Revisão 60.000 km" ou "Renovar Seguro"
  category: 'MANUTENCAO' | 'DOCUMENTACAO' | 'SEGURO' | 'OUTRO';
  dueDate?: string; // ISO YYYY-MM-DD
  dueOdometer?: number;
  completed: boolean;
  completedAt?: string;
  notes?: string;
}

export interface FleetStateSnapshot {
  vehicles: Vehicle[];
  drivers: Driver[];
  fuelings: FuelingRecord[];
  maintenances: MaintenanceRecord[];
  ledger: ExpenseOrRevenue[];
  fines: FineRecord[];
  checklists: VehicleChecklist[];
  routes: RouteTrip[];
  reminders: FleetReminder[];
}

export interface FleetModuleUser {
  id: string;
  name: string;
  email?: string;
  role: 'GESTOR' | 'MOTORISTA' | 'ADMIN';
}

export interface FleetRepositoryAdapter {
  loadSnapshot(): Promise<FleetStateSnapshot>;
  saveSnapshot(snapshot: FleetStateSnapshot): Promise<void>;
  resetToSeed?(): Promise<FleetStateSnapshot>;
}

export interface FleetModuleProps {
  adapter?: FleetRepositoryAdapter;
  currentUser?: FleetModuleUser;
  onNavigateBack?: () => void;
  initialTab?: FleetTab;
  embedded?: boolean;
}
