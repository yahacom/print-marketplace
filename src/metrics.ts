import type { FastifyInstance } from "fastify";

// Upper bounds in seconds. 10 s is the PRD §6 p95 latency target, so it is an
// explicit boundary; the +Inf bucket is emitted separately.
const BUCKET_UPPER_BOUNDS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30];

const METRIC_NAME = "http_request_duration_seconds";
const UNMATCHED_ROUTE = "unmatched";

type Series = { labels: string; bucketCounts: number[]; sum: number; count: number };

// Hand-rolled Prometheus histogram (text format 0.0.4) to avoid a dependency for
// a single metric. Labels use the route *pattern*, never the raw url, so
// cardinality stays bounded and no user-controlled value reaches the output.
export function createRequestDurationHistogram() {
  const series = new Map<string, Series>();

  function observe(
    labels: { method: string; route: string; statusCode: number },
    seconds: number,
  ): void {
    const key = `method="${labels.method}",route="${labels.route}",status_code="${labels.statusCode}"`;
    let entry = series.get(key);
    if (!entry) {
      entry = {
        labels: key,
        bucketCounts: BUCKET_UPPER_BOUNDS_SECONDS.map(() => 0),
        sum: 0,
        count: 0,
      };
      series.set(key, entry);
    }
    BUCKET_UPPER_BOUNDS_SECONDS.forEach((bound, i) => {
      if (seconds <= bound) entry.bucketCounts[i]!++;
    });
    entry.sum += seconds;
    entry.count++;
  }

  function render(): string {
    const lines = [
      `# HELP ${METRIC_NAME} HTTP request duration in seconds.`,
      `# TYPE ${METRIC_NAME} histogram`,
    ];
    for (const { labels, bucketCounts, sum, count } of series.values()) {
      BUCKET_UPPER_BOUNDS_SECONDS.forEach((bound, i) => {
        lines.push(`${METRIC_NAME}_bucket{${labels},le="${bound}"} ${bucketCounts[i]}`);
      });
      lines.push(`${METRIC_NAME}_bucket{${labels},le="+Inf"} ${count}`);
      lines.push(`${METRIC_NAME}_sum{${labels}} ${sum}`);
      lines.push(`${METRIC_NAME}_count{${labels}} ${count}`);
    }
    return lines.join("\n") + "\n";
  }

  return { observe, render };
}

// quote-engine metrics (SAD §7): slice duration histogram, slicer queue depth
// gauge, slicer exit-code counter. Same hand-rolled text format as above. Label
// values are bounded (an exit code or "none"), never user-controlled.
const QUOTE_BUCKET_UPPER_BOUNDS_SECONDS = [1, 2.5, 5, 10, 20, 30, 45, 60];
const SLICE_DURATION_METRIC = "quote_slice_duration_seconds";
const QUEUE_DEPTH_METRIC = "quote_slicer_queue_depth";
const EXIT_CODE_METRIC = "quote_slicer_exit_code";

export function createQuoteMetrics() {
  const durationBuckets = QUOTE_BUCKET_UPPER_BOUNDS_SECONDS.map(() => 0);
  let durationSum = 0;
  let durationCount = 0;
  const exitCodes = new Map<string, number>();
  let queueDepth: () => number = () => 0;

  // Time from enqueue to slicer result (queue wait + slice), per request.
  function observeSliceDuration(seconds: number): void {
    QUOTE_BUCKET_UPPER_BOUNDS_SECONDS.forEach((bound, i) => {
      if (seconds <= bound) durationBuckets[i]!++;
    });
    durationSum += seconds;
    durationCount++;
  }

  // `null` (killed by a signal, or the binary could not start) is labelled "none".
  function countExitCode(exitCode: number | null): void {
    const code = exitCode === null ? "none" : String(exitCode);
    exitCodes.set(code, (exitCodes.get(code) ?? 0) + 1);
  }

  // Read at render time so a scrape sees the live depth, not a snapshot.
  function setQueueDepthSource(source: () => number): void {
    queueDepth = source;
  }

  function render(): string {
    const lines = [
      `# HELP ${SLICE_DURATION_METRIC} Time from enqueue to slicer result per quote request, in seconds.`,
      `# TYPE ${SLICE_DURATION_METRIC} histogram`,
    ];
    QUOTE_BUCKET_UPPER_BOUNDS_SECONDS.forEach((bound, i) => {
      lines.push(`${SLICE_DURATION_METRIC}_bucket{le="${bound}"} ${durationBuckets[i]}`);
    });
    lines.push(`${SLICE_DURATION_METRIC}_bucket{le="+Inf"} ${durationCount}`);
    lines.push(`${SLICE_DURATION_METRIC}_sum ${durationSum}`);
    lines.push(`${SLICE_DURATION_METRIC}_count ${durationCount}`);

    lines.push(
      `# HELP ${QUEUE_DEPTH_METRIC} Quote requests waiting for the slicer.`,
      `# TYPE ${QUEUE_DEPTH_METRIC} gauge`,
      `${QUEUE_DEPTH_METRIC} ${queueDepth()}`,
      `# HELP ${EXIT_CODE_METRIC} PrusaSlicer process exits by exit code.`,
      `# TYPE ${EXIT_CODE_METRIC} counter`,
    );
    for (const [code, count] of exitCodes) {
      lines.push(`${EXIT_CODE_METRIC}{code="${code}"} ${count}`);
    }
    return lines.join("\n") + "\n";
  }

  return { observeSliceDuration, countExitCode, setQueueDepthSource, render };
}

// Process-wide instance the quote-engine modules report into.
export const quoteMetrics = createQuoteMetrics();

// Per-request latency metric and alert source (SAD §7 Monitoring), exposed for
// scraping at GET /metrics. It carries only route/method/status/duration, but it
// is served on the app port: restrict access at the firewall/reverse proxy.
export function registerMetrics(app: FastifyInstance): void {
  const histogram = createRequestDurationHistogram();

  app.addHook("onResponse", async (request, reply) => {
    histogram.observe(
      {
        method: request.method,
        route: request.routeOptions.url ?? UNMATCHED_ROUTE,
        statusCode: reply.statusCode,
      },
      reply.elapsedTime / 1000,
    );
  });

  app.get("/metrics", async (_request, reply) =>
    reply
      .header("content-type", "text/plain; version=0.0.4; charset=utf-8")
      .send(histogram.render() + quoteMetrics.render()),
  );
}
