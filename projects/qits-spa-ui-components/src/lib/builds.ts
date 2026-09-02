import { HttpClient } from '@angular/common/http';
import {
  DestroyRef,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';

/** A build under way. The one status the panel draws differently, because it is the one moving. */
export const QITS_BUILD_RUNNING = 'RUNNING';

/**
 * One pending build, as the chrome needs it: what is being built, from where, and how far it has
 * got. The shape is copied from qits-ci rather than shared — this library depends on no qits module
 * — and only the fields a header affordance can show are read.
 */
export interface QitsBuild {
  readonly id: string;
  readonly repoName: string;
  readonly branch: string;
  /**
   * `RUNNING` for a build under way, `QUEUED` for one waiting for a worker — the whole vocabulary
   * of the active listing, since a run in any other state has left it. Carried through as the
   * service said it and upper-cased, never narrowed to those two: a status this library does not
   * know is still a pending build, and dropping it would under-report the queue.
   */
  readonly status: string;
  /** The pipeline file, as the run names it — `.config/qits/ci-post-receive.yml`. */
  readonly configPath: string;
  readonly commitSha?: string;
}

/** The body qits-ci answers the active listing with. Every field optional: this is another service. */
export interface QitsBuildRuns {
  readonly runs?: readonly {
    readonly id?: string;
    readonly repoName?: string;
    readonly branch?: string;
    readonly status?: string;
    readonly configPath?: string;
    readonly commitSha?: string;
  }[];
}

/**
 * Where `QitsMainLayout` gets the builds its lightning bolt lists. The same three states the other
 * reads have — nothing yet, an answer, given up — plus the one thing that makes this read different:
 * it happens only while somebody is looking at it.
 *
 * `watch(true)` is what the panel says when it opens: ask now, and keep asking. `watch(false)` when
 * it closes: stop, and forget. A closed panel costs nothing, which is what lets a header affordance
 * poll at all.
 */
export interface QitsBuildsSource {
  readonly runs: Signal<readonly QitsBuild[] | undefined>;
  readonly failed: Signal<boolean>;
  watch(watching: boolean): void;
}

/** The pending builds, behind a token so a literal can stand in for the read. */
export const QITS_BUILDS = new InjectionToken<QitsBuildsSource>('QITS_BUILDS');

/**
 * Where the active runs are asked for — a **same-origin path**, like the chrome's other reads and
 * for the same reason: the edge routes `/ci` on every vhost, so the browser's own session reaches
 * qits-ci with no machine token, no CORS pre-flight and no origin compiled in here. An absolute URL
 * would name a host this library cannot know and would need a credential of its own.
 */
export const QITS_BUILDS_URL = '/ci/api/runs/active';

/** How often the panel asks again while it is open. Short, because a build moves in seconds. */
export const QITS_BUILDS_INTERVAL_MS = 5000;

/** The pipeline file's name — `.config/qits/ci-post-receive.yml` is one file, not a path to read. */
export function buildConfigName(configPath: string | undefined): string {
  const trimmed = (configPath ?? '').replace(/\/+$/, '');
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

/** A row with neither an id nor a repository is not something the panel can draw a line for. */
function toBuild(row: NonNullable<QitsBuildRuns['runs']>[number]): QitsBuild | undefined {
  if (!row?.id || !row.repoName) return undefined;
  return {
    id: row.id,
    repoName: row.repoName,
    branch: row.branch ?? '',
    status: (row.status ?? '').toUpperCase(),
    configPath: row.configPath ?? '',
    commitSha: row.commitSha || undefined,
  };
}

/** The rows of an answer, in the order qits-ci listed them. */
export function toBuilds(body: QitsBuildRuns | null | undefined): readonly QitsBuild[] {
  return (body?.runs ?? [])
    .map((row) => toBuild(row ?? {}))
    .filter((build): build is QitsBuild => build !== undefined);
}

/**
 * The active runs as qits-ci sees them: one request when the panel opens, another every few seconds
 * while it stays open, and nothing at all while it is closed.
 *
 * <p>Closing <b>forgets</b> the answer as well as stopping the timer. A panel reopened an hour later
 * would otherwise paint the builds of an hour ago as though they were now, and a stale queue is a
 * worse answer than a pending one that resolves in a moment.
 *
 * <p>Deliberately no rxjs import, for the reason `HttpNavigationSource` gives: `subscribe()`'s
 * return value is used, never named, so this package keeps its three peer dependencies.
 */
class HttpBuildsSource implements QitsBuildsSource {
  private readonly answered = signal<readonly QitsBuild[] | undefined>(undefined);
  private readonly gaveUp = signal(false);

  readonly runs: Signal<readonly QitsBuild[] | undefined> = this.answered.asReadonly();
  readonly failed: Signal<boolean> = this.gaveUp.asReadonly();

  private readonly http = inject(HttpClient);
  // A cancel function rather than a `Subscription`: naming that type would import rxjs.
  private cancel: (() => void) | undefined = undefined;
  private timer: ReturnType<typeof setInterval> | undefined = undefined;

  constructor(
    private readonly url: string,
    private readonly intervalMs: number,
  ) {
    inject(DestroyRef).onDestroy(() => this.watch(false));
  }

  watch(watching: boolean): void {
    // Idempotent: the layout says "open" on every toggle, and a second one must not double the poll.
    if (watching === (this.timer !== undefined)) return;
    if (!watching) {
      clearInterval(this.timer);
      this.timer = undefined;
      this.cancel?.();
      this.cancel = undefined;
      this.answered.set(undefined);
      this.gaveUp.set(false);
      return;
    }
    this.timer = setInterval(() => this.read(), this.intervalMs);
    this.read();
  }

  /**
   * One read. A refresh that fails leaves the failure on screen rather than the rows it had — the
   * queue it last saw is not evidence of the queue now — and a read still in flight when the next
   * tick comes is dropped, because its answer is already the older of the two.
   */
  private read(): void {
    this.cancel?.();
    const subscription = this.http.get<QitsBuildRuns>(this.url).subscribe({
      next: (body) => {
        this.answered.set(toBuilds(body));
        this.gaveUp.set(false);
      },
      // A listing that could not be fetched is not a failed application. The panel says one quiet
      // line and every page around it renders exactly as it did — which is the whole point on a
      // host where `/ci` is not routed at all.
      error: () => {
        this.answered.set([]);
        this.gaveUp.set(true);
      },
    });
    this.cancel = () => subscription.unsubscribe();
  }
}

/**
 * Put the pending-builds bolt in the chrome's top bar, filled from qits-ci.
 *
 * **Requires `provideHttpClient()`** in the same application config. Nothing is requested until a
 * reader opens the panel, and nothing while it is closed — so an application that provides this on a
 * host where `/ci` is unreachable pays one failed request per reader who asks, and shows them a line
 * saying so.
 *
 * Providing it is what puts the bolt there: an application that provides nothing has no bolt, in the
 * same way it has no picker. Pass `url` to point at something other than `/ci/api/runs/active` — a
 * fixture, a dev proxy prefix — and `intervalMs` to poll at another rate.
 */
export function provideQitsBuilds(options?: {
  readonly url?: string;
  readonly intervalMs?: number;
}): EnvironmentProviders {
  const url = options?.url ?? QITS_BUILDS_URL;
  const intervalMs = options?.intervalMs ?? QITS_BUILDS_INTERVAL_MS;
  return makeEnvironmentProviders([
    { provide: QITS_BUILDS, useFactory: () => new HttpBuildsSource(url, intervalMs) },
  ]);
}

/**
 * The same contract answered from a literal: for specs, for stories, and for an app served without
 * the platform in front of it. Nothing is fetched and nothing is polled, so `watch()` is a no-op
 * and there is no request to flush.
 */
export function provideQitsBuildList(
  runs: readonly QitsBuild[] | undefined,
  options?: { readonly failed?: boolean },
): EnvironmentProviders {
  const source: QitsBuildsSource = {
    runs: signal<readonly QitsBuild[] | undefined>(runs),
    failed: signal(options?.failed ?? false),
    watch: () => undefined,
  };
  return makeEnvironmentProviders([{ provide: QITS_BUILDS, useValue: source }]);
}
