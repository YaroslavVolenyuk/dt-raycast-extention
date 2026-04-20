# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Planned
- OAuth 2.0 client credentials authentication (replaces static API token)
- Multi-tenant support via Manage Tenants command
- Server-side DQL filtering by service name and log content
- Active Problems command with Davis AI severity levels
- Recent Deployments with incident correlation actions
- Find Entity command for services, hosts, and process groups
- Run DQL Query for arbitrary Grail queries
- Saved DQL Queries library
- Menu Bar Problems counter with 5-minute auto-refresh
- Log detail view with JSON pretty-print and stack trace formatting
- Related logs navigation (by trace_id, service ±5 min)
- GitHub Actions CI pipeline (lint + build + test)

## [Initial Version] - {PR_MERGE_DATE}

### Added
- Search Logs command with DQL query builder
- Log detail view with metadata sidebar
- Mock data mode for development
- Persistent timeframe and service filter preferences
- Client-side service/app filter dropdown
- Deep-links to Dynatrace Logs UI and Distributed Tracing Explorer
- DQL filter copy action in log detail view
