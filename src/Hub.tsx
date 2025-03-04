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
import {
  CoreRestClient,
  ProjectInfo,
  TeamProject,
} from "azure-devops-extension-api/Core";
import { Card } from "azure-devops-ui/Card";
import { ISimpleTableCell, Table } from "azure-devops-ui/Table";
import { fixedColumns } from "./TableData";
import { ArrayItemProvider } from "azure-devops-ui/Utilities/Provider";
import { WikiV2 } from "azure-devops-extension-api/Wiki";

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
  const newWikiPages: IWikiInfo[] = [];

  React.useEffect(() => {
    const getSubscriptions = async () => {
      const notificationClient: NotificationRestClient = getClient(
        NotificationRestClient
      );

      try {
        const subscriptions = await notificationClient.querySubscriptions({
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

        setSubscriptions(subscriptions);
        await getWikiInformation(subscriptions);
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
        for (const element of subscriptions) {
          const filter = element.filter.artifactId?.split("/");
          if (filter != null && filter.length === 3) {
            const [projectId, wikiId, pageId] = filter;

            // Fetch project info only if not cached
            let projectInfo = projectCache.get(projectId);

            if (!projectInfo) {
              projectInfo = await coreRestClient.getProject(projectId);
              projectCache.set(projectId, projectInfo);
            }

            // Fetch wiki info only if not cached
            let wiki = wikiCache.get(wikiId);
            if (!wiki) {
              wiki = await customClient.getWiki(wikiId, projectId);
              wikiCache.set(wikiId, wiki);
            }

            const page = await customClient.GetPageAsync(
              projectId,
              wiki.name,
              parseInt(pageId)
            );
            const wikiInfo: IWikiInfo = {
              projectName: projectInfo.name,
              wikiName: wiki.name,
              pageId: page.id,
              gitItemPath: page.gitItemPath,
              path: page.path,
              remoteUrl: page.remoteUrl,
            };
            newWikiPages.push(wikiInfo);
            // setWikiPages((prevWikiPages) => [...prevWikiPages, wikiInfo]);
          }
        }
        // Update state once after all processing
        setWikiPages((prevWikiPages) => [...prevWikiPages, ...newWikiPages]);
        setLoaded(true);
      } catch (error) {
        console.error("Error fetching wiki information:", error);
      }
    };

    SDK.init({
      loaded: false,
    });

    SDK.ready().then(() => {
      getSubscriptions();
    });
  }, []);

  React.useEffect(() => {
    if (loaded) {
      SDK.notifyLoadSucceeded();
    }
  }, [loaded]);

  function getLastSegment(path: string): string {
    return path.split("/").pop() || "";
  }

  function encodeQueryString(input: string): string {
    // Remove `.md` extension
    let path = input.replace(/\.md$/, "");

    // Replace hyphens (`-`) with encoded spaces (`%20`)
    path = path.replace(/-/g, "%20");

    // Ensure `-` is double-encoded (`%2D` → `%252D`)
    path = path.replace(/%2D/g, "%252D");

    return path;
  }

  function getWikiUrl(
    gitItemPath: string,
    wikiName: string,
    projectName: string
  ): string {
    const orgName = SDK.getHost().name;
    return (
      `https://dev.azure.com/${orgName}/${projectName}/_wiki/wikis/${wikiName}?pagePath=` +
      encodeQueryString(gitItemPath)
    );
  }

  return loaded ? (
    <Page className="page-content flex-grow">
      <div title="Wiki Subscriptions">
        <h4>
          Hello {SDK.getUser().name}{" "}
          {subscriptions.length > 0 && (
            <span> with {subscriptions.length} subscriptions</span>
          )}
        </h4>
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
    <Page>
      <h4>Loading...</h4>
    </Page>
  );
}

showRootComponent(<App />);
