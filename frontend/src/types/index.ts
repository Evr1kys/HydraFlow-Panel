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
