// Universal Mock Data for Dynatrace Grail API
// Supports: Frontend, Backend, AWS Lambda, Kubernetes, Databases, etc.

export interface GrailRecord {
  timestamp: string;
  content: string;
  loglevel: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";
  "log.source": string;
  [key: string]: any; // Dynamic fields
}

export interface GrailResponse {
  state: "SUCCEEDED" | "RUNNING" | "FAILED";
  progress: number;
  result?: {
    records: GrailRecord[];
    types: Array<{
      indexRange: [number, number];
      mappings: Record<string, string>;
    }>;
    metadata: {
      grail: {
        query: string;
        timezone: string;
        locale: string;
        analysisTimeframe: {
          start: string;
          end: string;
        };
      };
      scannedBytes: number;
      scannedRecords: number;
      executionTimeMillis: number;
    };
  };
  error?: {
    code: number;
    message: string;
    details?: any;
  };
  requestToken?: string;
}

