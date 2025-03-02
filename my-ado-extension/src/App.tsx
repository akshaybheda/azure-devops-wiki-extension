import { useEffect, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import "./App.css";
import { getClient } from "azure-devops-extension-api/Common";
import {
  NotificationRestClient,
  NotificationSubscription,
  SubscriptionQueryFlags,
} from "azure-devops-extension-api/Notification";
import { CustomWikiClient } from "./CustomWikiClient";
import { CoreRestClient } from "azure-devops-extension-api/Core";

export interface IWikiInfo {
  projectName: string;
  wikiName: string;
  pageId: number;
  path: string;
  gitItemPath: string;
}

function App() {
  const [currUserId, setCurrUserId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<
    NotificationSubscription[]
  >([]);
  const [wikiPages, setWikiPages] = useState<IWikiInfo[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
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
            const projectId = filter[0];
            const wikiId = filter[1];
            const pageId = filter[2];
            const projectInfo = await coreRestClient.getProject(projectId);
            const wiki = await customClient.getWiki(wikiId, projectId);
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
            };
            setWikiPages((prevWikiPages) => [...prevWikiPages, wikiInfo]);
          }
        }
        console.log(wikiPages);
        setLoaded(true);
      } catch (error) {
        console.error("Error fetching wiki information:", error);
      }
    };

    SDK.init({
      loaded: false,
    });

    setCurrUserId(SDK.getUser().id);
    SDK.ready().then(() => {
      getSubscriptions();
    });
  }, []);

  useEffect(() => {
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

  return (
    <>
      <h4>
        Hello {SDK.getUser().name} User ID: {currUserId}
        {subscriptions.length > 0 && (
          <span> with {subscriptions.length} subscriptions</span>
        )}
      </h4>
      <table>
        <thead>
          <tr>
            <th>Wikis Followed</th>
          </tr>
        </thead>
        <tbody>
          {wikiPages.map((page) => (
            <tr key={page.pageId}>
              <td>
                <a
                  href={getWikiUrl(
                    page.gitItemPath,
                    page.wikiName,
                    page.projectName
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {getLastSegment(page.path)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default App;
