/**
 * Maintenance Agent Interface (Future Phase)
 * Suggests dispatch of municipal cleaning trucks, sensor placement, and bin emptying intervals.
 */

export interface MaintenanceDispatchRecommendation {
  zoneId: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  suggestedAction: string;
  estimatedLaborMinutes: number;
  requiresSupervisorApproval: boolean;
}

export interface IMaintenanceAgent {
  recommendDispatch(zoneId: string): Promise<MaintenanceDispatchRecommendation>;
}
