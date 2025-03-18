import "./Hub.scss";
import * as React from "react";
import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { Page } from "azure-devops-ui/Page";
import { showRootComponent } from "./Common";
import { CustomWikiClient } from "./CustomWikiClient";
import {
  NotificationRestClient,
  NotificationSubscription,
  SubscriptionQueryFlags,
} from "azure-devops-extension-api/Notification";
import { CoreRestClient, TeamProject } from "azure-devops-extension-api/Core";
import { Card } from "azure-devops-ui/Card";
import { ISimpleTableCell, Table } from "azure-devops-ui/Table";
import { fixedColumns } from "./TableData";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { WikiV2 } from "azure-devops-extension-api/Wiki";
import { Button } from "azure-devops-ui/Button";

interface IWikiInfo {
  projectName: string;
  wikiName: string;
  pageId: number;
  path: string;
  gitItemPath: string;
  remoteUrl: string;
}

export interface ITableDataItem extends ISimpleTableCell {
  name: string;
  url: string;
  project: string;
}

function App() {
  const [subscriptions, setSubscriptions] = React.useState<
    NotificationSubscription[]
  >([]);
  const [wikiPages, setWikiPages] = React.useState<IWikiInfo[]>([]);
  const [loaded, setLoaded] = React.useState<boolean>(false);
  const projectCache = new Map<string, TeamProject>();
  const wikiCache = new Map<string, WikiV2>();

  React.useEffect(() => {
    async function initialize() {
      try {
        await SDK.init();
        await SDK.ready();
        const cachedData = loadFromLocalStorage();
        if (cachedData) {
          setWikiPages(cachedData);
          setLoaded(true);
        } else {
          fetchSubscriptions();
        }
      } catch (error) {
        console.error("Error initializing the extension:", error);
      }
    }
    initialize();
  }, []);

  React.useEffect(() => {
    if (loaded) {
      SDK.notifyLoadSucceeded();
    }
  }, [loaded]);

  const fetchSubscriptions = async () => {
    const notificationClient = getClient(NotificationRestClient);

    try {
      const result = await notificationClient.querySubscriptions({
        conditions: [
          {
            filter: {
              artifactType: "WikiPageId",
              type: "Artifact",
              artifactId: null,
            },
            flags: null,
            scope: "",
            subscriberId: SDK.getUser().id,
            subscriptionId: "",
          },
        ],
        queryFlags: SubscriptionQueryFlags.None,
      });

      setSubscriptions(result);
      await getWikiInformation(result);
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
    }
  };

  const getWikiInformation = async (
    subscriptions: NotificationSubscription[]
  ) => {
    const customClient = getClient(CustomWikiClient);
    const coreRestClient = getClient(CoreRestClient);

    try {
      const fetchTasks = subscriptions.map(async (element) => {
        const filter = element.filter.artifactId?.split("/");
        if (!filter || filter.length !== 3) return null;

        const [projectId, wikiId, pageId] = filter;

        try {
          // Fetch project info only if not cached
          const projectInfo =
            projectCache.get(projectId) ??
            (await coreRestClient.getProject(projectId).catch((error) => {
              console.error(`Failed to fetch project ${projectId}:`, error);
              return null;
            }));

          if (projectInfo) projectCache.set(projectId, projectInfo);

          // Fetch wiki info only if not cached
          const wiki =
            wikiCache.get(wikiId) ??
            (await customClient.getWiki(wikiId, projectId).catch((error) => {
              console.error(`Failed to fetch wiki ${wikiId}:`, error);
              return null;
            }));

          if (wiki) wikiCache.set(wikiId, wiki);

          if (!projectInfo || !wiki) return null; // Skip if either failed

          // Fetch the wiki page
          const page = await customClient
            .GetPageAsync(projectId, wiki.name, parseInt(pageId))
            .catch((error) => {
              console.error(
                `Failed to fetch page ${pageId} in wiki ${wikiId}:`,
                error
              );
              return null;
            });

          if (!page) return null;

          return {
            projectName: projectInfo.name,
            wikiName: wiki.name,
            pageId: page.id,
            gitItemPath: page.gitItemPath,
            path: page.path,
            remoteUrl: page.remoteUrl,
          };
        } catch (error) {
          console.error(`Unexpected error processing subscription:`, error);
          return null;
        }
      });

      const results = await Promise.all(fetchTasks);
      const validWikiPages = results.filter(
        (wikiInfo): wikiInfo is IWikiInfo => wikiInfo !== null
      );

      setWikiPages(validWikiPages);
      saveToLocalStorage(validWikiPages);
      setLoaded(true);
    } catch (error) {
      console.error("Error fetching wiki information:", error);
    }
  };

  const saveToLocalStorage = (data: IWikiInfo[]) => {
    localStorage.setItem("wikiPages", JSON.stringify(data));
  };

  const loadFromLocalStorage = (): IWikiInfo[] | null => {
    const data = localStorage.getItem("wikiPages");
    return data ? JSON.parse(data) : null;
  };

  const handleRefresh = () => {
    setLoaded(false);
    fetchSubscriptions();
  };

  return loaded ? (
    <Page className="page-content flex-grow">
      <div title="Wiki Subscriptions">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h4>
            Hello {SDK.getUser().name}{" "}
            {subscriptions.length > 0 && (
              <span> with {subscriptions.length} subscriptions</span>
            )}
          </h4>
          <Button text="Refresh" onClick={handleRefresh} />
        </div>
        <Card
          className="flex-grow bolt-table-card"
          contentProps={{ contentPadding: false }}
        >
          <Table
            ariaLabel="Basic Table"
            columns={fixedColumns}
            itemProvider={
              new ArrayItemProvider<ITableDataItem>(
                wikiPages.map((page) => ({
                  name: page.path,
                  url: page.remoteUrl,
                  project: page.projectName,
                }))
              )
            }
            role="table"
            className="table-example"
            containerClassName="h-scroll-auto"
          />
        </Card>
      </div>
    </Page>
  ) : (
    <Page className="page-content flex-grow">
      <h4>Loading...</h4>
    </Page>
  );
}

showRootComponent(<App />);
