# C1 Handsontable - AI-Powered Spreadsheet

An Excel-like spreadsheet with AI capabilities using [Thesys C1](https://thesys.dev) and [Handsontable](https://handsontable.com).

## Features

- **Excel-like Spreadsheet**: Full-featured data grid with cell editing, selection, copy/paste
- **Excel Import (`.xlsx` / `.xls`)**: Upload an existing workbook and load its first sheet straight into the grid. Parsing runs entirely in the browser via [SheetJS](https://sheetjs.com), so it does not require an AI model or API key and is safe for serverless deployment.
- **CSV Export**: Download the current grid (with column headers) as a CSV file.
- **Formula Support**: 386+ Excel-compatible formulas via HyperFormula (SUM, AVERAGE, IF, VLOOKUP, etc.)
- **AI-Powered Operations**: Ask the AI to:
  - View and analyze table data
  - Update cells with values or formulas
  - Add/delete rows and columns
  - Query and filter data
  - Apply complex formulas
- **Real-time Updates**: Formulas automatically recalculate when data changes
- **Context Menu**: Right-click for row/column operations

## Getting Started

### Prerequisites

- Node.js 18+
- A Thesys API key ([get one here](https://platform.thesys.dev)) — required only for the AI chat assistant. Excel import, CSV export, and manual editing work without it.

### Installation

```bash
# Install dependencies
npm install
# or
pnpm install

# Copy environment file and add your API key
cp env.example .env.local
# Edit .env.local and add your THESYS_API_KEY

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Examples

### Importing an Excel file

Click **Import Excel** in the spreadsheet header and pick a `.xlsx` or `.xls` file. The first worksheet is loaded into the grid:

- If the first row contains any non-empty cell, it is used as the column headers and the rest of the sheet becomes the data.
- Otherwise, headers are generated as `Column A`, `Column B`, …
- Numbers and strings are preserved as-is. Booleans become `"TRUE"`/`"FALSE"`, dates use the cell's formatted display string when available, and formulas (e.g. `SUM(A1:A10)`) are kept as `=SUM(A1:A10)` so HyperFormula recalculates them.
- Parsing runs entirely in the browser via [SheetJS](https://sheetjs.com); no file is uploaded to the server.

### Asking the AI assistant

Try these prompts with the AI assistant:

1. **View data**: "Show me the current spreadsheet data"
2. **Update cells**: "Change the Q1 Sales for Widget A to 2000"
3. **Add formulas**: "Add a formula to calculate the percentage growth between Q1 and Q4"
4. **Add rows**: "Add a new product called 'Widget C' with Q1=500, Q2=600, Q3=700, Q4=800"
5. **Query data**: "Find all products with Q4 sales greater than 1500"
6. **Complex formulas**: "Add a column that shows the average quarterly sales for each product"

## Sample Data

The spreadsheet starts with sample sales data:

| Product   | Q1 Sales | Q2 Sales | Q3 Sales | Q4 Sales | Total        |
|-----------|----------|----------|----------|----------|--------------|
| Widget A  | 1500     | 1800     | 2100     | 2400     | =SUM(B1:E1)  |
| Widget B  | 1200     | 1400     | 1600     | 1900     | =SUM(B2:E2)  |
| Gadget X  | 800      | 950      | 1100     | 1300     | =SUM(B3:E3)  |
| ...       | ...      | ...      | ...      | ...      | ...          |

## Supported Formulas

HyperFormula supports 386+ Excel-compatible functions including:

- **Math**: SUM, AVERAGE, COUNT, MAX, MIN, ROUND, ABS, etc.
- **Logical**: IF, AND, OR, NOT, TRUE, FALSE
- **Lookup**: VLOOKUP, HLOOKUP, INDEX, MATCH
- **Text**: CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER
- **Date/Time**: TODAY, NOW, DATE, YEAR, MONTH, DAY
- **Statistical**: MEDIAN, MODE, STDEV, VAR

[Full function list](https://hyperformula.handsontable.com/guide/built-in-functions.html)

## Deploying to Vercel

The project is a standard Next.js 15 app and deploys to Vercel without extra configuration.

1. Push this repository to GitHub (or another Vercel-supported provider).
2. In Vercel, **Add New → Project** and import the repository.
3. If you are deploying from the [`examples`](https://github.com/) monorepo, set **Root Directory** to `c1-sheet-copilot`. For a standalone clone, leave the default.
4. Vercel auto-detects the Next.js framework, install command (`npm install`), and build command (`next build`). No overrides are needed.
5. Under **Environment Variables**, add `THESYS_API_KEY` with your Thesys API key. This is only required for the AI chat assistant; Excel import, CSV export, and manual editing work without it.
6. Click **Deploy**.

### What runs where

- **Excel import** runs entirely in the browser (SheetJS). Nothing is uploaded to the server, so it works on any Vercel plan, including free serverless functions.
- **AI chat** uses the Next.js route at `src/app/api/chat/route.ts`, which calls the Thesys C1 endpoint with `THESYS_API_KEY` from the server-side environment.

### Persistence caveat

The table state and chat history are kept in process memory inside the API routes (`src/app/api/chat/messageStore.ts`, `src/app/api/chat/tableStore.ts`). This is fine for demos and local development, but on Vercel each serverless invocation can land on a different instance and cold starts wipe memory, so threads and table snapshots are **not** durable across deployments or instances. For a production setup, replace those stores with a real database (e.g. Postgres, Redis, Vercel KV/Postgres) or another persistent backend.

## Tech Stack

- [Next.js 15](https://nextjs.org/) - React framework
- [Thesys C1](https://thesys.dev) - Generative UI SDK
- [Handsontable](https://handsontable.com) - Data grid component
- [HyperFormula](https://hyperformula.handsontable.com/) - Formula calculation engine
- [SheetJS (`xlsx`)](https://sheetjs.com) - Browser-side `.xlsx` / `.xls` parsing
- [Tailwind CSS](https://tailwindcss.com) - Styling

## Project Structure

```
c1-handsontable/
├── src/
│   ├── app/
│   │   ├── api/chat/
│   │   │   ├── route.ts         # API endpoint with C1 integration
│   │   │   ├── tools.ts         # AI tools for table operations
│   │   │   ├── tableStore.ts    # In-memory table data store
│   │   │   └── messageStore.ts  # Conversation history
│   │   ├── components.tsx       # SpreadsheetTable component
│   │   ├── page.tsx             # Main page
│   │   ├── layout.tsx
│   │   └── globals.css
├── package.json
└── README.md
```

## License

This example uses Handsontable's non-commercial evaluation license. For production use, you'll need a [commercial license](https://handsontable.com/pricing).
