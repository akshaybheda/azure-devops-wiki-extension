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
import { ITableDataItem } from "./Hub";

export const fixedColumns = [
  {
    columnLayout: TableColumnLayout.singleLinePrefix,
    id: "name",
    name: "Name",
    readonly: true,
    renderCell: renderName,
    width: new ObservableValue(-40),
  },
  {
    id: "project",
    name: "Project",
    readonly: true,
    renderCell: renderSimpleCell,
    width: new ObservableValue(-30),
  },
];

function renderName(
  rowIndex: number,
  columnIndex: number,
  tableColumn: ITableColumn<ITableDataItem>,
  tableItem: ITableDataItem
): JSX.Element {
  const { name, url } = tableItem;
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
      line2={null}
    />
  );
}
