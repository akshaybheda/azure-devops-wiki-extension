import "./Hub.scss";
import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import {
  CommonServiceIds,
  getClient,
  ILocationService,
} from "azure-devops-extension-api";
import { Page } from "azure-devops-ui/Page";
import { showRootComponent } from "./Common";
import {
  NotificationRestClient,
  NotificationSubscription,
  SubscriptionFlags,
  SubscriptionQueryFlags,
} from "azure-devops-extension-api/Notification";
import { CoreRestClient } from "azure-devops-extension-api/Core";
import { WikiRestClient } from "azure-devops-extension-api/Wiki";
import { Card } from "azure-devops-ui/Card";
import { ISimpleTableCell, Table } from "azure-devops-ui/Table";
import { fixedColumns } from "./TableData";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { Button } from "azure-devops-ui/Button";
import { Spinner } from "azure-devops-ui/Spinner";
import {
  MessageCard,
  MessageCardSeverity,
} from "azure-devops-ui/MessageCard";

interface IWikiInfo {
  projectName: string;
  wikiName: string;
  pageId: number;
  path: string;
  gitItemPath: string;
  remoteUrl: string;
}

interface IWikiCache {
  timestamp: number;
  subscriptionCount: number;
  pages: IWikiInfo[];
}

export interface ITableDataItem extends ISimpleTableCell {
  name: string;
  url: string;
  project: string;
}

const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const PAGE_FETCH_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => worker()
    )
  );
  return results;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "An unexpected error occurred.");
}

function App() {
  const [wikiPages, setWikiPages] = React.useState<IWikiInfo[]>([]);
  const [subscriptionCount, setSubscriptionCount] = React.useState(0);
  const [user, setUser] = React.useState<ReturnType<typeof SDK.getUser> | null>(
    null
  );
  const [ready, setReady] = React.useState(false);
  const [initialDataReady, setInitialDataReady] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const initialDataReadyRef = React.useRef(false);
  const loadNotificationSentRef = React.useRef(false);

  const markInitialDataReady = () => {
    initialDataReadyRef.current = true;
    setInitialDataReady(true);
  };

  const reportLoadFailure = (error: unknown) => {
    const message = getErrorMessage(error);
    setErrorMessage(message);
    if (!loadNotificationSentRef.current && !initialDataReadyRef.current) {
      loadNotificationSentRef.current = true;
      SDK.notifyLoadFailed(
        error instanceof Error ? error : new Error(message)
      );
    }
  };

  React.useEffect(() => {
    if (initialDataReady && !loadNotificationSentRef.current) {
      loadNotificationSentRef.current = true;
      SDK.notifyLoadSucceeded();
    }
  }, [initialDataReady]);

  const cacheKey = (userId: string) => `wikiPages:v2:${userId}`;

  const loadFromLocalStorage = (userId: string): IWikiCache | null => {
    try {
      const serialized = window.localStorage.getItem(cacheKey(userId));
      if (!serialized) return null;

      const parsed = JSON.parse(serialized) as Partial<IWikiCache>;
      if (
        typeof parsed.timestamp !== "number" ||
        typeof parsed.subscriptionCount !== "number" ||
        !Array.isArray(parsed.pages)
      ) {
        return null;
      }
      return parsed as IWikiCache;
    } catch (error) {
      console.warn("Unable to read cached wiki pages:", error);
      return null;
    }
  };

  const saveToLocalStorage = (
    userId: string,
    count: number,
    pages: IWikiInfo[]
  ) => {
    try {
      const cache: IWikiCache = {
        timestamp: Date.now(),
        subscriptionCount: count,
        pages,
      };
      window.localStorage.setItem(cacheKey(userId), JSON.stringify(cache));
    } catch (error) {
      console.warn("Unable to save cached wiki pages:", error);
    }
  };

  const getWikiInformation = async (
    subscriptions: NotificationSubscription[]
  ): Promise<IWikiInfo[]> => {
    const artifactPages = subscriptions
      .map((subscription) => {
        const parts = (subscription.filter as { artifactId?: string })
          .artifactId?.split("/");
        if (!parts || parts.length !== 3) return null;

        const [projectId, wikiId, pageIdValue] = parts;
        const pageId = Number(pageIdValue);
        if (!projectId || !wikiId || !Number.isFinite(pageId)) return null;
        return { projectId, wikiId, pageId };
      })
      .filter(
        (
          item
        ): item is { projectId: string; wikiId: string; pageId: number } =>
          item !== null
      );

    const projectIds = Array.from(
      new Set(artifactPages.map((item) => item.projectId))
    );
    const coreClient = getClient(CoreRestClient);
    const wikiClient = getClient(WikiRestClient);
    const locationService = await SDK.getService<ILocationService>(
      CommonServiceIds.LocationService
    );
    // Collection URL of the ADO host (e.g. https://dev.azure.com/org/); the
    // iframe's own origin is the extension CDN, so it can't be used for links.
    const collectionUrl = (await locationService.getServiceLocation()).replace(
      /\/?$/,
      "/"
    );

    const projectEntries = await Promise.all(
      projectIds.map(async (projectId) => {
        try {
          const project = await coreClient.getProject(projectId);
          return [projectId, project?.name || projectId] as const;
        } catch (error) {
          console.warn(`Failed to fetch project ${projectId}:`, error);
          return [projectId, null] as const;
        }
      })
    );
    const projectNames = new Map<string, string | null>(projectEntries);

    const wikiEntries = await Promise.all(
      projectIds.map(async (projectId) => {
        try {
          const wikis = await wikiClient.getAllWikis(projectId);
          return [projectId, wikis] as const;
        } catch (error) {
          console.warn(`Failed to fetch wikis for project ${projectId}:`, error);
          return [projectId, null] as const;
        }
      })
    );
    const wikisByProject = new Map(wikiEntries);

    return mapWithConcurrency(
      artifactPages,
      PAGE_FETCH_CONCURRENCY,
      async ({ projectId, wikiId, pageId }) => {
        const projectName = projectNames.get(projectId);
        const projectWikis = wikisByProject.get(projectId);
        if (!projectName || !projectWikis) return null;

        const wiki = projectWikis.find(
          (item) => item.id === wikiId || item.name === wikiId
        );
        if (!wiki) return null;

        try {
          const page = await wikiClient.getPageData(
            projectId,
            wiki.name,
            pageId
          );
          return {
            projectName,
            wikiName: wiki.name,
            pageId: page.id,
            gitItemPath: page.path,
            path: page.path || "",
            remoteUrl: `${collectionUrl}${encodeURIComponent(
              projectName
            )}/_wiki/wikis/${encodeURIComponent(wiki.name)}/${page.id}`,
          };
        } catch (error) {
          console.warn(
            `Failed to fetch page ${pageId} in wiki ${wikiId}:`,
            error
          );
          return null;
        }
      }
    ).then((pages) => pages.filter((page): page is IWikiInfo => page !== null));
  };

  const fetchSubscriptions = async (
    currentUser: ReturnType<typeof SDK.getUser>
  ) => {
    setErrorMessage(null);
    setIsRefreshing(true);

    try {
      const notificationClient = getClient(NotificationRestClient);
      const result = await notificationClient.querySubscriptions({
        conditions: [
          {
            filter: {
              artifactType: "WikiPageId",
              type: "Artifact",
              artifactId: null,
            } as any,
            flags: SubscriptionFlags.None,
            scope: "",
            subscriberId: currentUser.id,
            subscriptionId: "",
          },
        ],
        queryFlags: SubscriptionQueryFlags.None,
      });
      const pages = await getWikiInformation(result);

      setSubscriptionCount(result.length);
      setWikiPages(pages);
      saveToLocalStorage(currentUser.id, result.length, pages);
      markInitialDataReady();
    } catch (error) {
      console.error("Error fetching wiki subscriptions:", error);
      reportLoadFailure(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    if (user) void fetchSubscriptions(user);
  };

  React.useEffect(() => {
    let active = true;

    const initialize = async () => {
      try {
        await SDK.init({ loaded: false });
        await SDK.ready();
        const currentUser = SDK.getUser();
        if (!active) return;

        setUser(currentUser);
        setReady(true);

        const cachedData = loadFromLocalStorage(currentUser.id);
        if (cachedData) {
          setWikiPages(cachedData.pages);
          setSubscriptionCount(cachedData.subscriptionCount);
          markInitialDataReady();

          if (Date.now() - cachedData.timestamp <= CACHE_MAX_AGE_MS) return;
        }

        await fetchSubscriptions(currentUser);
      } catch (error) {
        console.error("Error initializing the extension:", error);
        if (active) {
          setReady(true);
          reportLoadFailure(error);
        }
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  const tableItems = React.useMemo<ITableDataItem[]>(
    () =>
      wikiPages.map((page) => ({
        name: page.path,
        url: page.remoteUrl,
        project: page.projectName,
      })),
    [wikiPages]
  );
  const itemProvider = React.useMemo(
    () => new ArrayItemProvider<ITableDataItem>(tableItems),
    [tableItems]
  );

  if (!ready) {
    return (
      <div className="flex-row">
        {errorMessage ? (
          <MessageCard severity={MessageCardSeverity.Error}>
            <div>{errorMessage}</div>
            <Button text="Retry" onClick={() => window.location.reload()} />
          </MessageCard>
        ) : (
          <Spinner label="loading" />
        )}
      </div>
    );
  }

  return (
    <Page className="page-content flex-grow">
      <div title="Wiki Subscriptions">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h4>
            Hello {user?.name}
            {subscriptionCount > 0 && (
              <span> with {subscriptionCount} subscriptions</span>
            )}
          </h4>
          <Button text="Refresh" onClick={handleRefresh} disabled={isRefreshing} />
        </div>
        {errorMessage && (
          <MessageCard severity={MessageCardSeverity.Error}>
            <div>{errorMessage}</div>
            <Button
              text="Retry"
              onClick={user ? handleRefresh : () => window.location.reload()}
              disabled={isRefreshing}
            />
          </MessageCard>
        )}
        {isRefreshing && initialDataReady && <Spinner label="Refreshing" />}
        {initialDataReady && (
          <Card
            className="flex-grow bolt-table-card"
            contentProps={{ contentPadding: false }}
          >
            <Table
              ariaLabel="Basic Table"
              columns={fixedColumns}
              itemProvider={itemProvider}
              role="table"
              className="table-example"
              containerClassName="h-scroll-auto"
            />
          </Card>
        )}
        {!initialDataReady && !errorMessage && <Spinner label="loading" />}
      </div>
    </Page>
  );
}

showRootComponent(<App />);
