// Module registry for future module system
// Each module registers its routes, nav items, and required permissions

export interface ModuleRegistration {
  id: string;
  name: string;
  routes: {
    path: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    component: React.LazyExoticComponent<React.ComponentType<any>>;
  }[];
  navItems: {
    label: string;
    icon: string;
    path: string;
  }[];
}

// Future modules will register themselves here
// For now, CRM module is built into the main app
// Logistics, Warehouse, and Services modules will be lazy-loaded

export const MODULE_IDS = {
  CRM: 'crm',
  LOGISTICS: 'logistics',
  WAREHOUSE: 'warehouse',
  SERVICES: 'services',
} as const;
