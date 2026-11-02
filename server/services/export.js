import { Parser } from "json2csv";
import ExcelJS from "exceljs";

export function toCsv(results, platform = "instagram") {
  const sorted = [...results].sort((a, b) => {
    const dateDifference = dateSortValue(a) - dateSortValue(b);
    return dateDifference || timestampSortValue(a) - timestampSortValue(b);
  });

  return new Parser({
    fields: platform === "youtube"
      ? [
        { label: "Date", value: "date" },
        { label: "Channel Name", value: "channelName" },
        { label: "Channel Handle", value: "channelHandle" },
        { label: "YouTube Link", value: "videoLink" },
        { label: "Video Type", value: "videoType" }
      ]
      : [
        { label: "Date", value: "date" },
        { label: "Username", value: "username" },
        { label: "Page Name", value: "pageName" },
        { label: "Instagram Link", value: "instagramLink" }
      ],
    header: true
  }).parse(sorted.map((item) => ({
    date: formatCsvDate(item),
    username: String(item.username || "").replace(/^@/, ""),
    pageName: item.pageName || "Not Available",
    instagramLink: item.originalUrl || item.normalizedUrl || "",
    channelName: item.channelName || "Not Available",
    channelHandle: item.channelHandle || "Not Available",
    videoLink: item.originalUrl || item.normalizedUrl || "",
    videoType: item.videoType || "Not Available"
  })));
}

export async function toExcel(results, stats, platform = "instagram") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Instagram Bulk Post Time Finder";

  const sheet = workbook.addWorksheet("Date-wise Results");
  sheet.columns = [{ key: "name", width: 28 }, { key: "url", width: 68 }];
  const border = { style: "thin", color: { argb: "FF000000" } };
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  const dateFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
  const linkFont = { color: { argb: "FF0563C1" }, underline: true };

  const columnHeader = sheet.addRow(platform === "youtube"
    ? ["Channel Name", "YouTube Link"]
    : ["Username", "Instagram Link"]);
  columnHeader.height = 22;
  columnHeader.eachCell((cell) => {
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = headerFill;
    cell.border = { top: border, bottom: border, left: border, right: border };
  });

  const grouped = new Map();
  for (const item of results) {
    const date = item.publishingDate || item.publishingDateIST || "Date Unavailable";
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date).push(item);
  }
  const dates = [...grouped.keys()].sort((a, b) => {
    if (a === "Date Unavailable") return 1;
    if (b === "Date Unavailable") return -1;
    return dateSortValue(b) - dateSortValue(a);
  });

  for (const date of dates) {
    const items = grouped.get(date).sort((a, b) =>
      timestampSortValue(a) - timestampSortValue(b)
    );
    const headerRow = sheet.addRow([`Date: ${formatExcelDate(date)}`]);
    const headerNumber = headerRow.number;
    sheet.mergeCells(headerNumber, 1, headerNumber, 2);
    headerRow.height = 22;
    const dateCell = headerRow.getCell(1);
    dateCell.font = { bold: true };
    dateCell.alignment = { horizontal: "center", vertical: "middle" };
    dateCell.fill = dateFill;
    dateCell.border = { top: border, bottom: border, left: border, right: border };
    for (let column = 2; column <= 2; column++) {
      headerRow.getCell(column).border = { top: border, bottom: border, left: border, right: border };
    }

    for (const item of items) {
      const url = item.originalUrl || item.normalizedUrl || "";
      const name = platform === "youtube"
        ? item.channelName || "Not Available"
        : String(item.username || "").replace(/^@/, "");
      const row = sheet.addRow([name, { text: url, hyperlink: url }]);
      row.height = 20;
      row.eachCell((cell) => {
        cell.alignment = { vertical: "middle" };
        cell.border = { top: border, bottom: border, left: border, right: border };
      });
      row.getCell(1).font = linkFont;
      row.getCell(2).font = linkFont;
    }
  }

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const summary = workbook.addWorksheet("Summary");
  summary.addRows([
    ["Instagram Bulk Post Time Finder", ""],
    ["Generated", new Date().toISOString()],
    [],
    ["Metric", "Value"],
    ["Total URLs", stats.totalUrls || 0],
    ["Successful", stats.successful || 0],
    ["Failed", stats.failed || 0],
    ["Posts", stats.posts || 0],
    ["Reels", stats.reels || 0],
    ["Publishing dates found", stats.datesFound || 0]
  ]);
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 24;
  summary.getRow(1).font = { bold: true, size: 14 };
  summary.getRow(4).font = { bold: true };
  workbook.views = [{ activeTab: 0, firstSheet: 0 }];
  return workbook.xlsx.writeBuffer();
}

function formatExcelDate(value) {
  if (value === "Date Unavailable") return value;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1].slice(-2)}` : value;
}

function timestampSortValue(item) {
  const value = item.publishedAtUtc || item.utcTimestamp || item.creationTimestamp;
  const parsed = value ? Date.parse(value) : NaN;
  if (!Number.isNaN(parsed)) return parsed;
  const date = item.publishingDate || item.publishingDateIST;
  const time = item.publishingTimeIst || item.publishingTimeIST;
  const fallback = Date.parse(`${date || "9999-12-31"}T${time || "23:59:59"}`);
  return Number.isNaN(fallback) ? Number.MAX_SAFE_INTEGER : fallback;
}

function dateSortValue(item) {
  const value = item.publishingDate || item.publishingDateIST;
  if (!value || value === "Date Unavailable") return Number.MAX_SAFE_INTEGER;
  const parsed = Date.parse(`${value}T00:00:00`);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function formatCsvDate(item) {
  const value = item.publishingDate || item.publishingDateIST;
  if (!value || value === "Date Unavailable") return "Date Unavailable";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1].slice(-2)}` : value;
}
