"use client";

import "@crayonai/react-ui/styles/index.css";
import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-main.css";
import { useEffect, useRef, useCallback, useState } from "react";
import type { CellChange, ChangeSource } from "handsontable/common";
import { useTableContext } from "./TableContext";

type CellValue = string | number | null;

// Deep clone to create mutable arrays that Handsontable can modify
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Convert a 0-based column index to an Excel-style letter (A, B, ..., Z, AA, AB, ...)
function columnLetter(index: number): string {
  let n = index;
  let label = "";
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function makeDefaultHeaders(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Column ${columnLetter(i)}`);
}

// Convert a SheetJS cell into the app's CellValue, preserving formulas as `=...` strings
function sheetCellToValue(cell: unknown): CellValue {
  if (cell === null || cell === undefined) return null;
  const c = cell as { t?: string; v?: unknown; f?: string; w?: string };

  if (typeof c.f === "string" && c.f.length > 0) {
    return c.f.startsWith("=") ? c.f : `=${c.f}`;
  }

  const v = c.v;
  if (v === null || v === undefined) return null;

  switch (c.t) {
    case "n":
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    case "s":
      return typeof v === "string" ? v : String(v);
    case "b":
      return v ? "TRUE" : "FALSE";
    case "d":
      if (typeof c.w === "string" && c.w.length > 0) return c.w;
      if (v instanceof Date) return v.toISOString();
      return String(v);
    case "e":
      return null;
    default:
      if (typeof v === "number") return Number.isFinite(v) ? v : null;
      if (typeof v === "string") return v;
      if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
      return null;
  }
}

interface SpreadsheetTableProps {
  data: CellValue[][];
  colHeaders?: string[];
}

// Lazy-loaded Handsontable component to avoid SSR issues
let HotTable: any = null;
let HyperFormula: any = null;
let modulesLoaded = false;

// SpreadsheetTable: Syncs AI-generated data to the persistent spreadsheet (no visible rendering in chat)
export const SpreadsheetTable = ({
  data: initialData,
  colHeaders: initialColHeaders,
}: SpreadsheetTableProps) => {
  const { syncTableData } = useTableContext();
  const hasSyncedRef = useRef(false);
  const lastDataRef = useRef<string>("");

  // Sync data to context whenever props change
  useEffect(() => {
    const dataStr = JSON.stringify({ data: initialData, colHeaders: initialColHeaders });
    
    // Only sync if data actually changed
    if (dataStr !== lastDataRef.current) {
      lastDataRef.current = dataStr;
      syncTableData(initialData, initialColHeaders);
      hasSyncedRef.current = true;
    }
  }, [initialData, initialColHeaders, syncTableData]);

  // Render nothing - data is shown in the persistent spreadsheet panel
  return null;
};

// Default empty spreadsheet data
const DEFAULT_DATA: CellValue[][] = [
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
  [null, null, null, null, null, null],
];

// Persistent spreadsheet component that displays data from TableContext
export const PersistentSpreadsheet = () => {
  const { tableData, syncTableData } = useTableContext();
  const hotRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [containerHeight, setContainerHeight] = useState(400);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Track context data to detect updates from AI
  const lastContextDataRef = useRef<string>("");

  // Track if we're currently syncing to prevent loops
  const isSyncingRef = useRef(false);

  // Store colHeaders in ref for use in callbacks
  const colHeadersRef = useRef<string[] | undefined>(tableData?.colHeaders);

  // Calculate container height on mount and resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height > 0 ? rect.height : 400);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    
    // Also update after a short delay to handle initial render
    const timeout = setTimeout(updateHeight, 100);
    
    return () => {
      window.removeEventListener("resize", updateHeight);
      clearTimeout(timeout);
    };
  }, [isClient]);

  // Load Handsontable only on client side
  useEffect(() => {
    const loadHandsontable = async () => {
      if (typeof window !== "undefined" && !modulesLoaded) {
        const [hotModule, hfModule, registryModule] = await Promise.all([
          import("@handsontable/react-wrapper"),
          import("hyperformula"),
          import("handsontable/registry"),
        ]);

        HotTable = hotModule.HotTable;
        HyperFormula = hfModule.HyperFormula;
        registryModule.registerAllModules();
        modulesLoaded = true;

        setIsClient(true);
      } else if (modulesLoaded) {
        setIsClient(true);
      }
    };

    loadHandsontable();
  }, []);

  // Save data to context and backend
  const saveData = useCallback(
    async (data: CellValue[][], colHeaders?: string[]) => {
      if (isSyncingRef.current) return;

      try {
        isSyncingRef.current = true;
        await syncTableData(data, colHeaders || colHeadersRef.current);
      } catch (error) {
        console.error("Failed to save table data:", error);
      } finally {
        isSyncingRef.current = false;
      }
    },
    [syncTableData]
  );

  // Initialize with default or context data
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || isInitialized) return;

    const data = tableData?.data || DEFAULT_DATA;
    const colHeaders = tableData?.colHeaders;
    
    const mutableData = deepClone(data);
    hot.loadData(mutableData);
    
    if (colHeaders) {
      hot.updateSettings({ colHeaders });
      colHeadersRef.current = colHeaders;
    }
    
    lastContextDataRef.current = JSON.stringify(tableData);
    setIsInitialized(true);
  }, [isClient, tableData, isInitialized]);

  // Handle context data changes (from AI updates via chat)
  useEffect(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot || !isInitialized || isSyncingRef.current) return;

    const contextDataStr = JSON.stringify(tableData);
    
    // Only update if context data actually changed (from AI)
    if (contextDataStr !== lastContextDataRef.current && tableData?.data) {
      lastContextDataRef.current = contextDataStr;
      
      const mutableData = deepClone(tableData.data);
      hot.loadData(mutableData);
      
      if (tableData.colHeaders) {
        hot.updateSettings({ colHeaders: tableData.colHeaders });
        colHeadersRef.current = tableData.colHeaders;
      }
    }
  }, [tableData, isInitialized]);

  // Autosave after changes
  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (source === "loadData") return;
      if (!changes) return;

      const hot = hotRef.current?.hotInstance;
      if (!hot) return;

      const allData = hot.getData() as CellValue[][];
      saveData(allData);
    },
    [saveData]
  );

  // Handle row creation
  const handleAfterCreateRow = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Handle row removal
  const handleAfterRemoveRow = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Handle column creation
  const handleAfterCreateCol = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Handle column removal
  const handleAfterRemoveCol = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (hot) {
      saveData(hot.getData() as CellValue[][]);
    }
  }, [saveData]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const hot = hotRef.current?.hotInstance;
    if (!hot) return;

    const exportPlugin = hot.getPlugin('exportFile');
    exportPlugin?.downloadFile('csv', {
      bom: false,
      columnDelimiter: ',',
      columnHeaders: true,
      exportHiddenColumns: true,
      exportHiddenRows: true,
      fileExtension: 'csv',
      filename: 'Spreadsheet_[YYYY]-[MM]-[DD]',
      mimeType: 'text/csv',
      rowDelimiter: '\r\n',
      rowHeaders: false,
    });
  }, []);

  // Trigger the hidden file input for Excel import
  const handleImportClick = useCallback(() => {
    setImportError(null);
    fileInputRef.current?.click();
  }, []);

  // Parse the selected Excel file entirely in the browser and load it into the table
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;

      setIsImporting(true);
      setImportError(null);

      try {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, {
          type: "array",
          cellFormula: true,
          cellDates: true,
        });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error("Workbook contains no sheets");
        }

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const ref = sheet["!ref"];

        let importedData: CellValue[][];
        let importedHeaders: string[];

        if (!ref) {
          importedHeaders = makeDefaultHeaders(6);
          importedData = Array.from({ length: 10 }, () => Array(6).fill(null));
        } else {
          const range = XLSX.utils.decode_range(ref);
          const numCols = range.e.c - range.s.c + 1;
          const numRows = range.e.r - range.s.r + 1;

          const matrix: CellValue[][] = [];
          for (let r = 0; r < numRows; r++) {
            const row: CellValue[] = [];
            for (let c = 0; c < numCols; c++) {
              const addr = XLSX.utils.encode_cell({
                r: range.s.r + r,
                c: range.s.c + c,
              });
              row.push(sheetCellToValue(sheet[addr]));
            }
            matrix.push(row);
          }

          const firstRow = matrix[0];
          const firstRowHasContent =
            !!firstRow &&
            firstRow.some((v) => v !== null && v !== undefined && v !== "");

          if (firstRowHasContent) {
            importedHeaders = firstRow.map((v, i) => {
              if (v === null || v === undefined || v === "") {
                return `Column ${columnLetter(i)}`;
              }
              return String(v);
            });
            importedData = matrix.slice(1);
            if (importedData.length === 0) {
              importedData = [Array(numCols).fill(null)];
            }
          } else {
            importedHeaders = makeDefaultHeaders(numCols);
            importedData = matrix.length
              ? matrix
              : [Array(numCols).fill(null)];
          }
        }

        await syncTableData(importedData, importedHeaders);
      } catch (err) {
        console.error("Failed to import Excel file:", err);
        setImportError(
          err instanceof Error ? err.message : "Failed to import Excel file"
        );
      } finally {
        setIsImporting(false);
      }
    },
    [syncTableData]
  );

  // Show loading state while Handsontable is loading
  if (!isClient || !HotTable || !HyperFormula) {
    return (
      <div className="persistent-spreadsheet h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-neutral-900/50 rounded-lg">
          <div className="text-neutral-400">Loading spreadsheet...</div>
        </div>
      </div>
    );
  }

  const HotTableComponent = HotTable;
  const HyperFormulaEngine = HyperFormula;
  const currentData = tableData?.data || DEFAULT_DATA;
  const currentHeaders = tableData?.colHeaders;

  return (
    <div className="persistent-spreadsheet h-full flex flex-col">
      <div className="flex-none px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Spreadsheet</h2>
            <p className="text-xs text-neutral-400 mt-1">
              {currentData.length} rows × {currentHeaders?.length || currentData[0]?.length || 0} columns
              {isImporting && (
                <span className="ml-2 text-blue-300">Importing…</span>
              )}
            </p>
            {importError && (
              <p className="text-xs text-red-400 mt-1" role="alert">
                Import failed: {importError}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-100 rounded-md transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {isImporting ? "Importing…" : "Import Excel"}
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 text-sm bg-neutral-700 hover:bg-neutral-600 text-neutral-100 rounded-md transition-colors flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden">
        <HotTableComponent
          ref={hotRef}
          startRows={currentData.length}
          startCols={currentHeaders?.length || currentData[0]?.length || 6}
          colHeaders={currentHeaders || true}
          rowHeaders={true}
          height={containerHeight}
          stretchH="all"
          formulas={{
            engine: HyperFormulaEngine,
          }}
          contextMenu={[
            "row_above",
            "row_below",
            "---------",
            "col_left",
            "col_right",
            "---------",
            "remove_row",
            "remove_col",
            "---------",
            "undo",
            "redo",
            "---------",
            "copy",
            "cut",
          ]}
          manualColumnResize={true}
          manualRowResize={true}
          autoWrapRow={true}
          autoWrapCol={true}
          afterChange={handleAfterChange}
          afterCreateRow={handleAfterCreateRow}
          afterRemoveRow={handleAfterRemoveRow}
          afterCreateCol={handleAfterCreateCol}
          afterRemoveCol={handleAfterRemoveCol}
          className="htDark"
          licenseKey="non-commercial-and-evaluation"
        />
      </div>
      <div className="flex-none px-4 py-2 border-t border-white/10 text-xs text-neutral-400">
        Right-click for options • Formulas supported (=SUM, =AVERAGE, etc.)
      </div>
    </div>
  );
};
