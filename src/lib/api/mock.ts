// src/lib/api/mock.ts
// Mock data for development and testing without OAuth setup.
// When useMockData preference is enabled, all API calls return these datasets.
// Each mock dataset is realistic and covers various edge cases and severity levels.

import { LogRecord } from "../types/log";
import { Problem } from "../types/problem";
import { Deployment } from "../types/deployment";
import { Span } from "../types/span";
import type { Entity } from "../types/entity";
import type { SavedQuery } from "../types/savedQuery";
import type { Workflow, WorkflowExecution, ExecutionTask } from "../types/workflow";
import type { SettingsObject } from "../types/settings";
import type { MetricData, DataPoint } from "../types/metric";
import type { SyntheticMonitorData } from "../types/synthetic";
import { ExecutionStatus, MonitorType } from "../types/synthetic";

export function ago(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const m = 60_000;
const h = 3_600_000;
const d = 24 * h;

export const MOCK_LOGS: LogRecord[] = [
  {
    timestamp: ago(2 * m),
    loglevel: "ERROR",
    content: "NullPointerException in PaymentService.processTransaction() at line 142",
    "log.source": "/var/log/payment-service/app.log",
    "service.name": "payment-service",
    "dt.entity.host": "HOST-abc123",
    status: "ERROR",
  },
  {
    timestamp: ago(5 * m),
    loglevel: "ERROR",
    content: "Failed to connect to database: Connection refused (host=db-primary:5432, retries=3)",
    "log.source": "/var/log/order-service/app.log",
    "service.name": "order-service",
    "dt.entity.host": "HOST-def456",
    status: "ERROR",
  },
  {
    timestamp: ago(12 * m),
    loglevel: "WARN",
    content: "Response time exceeded threshold: 3200ms (threshold=2000ms) for GET /api/v2/products",
    "log.source": "/var/log/api-gateway/access.log",
    "service.name": "api-gateway",
    "dt.entity.host": "HOST-ghi789",
    status: "SLOW",
  },
  {
    timestamp: ago(15 * m),
    loglevel: "ERROR",
    content:
      "Unhandled promise rejection in Lambda function processOrders: TypeError: Cannot read properties of undefined",
    "log.source": "aws-lambda://process-orders",
    "service.name": "order-processor-lambda",
    "dt.entity.host": "HOST-lambda001",
    status: "ERROR",
  },
  {
    timestamp: ago(20 * m),
    loglevel: "INFO",
    content: "Deployment completed successfully: order-service v2.4.1 → v2.4.2 (canary: 10%)",
    "log.source": "/var/log/deploy-agent/events.log",
    "service.name": "deploy-agent",
    "dt.entity.host": "HOST-ci001",
    status: "OK",
  },
  {
    timestamp: ago(28 * m),
    loglevel: "WARN",
    content: "Memory usage at 87% on pod user-service-7d4b9c-xkv2p (limit: 512Mi, used: 445Mi)",
    "log.source": "k8s://namespace/production/user-service",
    "service.name": "user-service",
    "dt.entity.host": "HOST-k8s-node-03",
    status: "WARNING",
  },
  {
    timestamp: ago(35 * m),
    loglevel: "ERROR",
    content: "Authentication token expired. User session invalidated. userId=usr_882kd, tokenAge=3601s",
    "log.source": "/var/log/auth-service/app.log",
    "service.name": "auth-service",
    "dt.entity.host": "HOST-auth01",
    status: "AUTH_ERROR",
  },
  {
    timestamp: ago(42 * m),
    loglevel: "DEBUG",
    content: "Cache miss for key: product_catalog_page_3 — fetching from origin",
    "log.source": "/var/log/cache-service/debug.log",
    "service.name": "cache-service",
    "dt.entity.host": "HOST-cache01",
    status: "OK",
  },
  {
    timestamp: ago(1 * h),
    loglevel: "ERROR",
    content: "Kafka consumer lag exceeded limit: topic=order-events, partition=2, lag=15820 messages",
    "log.source": "/var/log/kafka-consumer/app.log",
    "service.name": "order-consumer",
    "dt.entity.host": "HOST-kafka01",
    status: "LAG",
  },
  {
    timestamp: ago(1 * h + 10 * m),
    loglevel: "INFO",
    content: "Scheduled job completed: cleanup-expired-sessions removed 2340 records in 1.2s",
    "log.source": "/var/log/scheduler/jobs.log",
    "service.name": "job-scheduler",
    "dt.entity.host": "HOST-worker01",
    status: "OK",
  },
  {
    timestamp: ago(1 * h + 25 * m),
    loglevel: "WARN",
    content: "Rate limit approaching for external API: stripe.com — 85/100 requests used (window=60s)",
    "log.source": "/var/log/billing-service/app.log",
    "service.name": "billing-service",
    "dt.entity.host": "HOST-billing01",
    status: "RATE_LIMIT",
  },
  {
    timestamp: ago(1 * h + 45 * m),
    loglevel: "FATAL",
    content: "Out of memory: JVM heap space exhausted. Initiating emergency restart. Service: inventory-service",
    "log.source": "/var/log/inventory-service/app.log",
    "service.name": "inventory-service",
    "dt.entity.host": "HOST-inv02",
    status: "FATAL",
  },
  {
    timestamp: ago(2 * h),
    loglevel: "ERROR",
    content: "SSL certificate will expire in 7 days: *.internal.company.com (expires 2026-04-19)",
    "log.source": "/var/log/cert-monitor/alerts.log",
    "service.name": "cert-monitor",
    "dt.entity.host": "HOST-infra01",
    status: "CERT_EXPIRY",
  },
  {
    timestamp: ago(2 * h + 30 * m),
    loglevel: "INFO",
    content: "Feature flag 'new_checkout_flow' enabled for 25% of users (experiment: checkout-v2)",
    "log.source": "/var/log/feature-flags/events.log",
    "service.name": "feature-flag-service",
    "dt.entity.host": "HOST-ff01",
    status: "OK",
  },
  {
    timestamp: ago(3 * h),
    loglevel: "WARN",
    content: "Disk space on HOST-db-primary at 79% (used: 395GB / 500GB). Consider cleanup.",
    "log.source": "/var/log/system/diskmonitor.log",
    "service.name": "system-monitor",
    "dt.entity.host": "HOST-db-primary",
    status: "WARNING",
  },
  {
    timestamp: ago(3 * h + 15 * m),
    loglevel: "ERROR",
    content: "GraphQL resolver error: Cannot query field 'discountCode' on type 'CartItem'. Schema mismatch.",
    "log.source": "/var/log/graphql-api/errors.log",
    "service.name": "graphql-api",
    "dt.entity.host": "HOST-api02",
    status: "SCHEMA_ERROR",
  },
  {
    timestamp: ago(4 * h),
    loglevel: "DEBUG",
    content: "Incoming request: POST /api/v1/checkout — userId=usr_991kx, cartId=cart_77abc, items=4",
    "log.source": "/var/log/checkout-service/debug.log",
    "service.name": "checkout-service",
    "dt.entity.host": "HOST-checkout01",
    status: "OK",
  },
  {
    timestamp: ago(4 * h + 30 * m),
    loglevel: "INFO",
    content: "Autoscaling triggered: order-service scaled from 3 → 6 replicas (CPU: 78%)",
    "log.source": "k8s://namespace/production/hpa-events",
    "service.name": "order-service",
    "dt.entity.host": "HOST-k8s-node-01",
    status: "SCALING",
  },
  {
    timestamp: ago(5 * h),
    loglevel: "ERROR",
    content: "S3 upload failed: AccessDenied — bucket=user-avatars-prod, key=uploads/usr_44xyz/avatar.jpg",
    "log.source": "/var/log/media-service/app.log",
    "service.name": "media-service",
    "dt.entity.host": "HOST-media01",
    status: "ACCESS_DENIED",
  },
  {
    timestamp: ago(6 * h),
    loglevel: "INFO",
    content: "Daily metrics report generated: 42,810 orders processed, avg latency 210ms, error rate 0.3%",
    "log.source": "/var/log/analytics/daily-report.log",
    "service.name": "analytics-service",
    "dt.entity.host": "HOST-analytics01",
    status: "OK",
  },
];

export const MOCK_PROBLEMS: Problem[] = [
  {
    "event.id": "PROB-001",
    "event.name": "Payment service response time degradation",
    "event.status": "OPEN",
    "event.severity": "PERFORMANCE",
    "event.start": ago(45 * m),
    "event.end": null,
    affected_entity_ids: ["SERVICE-payment-service", "HOST-abc123"],
    maintenance_window: false,
    root_cause_entity_id: "SERVICE-payment-service",
  },
  {
    "event.id": "PROB-002",
    "event.name": "Database connection pool exhaustion on db-primary",
    "event.status": "OPEN",
    "event.severity": "AVAILABILITY",
    "event.start": ago(20 * m),
    "event.end": null,
    affected_entity_ids: ["HOST-db-primary", "SERVICE-order-service", "SERVICE-user-service"],
    maintenance_window: false,
    root_cause_entity_id: "HOST-db-primary",
  },
  {
    "event.id": "PROB-003",
    "event.name": "Order processor Lambda high error rate",
    "event.status": "OPEN",
    "event.severity": "ERROR",
    "event.start": ago(30 * m),
    "event.end": null,
    affected_entity_ids: ["SERVICE-order-processor-lambda"],
    maintenance_window: false,
    root_cause_entity_id: "SERVICE-order-processor-lambda",
  },
  {
    "event.id": "PROB-004",
    "event.name": "Inventory service JVM memory pressure",
    "event.status": "OPEN",
    "event.severity": "RESOURCE_CONTENTION",
    "event.start": ago(1 * h + 15 * m),
    "event.end": null,
    affected_entity_ids: ["SERVICE-inventory-service", "HOST-inv02"],
    maintenance_window: false,
    root_cause_entity_id: "HOST-inv02",
  },
  {
    "event.id": "PROB-005",
    "event.name": "Custom alert: API error rate threshold exceeded",
    "event.status": "OPEN",
    "event.severity": "CUSTOM_ALERT",
    "event.start": ago(10 * m),
    "event.end": null,
    affected_entity_ids: ["SERVICE-graphql-api"],
    maintenance_window: false,
    root_cause_entity_id: null,
  },
];

export const MOCK_DEPLOYMENTS: Deployment[] = [
  {
    "event.id": "DEP-001",
    "event.name": "payment-service v2.4.3 release",
    "event.type": "CUSTOM_DEPLOYMENT",
    "event.start": ago(15 * m),
    "event.provider": "kubernetes",
    affected_entity_name: "payment-service",
    "deployment.version": "2.4.3",
    "deployment.release_stage": "production",
  },
  {
    "event.id": "DEP-002",
    "event.name": "order-service canary rollout (10%)",
    "event.type": "DAVIS_DEPLOYMENT",
    "event.start": ago(45 * m),
    "event.provider": "kubernetes",
    affected_entity_name: "order-service",
    "deployment.version": "3.1.0",
    "deployment.release_stage": "canary",
  },
  {
    "event.id": "DEP-003",
    "event.name": "api-gateway hotfix deployment",
    "event.type": "CUSTOM_DEPLOYMENT",
    "event.start": ago(2 * h),
    "event.provider": "docker",
    affected_entity_name: "api-gateway",
    "deployment.version": "2.8.1",
    "deployment.release_stage": "production",
  },
  {
    "event.id": "DEP-004",
    "event.name": "user-service blue/green swap",
    "event.type": "CUSTOM_DEPLOYMENT",
    "event.start": ago(4 * h),
    "event.provider": "kubernetes",
    affected_entity_name: "user-service",
    "deployment.version": "1.9.5",
    "deployment.release_stage": "production",
  },
  {
    "event.id": "DEP-005",
    "event.name": "analytics-pipeline rebuild",
    "event.type": "DAVIS_DEPLOYMENT",
    "event.start": ago(6 * h),
    "event.provider": "batch-job",
    affected_entity_name: "analytics-service",
    "deployment.version": "0.5.2",
    "deployment.release_stage": "production",
  },
];

export const MOCK_SPANS: Span[] = [
  {
    trace_id: "trace-001-abc123def456",
    span_id: "span-payment-process",
    "span.name": "POST /api/payment/process",
    "service.name": "payment-service",
    "span.duration.us": 245000, // 245ms
    status_code: "ERROR",
    timestamp: ago(2 * m),
  },
  {
    trace_id: "trace-002-xyz789uvw012",
    span_id: "span-db-query",
    "span.name": "SELECT * FROM orders",
    "service.name": "order-service",
    "span.duration.us": 87000, // 87ms
    status_code: "OK",
    timestamp: ago(5 * m),
  },
  {
    trace_id: "trace-001-abc123def456",
    span_id: "span-db-checkout",
    "span.name": "db.execute{checkout_transaction}",
    "service.name": "checkout-service",
    "span.duration.us": 1250000, // 1.25s
    status_code: "ERROR",
    timestamp: ago(3 * m),
  },
  {
    trace_id: "trace-003-qwe456rty789",
    span_id: "span-api-call",
    "span.name": "GET /api/v2/products",
    "service.name": "api-gateway",
    "span.duration.us": 120000, // 120ms
    status_code: "OK",
    timestamp: ago(8 * m),
  },
  {
    trace_id: "trace-004-asd789fgh012",
    span_id: "span-cache-lookup",
    "span.name": "redis.get{user_profile}",
    "service.name": "cache-service",
    "span.duration.us": 5200, // 5.2ms
    status_code: "OK",
    timestamp: ago(12 * m),
  },
  {
    trace_id: "trace-005-jkl012mno345",
    span_id: "span-auth-verify",
    "span.name": "token.verify{jwt}",
    "service.name": "auth-service",
    "span.duration.us": 32000, // 32ms
    status_code: "OK",
    timestamp: ago(1 * m),
  },
  {
    trace_id: "trace-006-pqr345stu678",
    span_id: "span-kafka-publish",
    "span.name": "kafka.publish{order-events}",
    "service.name": "order-processor",
    "span.duration.us": 650000, // 650ms
    status_code: "ERROR",
    timestamp: ago(25 * m),
  },
  {
    trace_id: "trace-007-vwx678yza901",
    span_id: "span-graphql-resolve",
    "span.name": "GraphQL.resolveField{user}",
    "service.name": "graphql-api",
    "span.duration.us": 156000, // 156ms
    status_code: "OK",
    timestamp: ago(18 * m),
  },
];

// Mock Entities (Services, Hosts, Process Groups)
export const MOCK_ENTITIES: Entity[] = [
  {
    "entity.id": "SERVICE-payment-service",
    "entity.name": "payment-service",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "SERVICE-order-service",
    "entity.name": "order-service",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "SERVICE-user-service",
    "entity.name": "user-service",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "SERVICE-api-gateway",
    "entity.name": "api-gateway",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "SERVICE-auth-service",
    "entity.name": "auth-service",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "SERVICE-cache-service",
    "entity.name": "cache-service",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "SERVICE-billing-service",
    "entity.name": "billing-service",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "SERVICE-inventory-service",
    "entity.name": "inventory-service",
    "entity.type": "SERVICE",
  },
  {
    "entity.id": "HOST-abc123",
    "entity.name": "prod-api-01.internal.company.com",
    "entity.type": "HOST",
  },
  {
    "entity.id": "HOST-def456",
    "entity.name": "prod-db-primary.internal.company.com",
    "entity.type": "HOST",
  },
  {
    "entity.id": "HOST-ghi789",
    "entity.name": "prod-cache-01.internal.company.com",
    "entity.type": "HOST",
  },
  {
    "entity.id": "PG-payment-java",
    "entity.name": "payment-service-java-processes",
    "entity.type": "PROCESS_GROUP",
  },
  {
    "entity.id": "PG-order-nodejs",
    "entity.name": "order-service-nodejs-processes",
    "entity.type": "PROCESS_GROUP",
  },
  {
    "entity.id": "PG-user-python",
    "entity.name": "user-service-python-processes",
    "entity.type": "PROCESS_GROUP",
  },
];

// Mock Saved Queries
export const MOCK_SAVED_QUERIES: SavedQuery[] = [
  {
    id: "query-001",
    name: "Error logs last 24h",
    dql: 'fetch logs | filter loglevel == "ERROR" | sort timestamp desc | limit 100',
    timeframe: "24h",
    createdAt: ago(3 * d),
    isFavorite: true,
  },
  {
    id: "query-002",
    name: "Payment service latency",
    dql: 'fetch spans | filter service.name == "payment-service" | fields service.name, "span.duration.us", status_code | sort timestamp desc | limit 50',
    timeframe: "1h",
    createdAt: ago(5 * d),
    isFavorite: true,
  },
  {
    id: "query-003",
    name: "Database connection issues",
    dql: 'fetch logs | filter content contains "connection" and loglevel == "ERROR" | stats count() as error_count',
    timeframe: "4h",
    createdAt: ago(7 * d),
    isFavorite: false,
  },
  {
    id: "query-004",
    name: "Deployment timeline",
    dql: 'fetch events | filter event.type == "CUSTOM_DEPLOYMENT" or event.kind == "DAVIS_DEPLOYMENT" | sort event.start desc | limit 30',
    timeframe: "7d",
    createdAt: ago(2 * d),
    isFavorite: false,
  },
  {
    id: "query-005",
    name: "OOM errors across services",
    dql: 'fetch logs | filter content contains "Out of memory" or content contains "JVM heap space" | fields service.name, timestamp, content | sort timestamp desc',
    timeframe: "7d",
    createdAt: ago(10 * d),
    isFavorite: true,
  },
];

// Mock Workflow Executions
export const MOCK_WORKFLOW_EXECUTIONS: WorkflowExecution[] = [
  {
    id: "exec-001",
    workflowId: "wf-remediate-high-latency",
    status: "SUCCEEDED",
    startTime: ago(2 * h),
    endTime: ago(2 * h - 5 * m),
    durationMs: 300000,
    triggeredBy: "incident-142",
  },
  {
    id: "exec-002",
    workflowId: "wf-restart-service",
    status: "RUNNING",
    startTime: ago(5 * m),
    endTime: null,
    durationMs: null,
    triggeredBy: "manual",
  },
  {
    id: "exec-003",
    workflowId: "wf-notify-oncall",
    status: "FAILED",
    startTime: ago(1 * h),
    endTime: ago(1 * h - 2 * m),
    durationMs: 120000,
    triggeredBy: "problem-incident",
  },
  {
    id: "exec-004",
    workflowId: "wf-scaling-policy",
    status: "SUCCEEDED",
    startTime: ago(4 * h),
    endTime: ago(4 * h - 10 * m),
    durationMs: 600000,
    triggeredBy: "schedule",
  },
  {
    id: "exec-005",
    workflowId: "wf-remediate-high-latency",
    status: "SUCCEEDED",
    startTime: ago(24 * h),
    endTime: ago(24 * h - 3 * m),
    durationMs: 180000,
    triggeredBy: "incident-141",
  },
];

// Mock Execution Tasks
export const MOCK_EXECUTION_TASKS: ExecutionTask[] = [
  {
    id: "task-001",
    name: "Check service health",
    status: "SUCCEEDED",
    startTime: ago(2 * h),
    endTime: ago(2 * h - 30 * 1000),
    durationMs: 30000,
  },
  {
    id: "task-002",
    name: "Trigger restart",
    status: "SUCCEEDED",
    startTime: ago(2 * h - 30 * 1000),
    endTime: ago(2 * h - 60 * 1000),
    durationMs: 30000,
  },
  {
    id: "task-003",
    name: "Notify ops team",
    status: "FAILED",
    startTime: ago(1 * h),
    endTime: ago(1 * h - 10 * 1000),
    durationMs: 10000,
    errorMessage: "Slack webhook failed: 403 Forbidden",
  },
  {
    id: "task-004",
    name: "Wait for recovery",
    status: "RUNNING",
    startTime: ago(5 * m),
    endTime: null,
    durationMs: null,
  },
];

// Mock Workflows
export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: "wf-remediate-high-latency",
    name: "Remediate High Latency",
    description: "Automatically investigate and remediate high latency issues in payment service",
    owner: "platform-team",
    triggerType: "EVENT",
    enabled: true,
    createdAt: ago(30 * d),
    modifiedAt: ago(2 * d),
    lastExecutionStatus: "SUCCEEDED",
    lastExecutionTime: ago(2 * h),
    inputParametersSchema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service name" },
        threshold: { type: "number", description: "Latency threshold in ms" },
      },
      required: ["service"],
    },
    tags: ["latency", "remediation", "automatic"],
  },
  {
    id: "wf-restart-service",
    name: "Restart Service",
    description: "Manual workflow to restart a service",
    owner: "devops-team",
    triggerType: "MANUAL",
    enabled: true,
    createdAt: ago(45 * d),
    modifiedAt: ago(1 * d),
    lastExecutionStatus: "RUNNING",
    lastExecutionTime: ago(5 * m),
    inputParametersSchema: {
      type: "object",
      properties: {
        service: { type: "string" },
        gracefulShutdownSeconds: { type: "number", default: 30 },
      },
      required: ["service"],
    },
    tags: ["restart", "maintenance"],
  },
  {
    id: "wf-notify-oncall",
    name: "Notify On-call",
    description: "Send critical alerts to on-call engineer via Slack",
    owner: "platform-team",
    triggerType: "EVENT",
    enabled: true,
    createdAt: ago(60 * d),
    modifiedAt: ago(5 * d),
    lastExecutionStatus: "FAILED",
    lastExecutionTime: ago(1 * h),
    inputParametersSchema: {
      type: "object",
      properties: {
        severity: { type: "string", enum: ["CRITICAL", "HIGH", "MEDIUM"] },
        message: { type: "string" },
      },
      required: ["severity", "message"],
    },
    tags: ["notification", "alert"],
  },
  {
    id: "wf-scaling-policy",
    name: "Auto Scaling Policy",
    description: "Automatically scale services based on CPU and memory metrics",
    owner: "infrastructure-team",
    triggerType: "SCHEDULE",
    enabled: true,
    createdAt: ago(90 * d),
    modifiedAt: ago(10 * d),
    lastExecutionStatus: "SUCCEEDED",
    lastExecutionTime: ago(4 * h),
    inputParametersSchema: {},
    tags: ["scaling", "infrastructure"],
  },
  {
    id: "wf-backup-database",
    name: "Backup Database",
    description: "Daily database backup with verification",
    owner: "database-team",
    triggerType: "SCHEDULE",
    enabled: false,
    createdAt: ago(120 * d),
    modifiedAt: ago(20 * d),
    lastExecutionStatus: "SUCCEEDED",
    lastExecutionTime: ago(48 * h),
    inputParametersSchema: {},
    tags: ["backup", "database"],
  },
  {
    id: "wf-deploy-canary",
    name: "Deploy Canary",
    description: "Deploy new version to canary environment with metrics validation",
    owner: "platform-team",
    triggerType: "MANUAL",
    enabled: true,
    createdAt: ago(75 * d),
    modifiedAt: ago(3 * d),
    lastExecutionStatus: "SUCCEEDED",
    lastExecutionTime: ago(8 * h),
    inputParametersSchema: {
      type: "object",
      properties: {
        version: { type: "string" },
        service: { type: "string" },
        percentageTraffic: { type: "number", minimum: 1, maximum: 100 },
      },
      required: ["version", "service"],
    },
    tags: ["deployment", "canary"],
  },
  {
    id: "wf-daily-health-check",
    name: "Daily Health Check",
    description: "Run daily infrastructure health check",
    owner: "infrastructure-team",
    triggerType: "SCHEDULE",
    enabled: true,
    createdAt: ago(60 * d),
    modifiedAt: ago(7 * d),
    lastExecutionStatus: "SUCCEEDED",
    lastExecutionTime: ago(12 * h),
    inputParametersSchema: {},
    tags: ["health-check", "daily"],
  },
];

// Mock Settings Objects
export const MOCK_SETTINGS: SettingsObject[] = [
  {
    id: "alert-prod-critical",
    schemaId: "builtin:alerting.profile",
    schemaVersion: "1.0",
    objectId: "alert-prod-critical-001",
    displayName: "Alerting Profile - Production Critical",
    description: "Alert profile for critical production incidents",
    scope: "ENVIRONMENT",
    author: "alert-admin",
    createdAt: ago(90 * d),
    modifiedAt: ago(5 * d),
    isModified: false,
    value: {
      name: "Production Critical Alerts",
      mzId: null,
      filters: [
        {
          filterType: "SEVERITY",
          value: "CRITICAL",
        },
        {
          filterType: "ENTITY_TAG",
          value: "production",
        },
      ],
      notificationRules: [
        {
          type: "email",
          recipients: ["oncall@company.com"],
          delay: 0,
        },
        {
          type: "slack",
          channel: "#critical-alerts",
          delay: 5,
        },
      ],
    },
  },
  {
    id: "mz-payment",
    schemaId: "builtin:management-zones",
    schemaVersion: "1.0",
    objectId: "mz-payment-zone",
    displayName: "Payment Services Zone",
    description: "Management zone for all payment-related services",
    scope: "ENVIRONMENT",
    author: "platform-team",
    createdAt: ago(60 * d),
    modifiedAt: ago(10 * d),
    isModified: false,
    value: {
      name: "Payment Services Zone",
      rules: [
        {
          type: "SERVICE",
          condition: "service.name CONTAINS payment",
        },
        {
          type: "SERVICE",
          condition: "service.owner = payment-team",
        },
      ],
    },
  },
  {
    id: "autotag-env",
    schemaId: "builtin:tags.auto-tagging",
    schemaVersion: "1.0",
    objectId: "autotag-env-001",
    displayName: "Environment Auto-Tags",
    description: "Automatically tag entities by deployment environment",
    scope: "ENVIRONMENT",
    author: "devops-team",
    createdAt: ago(45 * d),
    modifiedAt: ago(3 * d),
    isModified: true,
    value: {
      rules: [
        {
          enabled: true,
          entityFilter: ["SERVICE"],
          matchType: "ALL",
          rules: [
            {
              attribute: "tag",
              operator: "contains",
              value: "prod",
            },
          ],
          tags: [
            {
              key: "environment",
              value: "production",
            },
          ],
        },
        {
          enabled: true,
          entityFilter: ["SERVICE"],
          matchType: "ALL",
          rules: [
            {
              attribute: "tag",
              operator: "contains",
              value: "staging",
            },
          ],
          tags: [
            {
              key: "environment",
              value: "staging",
            },
          ],
        },
      ],
    },
  },
  {
    id: "noti-slack",
    schemaId: "builtin:notification",
    schemaVersion: "1.0",
    objectId: "noti-slack-001",
    displayName: "Slack Integration",
    description: "Main Slack webhook for Dynatrace notifications",
    scope: "ENVIRONMENT",
    author: "platform-team",
    createdAt: ago(120 * d),
    modifiedAt: ago(30 * d),
    isModified: false,
    value: {
      name: "Slack Integration",
      type: "SLACK",
      webhookUrl: "https://hooks.slack.com/services/XXX/YYY/ZZZ",
      channels: ["#alerts", "#incidents", "#deployments"],
    },
  },
  {
    id: "own-platform",
    schemaId: "builtin:ownership.teams",
    schemaVersion: "1.0",
    objectId: "own-platform-team",
    displayName: "Platform Team Ownership",
    description: "Ownership mapping for platform services",
    scope: "ENVIRONMENT",
    author: "hr-admin",
    createdAt: ago(75 * d),
    modifiedAt: ago(8 * d),
    isModified: false,
    value: {
      team: "platform-team",
      services: ["api-gateway", "auth-service", "rate-limiter"],
      contacts: [
        {
          type: "email",
          value: "platform-team@company.com",
        },
        {
          type: "slack",
          value: "#platform-team",
        },
      ],
    },
  },
  {
    id: "reqattr-custom",
    schemaId: "builtin:service-api.request-attributes",
    schemaVersion: "1.0",
    objectId: "reqattr-custom-001",
    displayName: "Custom Request Attributes",
    description: "Extract custom attributes from request headers",
    scope: "ENTITY",
    author: "observability-team",
    createdAt: ago(30 * d),
    modifiedAt: ago(2 * d),
    isModified: false,
    value: {
      name: "Custom Request Attributes",
      attributes: [
        {
          name: "tenant-id",
          source: "header",
          headerName: "X-Tenant-ID",
          type: "string",
        },
        {
          name: "request-id",
          source: "header",
          headerName: "X-Request-ID",
          type: "string",
        },
        {
          name: "user-id",
          source: "parameter",
          parameterName: "userId",
          type: "long",
        },
      ],
    },
  },
];

/**
 * Mock metrics data for testing metrics explorer
 */
export const MOCK_METRICS: MetricData[] = [
  {
    metric: {
      metricId: "builtin:host.cpu.usage",
      displayName: "CPU Usage",
      unit: "%",
      description: "Host CPU usage percentage",
    },
    currentValue: 65.3,
    minValue: 42.1,
    maxValue: 89.7,
    avgValue: 62.4,
    lastUpdated: Date.now(),
    dataPoints: Array.from({ length: 60 }, (_, i) => ({
      timestamp: Date.now() - (60 - i) * 60000,
      value: 45 + Math.sin(i / 10) * 20 + Math.random() * 10,
    })),
  },
  {
    metric: {
      metricId: "builtin:host.mem.usage",
      displayName: "Memory Usage",
      unit: "%",
      description: "Host memory usage percentage",
    },
    currentValue: 72.1,
    minValue: 68.5,
    maxValue: 78.3,
    avgValue: 71.8,
    lastUpdated: Date.now(),
    dataPoints: Array.from({ length: 60 }, (_, i) => ({
      timestamp: Date.now() - (60 - i) * 60000,
      value: 70 + Math.sin(i / 15) * 5 + Math.random() * 3,
    })),
  },
  {
    metric: {
      metricId: "builtin:service.response.time",
      displayName: "Response Time",
      unit: "ms",
      description: "Average service response time",
    },
    currentValue: 245,
    minValue: 120,
    maxValue: 890,
    avgValue: 380,
    lastUpdated: Date.now(),
    dataPoints: Array.from({ length: 60 }, (_, i) => ({
      timestamp: Date.now() - (60 - i) * 60000,
      value: 300 + Math.sin(i / 8) * 150 + Math.random() * 100,
    })),
  },
  {
    metric: {
      metricId: "builtin:service.errors.rate",
      displayName: "Error Rate",
      unit: "%",
      description: "Service error rate",
    },
    currentValue: 1.2,
    minValue: 0.3,
    maxValue: 5.7,
    avgValue: 1.8,
    lastUpdated: Date.now(),
    dataPoints: Array.from({ length: 60 }, (_, i) => ({
      timestamp: Date.now() - (60 - i) * 60000,
      value: Math.max(0.1, 1 + Math.sin(i / 20) * 2 + Math.random() * 1.5),
    })),
  },
  {
    metric: {
      metricId: "builtin:service.throughput",
      displayName: "Throughput",
      unit: "requests/min",
      description: "Requests per minute",
    },
    currentValue: 5320,
    minValue: 3100,
    maxValue: 7800,
    avgValue: 5450,
    lastUpdated: Date.now(),
    dataPoints: Array.from({ length: 60 }, (_, i) => ({
      timestamp: Date.now() - (60 - i) * 60000,
      value: 5000 + Math.sin(i / 12) * 1500 + Math.random() * 800,
    })),
  },
];

/**
 * Mock synthetic monitors data for testing
 */
export const MOCK_SYNTHETICS: SyntheticMonitorData[] = [
  {
    monitor: {
      monitorId: "synthetic-http-001",
      name: "API Health Check",
      type: MonitorType.HTTP,
      url: "https://api.example.com/health",
      enabled: true,
      schedule: { interval: 5, timezone: "UTC" },
      locations: ["North America - US East", "Europe - Germany", "Asia - Singapore"],
      createdAt: Date.now() - 30 * d,
      modifiedAt: Date.now() - 2 * d,
      tags: { team: "platform", sla: "99.9" },
    },
    availability: 99.8,
    failureCount: 1,
    avgResponseTime: 245,
    lastExecution: {
      executionId: "exec-001",
      monitorId: "synthetic-http-001",
      timestamp: Date.now() - 5 * m,
      status: ExecutionStatus.OK,
      responseTime: 238,
      locationResults: [
        { location: "North America - US East", status: ExecutionStatus.OK, responseTime: 215, timestamp: Date.now() - 5 * m },
        { location: "Europe - Germany", status: ExecutionStatus.OK, responseTime: 245, timestamp: Date.now() - 5 * m },
        { location: "Asia - Singapore", status: ExecutionStatus.OK, responseTime: 275, timestamp: Date.now() - 5 * m },
      ],
    },
  },
  {
    monitor: {
      monitorId: "synthetic-http-002",
      name: "Payment Gateway",
      type: MonitorType.HTTP,
      url: "https://payments.example.com/status",
      enabled: true,
      schedule: { interval: 10, timezone: "UTC" },
      locations: ["North America - US East", "Europe - Germany"],
      createdAt: Date.now() - 60 * d,
      modifiedAt: Date.now() - 1 * d,
      tags: { team: "payments", sla: "99.95", critical: "true" },
    },
    availability: 100,
    failureCount: 0,
    avgResponseTime: 180,
    lastExecution: {
      executionId: "exec-002",
      monitorId: "synthetic-http-002",
      timestamp: Date.now() - 10 * m,
      status: ExecutionStatus.OK,
      responseTime: 175,
      locationResults: [
        { location: "North America - US East", status: ExecutionStatus.OK, responseTime: 165, timestamp: Date.now() - 10 * m },
        { location: "Europe - Germany", status: ExecutionStatus.OK, responseTime: 185, timestamp: Date.now() - 10 * m },
      ],
    },
  },
  {
    monitor: {
      monitorId: "synthetic-browser-001",
      name: "Customer Portal Login Flow",
      type: MonitorType.BROWSER,
      url: "https://portal.example.com/login",
      enabled: true,
      schedule: { interval: 15, timezone: "UTC" },
      locations: ["North America - US West", "Europe - UK"],
      createdAt: Date.now() - 45 * d,
      modifiedAt: Date.now() - 3 * h,
      tags: { team: "frontend", user_experience: "critical" },
    },
    availability: 95.2,
    failureCount: 2,
    avgResponseTime: 3200,
    lastExecution: {
      executionId: "exec-003",
      monitorId: "synthetic-browser-001",
      timestamp: Date.now() - 15 * m,
      status: ExecutionStatus.FAILED,
      responseTime: 5200,
      locationResults: [
        { location: "North America - US West", status: ExecutionStatus.OK, responseTime: 3100, timestamp: Date.now() - 15 * m },
        {
          location: "Europe - UK",
          status: ExecutionStatus.FAILED,
          errorMessage: "Timeout waiting for element #login-btn",
          timestamp: Date.now() - 15 * m,
        },
      ],
      errorMessage: "One or more locations failed",
    },
  },
  {
    monitor: {
      monitorId: "synthetic-http-003",
      name: "Search Service",
      type: MonitorType.HTTP,
      url: "https://search.example.com/api/search?q=test",
      enabled: false,
      schedule: { interval: 30, timezone: "UTC" },
      locations: ["North America - US East"],
      createdAt: Date.now() - 90 * d,
      modifiedAt: Date.now() - 14 * d,
      tags: { team: "search", status: "maintenance" },
    },
    availability: 0,
    failureCount: 0,
    lastExecution: undefined,
  },
];
