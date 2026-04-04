export interface User {
  id: string;
  email: string;
  uuid: string;
  subToken: string;
  enabled: boolean;
  trafficUp: string;
  trafficDown: string;
  trafficLimit: string | null;
  expiryDate: string | null;
  remark: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  id: string;
  serverIp: string | null;
  realityEnabled: boolean;
  realityPort: number;
  realitySni: string;
  realityPbk: string | null;
  realityPvk: string | null;
  realitySid: string | null;
  wsEnabled: boolean;
  wsPort: number;
  wsPath: string | null;
  wsHost: string | null;
  ssEnabled: boolean;
  ssPort: number;
  ssMethod: string;
  ssPassword: string | null;
  cdnDomain: string | null;
  splitTunneling: boolean;
  adBlocking: boolean;
}

export interface ProtocolHealth {
  name: string;
  enabled: boolean;
  port: number;
  reachable: boolean;
  latency: number | null;
}

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    disabled: number;
    expiring: number;
  };
  xray: {
    running: boolean;
    version: string | null;
    uptime: string | null;
  };
  traffic: {
    totalUp: string;
    totalDown: string;
    total: string;
  };
  protocols: {
    reality: { enabled: boolean; port: number };
    websocket: { enabled: boolean; port: number };
    shadowsocks: { enabled: boolean; port: number };
  };
  recentAlerts: Alert[];
}

export interface Alert {
  id: string;
  isp: string;
  protocol: string;
  oldStatus: string;
  newStatus: string;
  country: string;
  createdAt: string;
}

export interface IntelligenceEntry {
  isp: string;
  country: string;
  protocols: Record<string, string>;
}

export interface Node {
  id: string;
  name: string;
  address: string;
  port: number;
  apiKey: string;
  enabled: boolean;
  status: string;
  lastCheck: string | null;
  createdAt: string;
}

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
  createdAt: string;
}

export interface Session {
  id: string;
  adminId: string;
  email: string;
  token: string;
  createdAt: string;
  userAgent: string;
  ip: string;
}

// Billing types
export interface BillingProvider {
  id: string;
  name: string;
  apiUrl: string;
  credentials: string;
  createdAt: string;
}

export interface BillingNode {
  id: string;
  nodeId: string;
  providerId: string;
  monthlyRate: number;
  currency: string;
  renewalDate: string | null;
  createdAt: string;
  node: Node;
  provider: BillingProvider;
  history: BillingHistoryEntry[];
}

export interface BillingHistoryEntry {
  id: string;
  billingNodeId: string;
  amount: number;
  currency: string;
  date: string;
  paid: boolean;
}

export interface BillingSummary {
  totalMonthly: number;
  totalUnpaid: number;
  nodeCount: number;
  currency: string;
  upcomingRenewals: {
    id: string;
    nodeName: string;
    providerName: string;
    monthlyRate: number;
    currency: string;
    renewalDate: string;
  }[];
}

// Plugin types
export interface NodePlugin {
  id: string;
  nodeId: string;
  type: string;
  config: string;
  enabled: boolean;
  node?: Node;
}

// Active session types (user connections)
export interface ActiveSession {
  id: string;
  userId: string;
  nodeId: string | null;
  protocol: string;
  clientIp: string;
  startedAt: string;
  bytesUp: string;
  bytesDown: string;
  user: {
    id: string;
    email: string;
    uuid: string;
    enabled: boolean;
    remark: string | null;
  };
  node: {
    id: string;
    name: string;
    address: string;
  } | null;
}

export interface ActiveSessionCount {
  total: number;
  byProtocol: { protocol: string; count: number }[];
}

// Squad types
export interface SquadUser {
  id: string;
  email: string;
  remark: string | null;
  enabled?: boolean;
}

export interface InternalSquad {
  id: string;
  name: string;
  description: string | null;
  nodeIds: string[];
  createdAt: string;
  users: SquadUser[];
}

export interface ExternalSquad {
  id: string;
  name: string;
  apiKey: string;
  maxUsers: number;
  hostOverrides: Record<string, string> | null;
  enabled: boolean;
  subPageTitle: string | null;
  subPageBrand: string | null;
  createdAt: string;
  users: SquadUser[];
}
