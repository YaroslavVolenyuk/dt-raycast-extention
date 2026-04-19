// types/log.ts
// Single source of truth for log record shape returned by Dynatrace Grail API.

export interface LogRecord {
  timestamp: string;
  content: string;
  loglevel: "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL" | string;
  status?: string;

  // ── Service / App ────────────────────────────────────────────────────────
  "service.name"?: string;
  "dt.app.name"?: string;
  "dt.app.version"?: string;

  // ── Host / Infrastructure ────────────────────────────────────────────────
  "host.name"?: string;            // human-readable hostname
  "dt.entity.host"?: string;       // Dynatrace entity reference
  "dt.host_group.id"?: string;     // host group / cluster name

  // ── AWS ──────────────────────────────────────────────────────────────────
  "aws.region"?: string;
  "aws.availability_zone"?: string;
  "aws.account.id"?: string;
  "aws.arn"?: string;

  // ── Kubernetes ───────────────────────────────────────────────────────────
  "k8s.cluster.name"?: string;
  "k8s.namespace.name"?: string;
  "k8s.node.name"?: string;
  "k8s.pod.uid"?: string;

  // ── Process ──────────────────────────────────────────────────────────────
  "dt.process.name"?: string;
  "dt.process_group.detected_name"?: string;
  "process.technology"?: string | string[];

  // ── Pipeline / Ingestion ─────────────────────────────────────────────────
  "dt.openpipeline.source"?: string;
  "dt.openpipeline.pipelines"?: string | string[];

  // ── Misc ─────────────────────────────────────────────────────────────────
  "event.type"?: string;
  "log.source"?: string;
  OperatorVersion?: string;

  // ── Telemetry ────────────────────────────────────────────────────────────
  trace_id?: string;
  span_id?: string;

  [key: string]: unknown; // Grail may return additional dynamic fields
}
