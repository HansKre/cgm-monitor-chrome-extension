export type GlucoseData = {
  FactoryTimestamp: string;
  Timestamp: string;
  type: number;
  ValueInMgPerDl: number;
  TrendArrow?: number;
  TrendMessage?: string | null;
  MeasurementColor: number;
  GlucoseUnits: number;
  Value: number;
  isHigh: boolean;
  isLow: boolean;
  alarmType?: number;
};

export type ApiResponse = {
  jwtToken: string;
  accountIdHash: string;
  patientId: string;
};

export type LoginResponse = {
  status?: number;
  error?: { message?: string };
  data?: {
    authTicket?: { token?: string };
    user?: { id?: string };
    redirect?: boolean;
    region?: string;
  };
};

export type ConnectionsResponse = {
  data?: Array<{ patientId?: string }>;
};

export type GraphResponse = {
  data?: {
    graphData?: GlucoseData[];
    connection?: {
      glucoseMeasurement?: { Value?: number };
    };
  };
};
