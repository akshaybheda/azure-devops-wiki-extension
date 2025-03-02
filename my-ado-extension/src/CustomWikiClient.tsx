/* eslint-disable @typescript-eslint/no-explicit-any */
import { WikiPage, WikiRestClient } from "azure-devops-extension-api/Wiki";
import { IVssRestClientOptions } from "azure-devops-extension-api";
import { VersionControlRecursionType } from "azure-devops-extension-api/Git";

export class CustomWikiClient extends WikiRestClient {
  constructor(options: IVssRestClientOptions) {
    super(options);
  }

  public async GetPageAsync(
    project: string,
    wikiIdentifier: string,
    pageId: number,
    recursionLevel?: VersionControlRecursionType,
    includeContent?: boolean
  ): Promise<WikiPage> {
    const queryValues: any = {
      recursionLevel: recursionLevel,
      includeContent: includeContent,
    };

    return this.beginRequest<WikiPage>({
      apiVersion: "5.2-preview.1",
      method: "GET",
      routeTemplate:
        "{project}/_apis/wiki/wikis/{wikiIdentifier}/pages/{pageId}",
      routeValues: {
        project: project,
        wikiIdentifier: wikiIdentifier,
        pageId: pageId,
      },
      customHeaders: {
        "Content-Type": "text/plain",
      },
      queryParams: queryValues,
    });
  }
}
