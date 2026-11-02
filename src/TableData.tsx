import * as React from "react";
import { ObservableValue } from "azure-devops-ui/Core/Observable";
import {
  ITableColumn,
  SimpleTableCell,
  TableColumnLayout,
  TwoLineTableCell,
} from "azure-devops-ui/Table";
import { renderSimpleCell } from "azure-devops-ui/Table";
import { Link } from "azure-devops-ui/Link";
import { Button } from "azure-devops-ui/Button";
import { ITableDataItem } from "./Hub";

export const getColumns = (onUnfollow: (subscriptionId: string) => void) => [
  {
    columnLayout: TableColumnLayout.singleLinePrefix,
    id: "name",
    name: "Name",
    readonly: true,
    renderCell: renderName,
    width: new ObservableValue(-42),
  },
  {
    id: "project",
    name: "Project",
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-20),
  },
  {
    id: "followedDate",
    name: "Followed",
    readonly: true,
    renderCell: renderFollowedDate,
    width: new ObservableValue(-20),
  },
  {
    id: "actions",
    name: "",
    readonly: true,
    renderCell: (
      rowIndex: number,
      columnIndex: number,
      tableColumn: ITableColumn<ITableDataItem>,
      tableItem: ITableDataItem
    ) =>
      renderActions(rowIndex, columnIndex, tableColumn, tableItem, onUnfollow),
    width: new ObservableValue(110),
  },
];

function renderName(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ITableDataItem>,
  tableItem: ITableDataItem
): JSX.Element {
  const { name, url, wiki } = tableItem;
  return (
    <TwoLineTableCell<ITableDataItem>
      className="bolt-table-cell-content-with-inline-link no-v-padding"
      key={"col-" + columnIndex}
      columnIndex={columnIndex}
      tableColumn={tableColumn}
      line1={
        <>
          <Link
            className="fontsizeM primary-text bolt-table-link bolt-table-inline-link"
            excludeTabStop
            href={url}
            target="_blank"
          >
            {name}
          </Link>
        </>
      }
      line2={<span className="wiki-table-secondary">{wiki}</span>}
    />
  );
}

function renderFollowedDate(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ITableDataItem>,
  tableItem: ITableDataItem
): JSX.Element {
  const date = new Date(tableItem.followedDate);
  const label = Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  return (
    <SimpleTableCell
      key={`followed-${columnIndex}`}
      columnIndex={columnIndex}
      tableColumn={tableColumn}
      className="wiki-followed-date"
    >
      {label}
    </SimpleTableCell>
  );
}

function renderActions(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ITableDataItem>,
  tableItem: ITableDataItem,
  onUnfollow: (subscriptionId: string) => void
): JSX.Element {
  return (
    <SimpleTableCell
      key={`actions-${columnIndex}`}
      columnIndex={columnIndex}
      tableColumn={tableColumn}
      className="wiki-row-action"
    >
      <Button
        text="Unfollow"
        ariaLabel={`Unfollow ${tableItem.name}`}
        onClick={() => onUnfollow(tableItem.subscriptionId)}
      />
    </SimpleTableCell>
  );
}
