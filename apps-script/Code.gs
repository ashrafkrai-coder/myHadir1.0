const ADMIN_PASSWORD = "myHadir1234";

const KELAS_SHEET = {
  "5PVMA": "1uvg1CtZG8vM_afe2FFIlIXDCGFqAiHC3mM3-_zNSX6Q",
  "5J": "1lSGvyWTxKreBf1-QNwNfLDLNJsmgDut-d9vITIFAOBY",
  "5I": "1ohfS3OX2BYKvzm0eUGMB5vVDqjmuMqsZOr1GqRTocWQ",
  "5H": "1enSJlvIlkzV7c-1mkatMeSrTERFmB3czo3c3iSSAJlE",
  "5G": "1_PQ3zx_GHP1jJAlSocIQ_JJ8BZje7gH5rK77pJLZadQ",
  "5D": "1EYvfHcEp1HXsyhIdb0i9Y4Bnr30IIMIKMs6S61CdUpg",
  "5C": "1xz6SDuH0PUubFT2_J7gblaTLEs_--BkbHcRB7_7GmoU",
  "5B": "1_0vk2QFHmrZs4zE2muYT_N9C8xsEto5IySB67hR3Q7I",
  "5A": "1O1tElI85Hc_5vxykXPCno8H5fMdbtx31BQPxJ-DLPkk"
};

function doGet(e) {
  const params = (e && e.parameter) || {};
  if (params.tarikh) {
    return jsonOutput(getKehadiranByTarikh(params.tarikh));
  }

  return HtmlService.createHtmlOutputFromFile("index");
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action === "manual") {
      return jsonOutput(simpanManual(body));
    }

    return jsonOutput({ success: false, message: "Action tidak sah." });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: err && err.message ? err.message : "Ralat semasa memproses permintaan."
    });
  }
}

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getNamaByKelas(kelas) {
  const ctx = getSheetContext_(kelas);
  if (!ctx) return [];

  const lastRow = ctx.sheet.getLastRow();
  if (lastRow < 2) return [];

  return ctx.sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(String)
    .map(function(v) { return v.trim(); })
    .filter(String);
}

function getKehadiranByTarikh(tarikhInput) {
  const tarikh = normalizeDateKey_(tarikhInput);
  if (!tarikh) {
    return { success: false, message: "Format tarikh tidak sah.", data: [] };
  }

  const data = [];

  Object.keys(KELAS_SHEET).forEach(function(kelas) {
    const ctx = getSheetContext_(kelas);
    if (!ctx) return;

    const tarikhCol = findDateColumn_(ctx.sheet, tarikh);
    if (!tarikhCol) return;

    const lastRow = ctx.sheet.getLastRow();
    if (lastRow < 2) return;

    const namaRows = ctx.sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    const statusRows = ctx.sheet.getRange(2, tarikhCol, lastRow - 1, 1).getValues();

    for (var i = 0; i < namaRows.length; i++) {
      const nama = String(namaRows[i][0] || "").trim();
      const statusRaw = String(statusRows[i][0] || "").trim();
      if (!nama) continue;

      data.push({
        Nama: nama,
        Kelas: kelas,
        Tarikh: tarikh,
        Status: normalizeStatus_(statusRaw),
        StatusAsal: statusRaw
      });
    }
  });

  return {
    success: true,
    tarikh: tarikh,
    data: data
  };
}

function simpanManual(payload) {
  const password = String(payload.password || payload.katalaluan || "").trim();
  const kelas = String(payload.kelas || "").trim();
  const nama = String(payload.nama || "").trim();
  const status = normalizeStatus_(payload.status);
  const tarikh = normalizeDateKey_(payload.tarikh);

  if (password !== ADMIN_PASSWORD) {
    return { success: false, message: "Password salah!" };
  }

  if (!kelas || !nama || !tarikh) {
    return { success: false, message: "Data manual tidak lengkap." };
  }

  const ctx = getSheetContext_(kelas);
  if (!ctx) {
    return { success: false, message: "Kelas tidak dijumpai!" };
  }

  const row = findStudentRow_(ctx.sheet, nama);
  if (!row) {
    return { success: false, message: "Nama murid tidak dijumpai dalam sheet." };
  }

  const col = ensureDateColumn_(ctx.sheet, tarikh);
  ctx.sheet.getRange(row, col).setValue(status === "Hadir" ? "Hadir" : "Tidak Hadir");

  return {
    success: true,
    message: "Rekod berjaya disimpan.",
    data: {
      Nama: nama,
      Kelas: kelas,
      Tarikh: tarikh,
      Status: status
    }
  };
}

function getSheetContext_(kelas) {
  const id = KELAS_SHEET[kelas];
  if (!id) return null;

  const ss = SpreadsheetApp.openById(id);
  const sheet = ss.getSheets()[0];
  return { ss: ss, sheet: sheet };
}

function findStudentRow_(sheet, nama) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const target = cleanText_(nama);

  for (var i = 0; i < names.length; i++) {
    if (cleanText_(names[i][0]) === target) {
      return i + 2;
    }
  }

  return 0;
}

function findDateColumn_(sheet, tarikh) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 2) return 0;

  const headers = sheet.getRange(1, 2, 1, lastCol - 1).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (normalizeDateKey_(headers[i]) === tarikh) {
      return i + 2;
    }
  }

  return 0;
}

function ensureDateColumn_(sheet, tarikh) {
  const existing = findDateColumn_(sheet, tarikh);
  if (existing) return existing;

  const col = Math.max(2, sheet.getLastColumn() + 1);
  sheet.getRange(1, col).setValue(tarikh);
  return col;
}

function normalizeStatus_(value) {
  const text = cleanText_(value);
  if (!text) return "Tidak Hadir";
  if (text === "hadir" || text === "h" || text === "present" || text === "1" || text === "ya" || text === "true") {
    return "Hadir";
  }
  if (text === "th" || text === "tidak hadir" || text === "x hadir" || text === "absen" || text === "ponteng" || text === "0" || text === "false") {
    return "Tidak Hadir";
  }
  if (text.indexOf("hadir") !== -1 && text.indexOf("tidak") === -1) {
    return "Hadir";
  }
  return "Tidak Hadir";
}

function normalizeDateKey_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd/MM/yyyy");
  }

  const text = String(value || "").trim();
  if (!text) return "";

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return pad2_(iso[3]) + "/" + pad2_(iso[2]) + "/" + iso[1];

  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return pad2_(dmy[1]) + "/" + pad2_(dmy[2]) + "/" + dmy[3];

  return "";
}

function cleanText_(value) {
  return String(value || "").trim().toLowerCase();
}

function pad2_(value) {
  return ("0" + String(value)).slice(-2);
}
