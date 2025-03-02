import { useEffect, useState } from "react";
import * as SDK from "azure-devops-extension-sdk";
import "./App.css";
import { getClient } from "azure-devops-extension-api/Common";
import {
  NotificationRestClient,
  NotificationSubscription,
  SubscriptionQueryFlags,
} from "azure-devops-extension-api/Notification";
import { WikiPage } from "azure-devops-extension-api/Wiki";
import { CustomWikiClient } from "./CustomWikiClient";
function App() {
  const [currUserId, setCurrUserId] = useState<string | null>(null);
  const [subscriptions, setSubscriptions] = useState<
    NotificationSubscription[]
  >([]);
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([]);

  useEffect(() => {
    const getSubscriptions = async () => {
      const notificationClient: NotificationRestClient = getClient(
        NotificationRestClient
      );

      notificationClient
        .querySubscriptions({
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
        })
        .then((subscriptions) => {
          setSubscriptions(subscriptions);
          getWikiInformation(subscriptions);
        });

      const getWikiInformation = (
        subscriptions: NotificationSubscription[]
      ) => {
        const customClient = getClient(CustomWikiClient);

        subscriptions.forEach((element) => {
          const filter = element.filter.artifactId?.split("/");
          if (filter != null && filter.length == 3) {
            const projectId = filter[0];
            const wikiId = filter[1];
            const pageId = filter[2];

            customClient.getWiki(wikiId, projectId).then((wiki) => {
              console.log(wiki);

              customClient
                .GetPageAsync(projectId, wiki.name, parseInt(pageId))
                .then((page) => {
                  setWikiPages((prevWikiPages) => [...prevWikiPages, page]);
                });
            });
          }
        });
        console.log(wikiPages);
        SDK.notifyLoadSucceeded();
      };
    };

    SDK.init({
      loaded: false,
    });

    setCurrUserId(SDK.getUser().id);
    SDK.ready().then(() => {
      getSubscriptions();
    });
  }, []);

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

  function getWikiUrl(page: WikiPage): string {
    return (
      "https://dev.azure.com/__Replace__ORG/__Replace__WithProj/_wiki/wikis/__Replace__Wikiname.wiki?pagePath=" +
      encodeQueryString(page.gitItemPath)
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
            <th>Path</th>
          </tr>
        </thead>
        <tbody>
          {wikiPages.map((page) => (
            <tr key={page.id}>
              <td>
                <a
                  href={getWikiUrl(page)}
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
