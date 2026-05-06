/**
 * Performance Alerts Service
 *
 * Monitors performance metrics and triggers alerts when thresholds are exceeded.
 * Supports multiple alert channels: console, email, Slack, webhook.
 *
 * Usage:
 *   import { performanceAlerts, AlertSeverity } from '@/lib/alerts';
 *
 *   // Initialize with alert rules
 *   performanceAlerts.addRule({
 *     metric: 'api_latency',
 *     operator: '>',
 *     threshold: 1000,
 *     severity: 'warning',
 *     cooldown: 300000,
 *   });
 *
 *   // Start monitoring
 *   performanceAlerts.start();
 *
 *   // Subscribe to alerts
 *   performanceAlerts.on('alert', (alert) => {
 *     console.log('Alert fired:', alert);
 *   });
 */

import { performanceMonitor } from './monitoring';

// ============================================================================
// TYPES
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type MetricName = 
  | 'api_latency_avg'
  | 'api_latency_p95'
  | 'api_latency_p99'
  | 'api_error_rate'
  | 'api_success_rate'
  | 'db_duration_avg'
  | 'db_duration_p95'
  | 'db_error_rate'
  | 'error_count';

export type AlertOperator = '<' | '>' | '<=' | '>=' | '===' | '!==';

export interface AlertRule {
  /** Unique identifier for this rule */
  id?: string;

  /** Metric to monitor */
  metric: MetricName;

  /** Operator for comparison */
  operator: AlertOperator;

  /** Threshold value */
  threshold: number;

  /** Alert severity level */
  severity: AlertSeverity;

  /** Minimum time between alerts (milliseconds) */
  cooldown?: number;

  /** Enable/disable this rule */
  enabled?: boolean;

  /** Custom message template */
  messageTemplate?: string;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  metric: MetricName;
  currentValue: number;
  threshold: number;
  severity: AlertSeverity;
  timestamp: Date;
  message: string;
}

export interface AlertChannel {
  send(alert: Alert): Promise<void>;
}

// ============================================================================
// ALERT CHANNELS
// ============================================================================

/**
 * Console alert channel
 */
class ConsoleAlertChannel implements AlertChannel {
  async send(alert: Alert): Promise<void> {
    const colors = {
      info: '\x1b[36m',      // Cyan
      warning: '\x1b[33m',   // Yellow
      error: '\x1b[31m',     // Red
      critical: '\x1b[35m',  // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[alert.severity];

    console.warn(
      `${color}[${alert.severity.toUpperCase()}]${reset} ${alert.message}`,
      {
        metric: alert.metric,
        currentValue: alert.currentValue,
        threshold: alert.threshold,
        timestamp: alert.timestamp.toISOString(),
      }
    );
  }
}

/**
 * Slack alert channel
 */
class SlackAlertChannel implements AlertChannel {
  constructor(private webhookUrl: string) {}

  async send(alert: Alert): Promise<void> {
    try {
      const colors = {
        info: '#36a64f',
        warning: '#ff9800',
        error: '#f44336',
        critical: '#9c27b0',
      };

      const payload = {
        attachments: [
          {
            color: colors[alert.severity],
            title: `${alert.severity.toUpperCase()}: ${alert.metric}`,
            text: alert.message,
            fields: [
              {
                title: 'Current Value',
                value: String(alert.currentValue),
                short: true,
              },
              {
                title: 'Threshold',
                value: String(alert.threshold),
                short: true,
              },
              {
                title: 'Time',
                value: alert.timestamp.toISOString(),
                short: false,
              },
            ],
          },
        ],
      };

      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }
}

/**
 * Email alert channel (via Supabase functions or external service)
 */
class EmailAlertChannel implements AlertChannel {
  constructor(
    private to: string,
    private from: string = 'alerts@social-spark.app'
  ) {}

  async send(alert: Alert): Promise<void> {
    try {
      // In production, this would call a Supabase function or email service
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: this.to,
          from: this.from,
          subject: `[${alert.severity.toUpperCase()}] Performance Alert: ${alert.metric}`,
          html: this.buildEmailHtml(alert),
        }),
      });
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  private buildEmailHtml(alert: Alert): string {
    return `
      <h2>${alert.severity.toUpperCase()}: ${alert.metric}</h2>
      <p>${alert.message}</p>
      <table>
        <tr>
          <td><strong>Current Value:</strong></td>
          <td>${alert.currentValue}</td>
        </tr>
        <tr>
          <td><strong>Threshold:</strong></td>
          <td>${alert.threshold}</td>
        </tr>
        <tr>
          <td><strong>Time:</strong></td>
          <td>${alert.timestamp.toISOString()}</td>
        </tr>
      </table>
    `;
  }
}

/**
 * Generic webhook alert channel
 */
class WebhookAlertChannel implements AlertChannel {
  constructor(private webhookUrl: string) {}

  async send(alert: Alert): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: {
            id: alert.id,
            metric: alert.metric,
            severity: alert.severity,
            currentValue: alert.currentValue,
            threshold: alert.threshold,
            message: alert.message,
            timestamp: alert.timestamp.toISOString(),
          },
        }),
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }
}

// ============================================================================
// ALERT SERVICE
// ============================================================================

class PerformanceAlertService {
  private rules: Map<string, AlertRule> = new Map();
  private channels: AlertChannel[] = [];
  private lastAlertTimes: Map<string, number> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private listeners: Map<string, ((alert: Alert) => void)[]> = new Map();

  constructor() {
    this.channels.push(new ConsoleAlertChannel());
  }

  /**
   * Add alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.push(channel);
  }

  /**
   * Add Slack webhook
   */
  addSlackWebhook(webhookUrl: string): void {
    this.addChannel(new SlackAlertChannel(webhookUrl));
  }

  /**
   * Add email alerts
   */
  addEmailAlerts(to: string, from?: string): void {
    this.addChannel(new EmailAlertChannel(to, from));
  }

  /**
   * Add custom webhook
   */
  addWebhook(webhookUrl: string): void {
    this.addChannel(new WebhookAlertChannel(webhookUrl));
  }

  /**
   * Add alert rule
   */
  addRule(rule: AlertRule): string {
    const id = rule.id || `alert_${Date.now()}_${Math.random()}`;
    this.rules.set(id, { ...rule, id, enabled: rule.enabled !== false });
    return id;
  }

  /**
   * Remove alert rule
   */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Update alert rule
   */
  updateRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(id);
    if (!rule) return false;
    this.rules.set(id, { ...rule, ...updates });
    return true;
  }

  /**
   * Get all rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Start monitoring
   */
  start(intervalMs: number = 10000): void {
    if (this.monitoringInterval) {
      return;
    }

    console.log('Starting performance monitoring with alerts...');

    this.monitoringInterval = setInterval(() => {
      this.checkMetrics();
    }, intervalMs);

    // Check immediately
    this.checkMetrics();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Performance monitoring stopped');
    }
  }

  /**
   * Check metrics against rules
   */
  private checkMetrics(): void {
    const metrics = performanceMonitor.getMetrics();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      let currentValue = 0;

      // Extract metric value
      switch (rule.metric) {
        case 'api_latency_avg':
          currentValue = metrics.api.avgLatency;
          break;
        case 'api_latency_p95':
          currentValue = metrics.api.p95Latency;
          break;
        case 'api_latency_p99':
          currentValue = metrics.api.p99Latency;
          break;
        case 'api_error_rate':
          currentValue = metrics.api.errorRate;
          break;
        case 'api_success_rate':
          currentValue = metrics.api.successRate;
          break;
        case 'db_duration_avg':
          currentValue = metrics.database.avgDuration;
          break;
        case 'db_duration_p95':
          currentValue = metrics.database.p95Duration;
          break;
        case 'db_error_rate':
          currentValue = metrics.database.errorRate;
          break;
        case 'error_count':
          currentValue = metrics.errors.total;
          break;
      }

      // Check if threshold is breached
      if (this.isThresholdBreached(currentValue, rule.operator, rule.threshold)) {
        this.fireAlert(rule, currentValue);
      }
    }
  }

  /**
   * Check if threshold is breached
   */
  private isThresholdBreached(
    value: number,
    operator: AlertOperator,
    threshold: number
  ): boolean {
    switch (operator) {
      case '<':
        return value < threshold;
      case '>':
        return value > threshold;
      case '<=':
        return value <= threshold;
      case '>=':
        return value >= threshold;
      case '===':
        return value === threshold;
      case '!==':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Fire alert
   */
  private async fireAlert(rule: AlertRule, currentValue: number): Promise<void> {
    const ruleId = rule.id || 'unknown';

    // Check cooldown
    const lastAlert = this.lastAlertTimes.get(ruleId);
    if (lastAlert && Date.now() - lastAlert < (rule.cooldown || 0)) {
      return;
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random()}`,
      rule,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      severity: rule.severity,
      timestamp: new Date(),
      message:
        rule.messageTemplate ||
        `${rule.metric} is ${currentValue} (threshold: ${rule.threshold})`,
    };

    this.lastAlertTimes.set(ruleId, Date.now());

    // Send to all channels
    for (const channel of this.channels) {
      try {
        await channel.send(alert);
      } catch (error) {
        console.error('Error sending alert:', error);
      }
    }

    // Emit event
    this.emit('alert', alert);
  }

  /**
   * Event emitter methods
   */
  on(event: string, listener: (alert: Alert) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: (alert: Alert) => void): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    const index = handlers.indexOf(listener);
    if (index > -1) handlers.splice(index, 1);
  }

  private emit(event: string, alert: Alert): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach(handler => handler(alert));
  }
}

// ============================================================================
// PREDEFINED ALERT RULES
// ============================================================================

export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    metric: 'api_latency_p95',
    operator: '>',
    threshold: 1000,
    severity: 'warning',
    cooldown: 300000,
    messageTemplate: 'API P95 latency exceeds 1000ms',
  },
  {
    metric: 'api_latency_p95',
    operator: '>',
    threshold: 2000,
    severity: 'error',
    cooldown: 600000,
    messageTemplate: 'API P95 latency exceeds 2000ms - CRITICAL',
  },
  {
    metric: 'api_error_rate',
    operator: '>',
    threshold: 5,
    severity: 'warning',
    cooldown: 300000,
    messageTemplate: 'API error rate exceeds 5%',
  },
  {
    metric: 'api_error_rate',
    operator: '>',
    threshold: 10,
    severity: 'error',
    cooldown: 600000,
    messageTemplate: 'API error rate exceeds 10% - CRITICAL',
  },
  {
    metric: 'db_duration_p95',
    operator: '>',
    threshold: 500,
    severity: 'warning',
    cooldown: 300000,
    messageTemplate: 'Database P95 query time exceeds 500ms',
  },
  {
    metric: 'db_error_rate',
    operator: '>',
    threshold: 2,
    severity: 'error',
    cooldown: 600000,
    messageTemplate: 'Database error rate exceeds 2%',
  },
  {
    metric: 'error_count',
    operator: '>',
    threshold: 50,
    severity: 'warning',
    cooldown: 300000,
    messageTemplate: 'Total error count exceeds 50 in last hour',
  },
];

// ============================================================================
// EXPORTS
// ============================================================================

export type { AlertRule, Alert, AlertChannel };
export const performanceAlerts = new PerformanceAlertService();
