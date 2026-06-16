// Google Apps Script — Vaida is not dead e.V. Beitrittsformular
// Deploy as: Web App · Execute as: Me · Access: Anyone
//
// Script Properties (Project Settings → Script Properties):
//   NOTIFY_EMAIL    — e.g. info@vaidaisnotdead.de
//   SHEET_ID        — Google Sheet ID from URL
//   DOC_TEMPLATE_ID — Google Doc template ID (optional; emails work without it)
//
// One-time setup: run setupHeaders() manually to create Sheet column headers.
// Doc template placeholders: {{vorname_name}} {{geburtstag}} {{adresse}}
//   {{email}} {{handy}} {{datum}} {{kontoinhaber}} {{iban}} {{bic}} {{bank}} {{beitrag}}
//
// ⚠ Restrict Google Sheet access — contains IBAN and personal data.

var SHEET_ID = '1J_UqkfiizBa2TGgu0OuDG2507Ms2_bkUr6LVrdSZJ4g';

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var NOTIFY_EMAIL = props.getProperty('NOTIFY_EMAIL') || 'kontakt@vaidaisnotdead.de';
    Logger.log('NOTIFY_EMAIL: ' + NOTIFY_EMAIL);
    Logger.log('Raw body: ' + e.postData.contents);

    var data = JSON.parse(e.postData.contents);
    Logger.log('Parsed name: ' + data.name + ', email: ' + data.email);

    var name         = data.name         || '';
    var strasse      = data.strasse      || '';
    var plz          = data.plz          || '';
    var ort          = data.ort          || '';
    var geburtstag   = data.geburtstag   || '';
    var email        = data.email        || '';
    var telefon      = data.telefon      || '';
    var newsletter   = data.newsletter   || 'nein';
    var beitrag      = data.beitrag      || '';
    var kontoinhaber = data.kontoinhaber || '';
    var iban         = data.iban         || '';
    var bic          = data.bic          || '';
    var bank         = data.bank         || '';
    var nachricht    = data.nachricht    || '';

    var beitragLabel    = beitrag === 'monatlich_5' ? 'Monatlich – 5 €' : 'Jährlich – 50 €';
    var newsletterLabel = newsletter === 'ja' ? 'Ja' : 'Nein';

    // Generate filled PDF (skipped gracefully if DOC_TEMPLATE_ID not set)
    var pdf         = createFilledPDF(props, data, beitragLabel);
    var attachments = pdf ? [pdf] : [];

    var logoUrl = 'https://vaidaisnotdead.de/assets/images/logo.png';

    // Admin notification
    var adminPlain = [
      'Neuer Beitrittsantrag: ' + name,
      '',
      'Name: ' + name,
      'Adresse: ' + strasse + ', ' + plz + ' ' + ort,
      'Geburtsdatum: ' + geburtstag,
      'E-Mail: ' + email,
      'Telefon: ' + (telefon || '—'),
      'Newsletter: ' + newsletterLabel,
      'Beitrag: ' + beitragLabel,
      '',
      'Kontoinhaber: ' + kontoinhaber,
      'IBAN: ' + iban,
      'BIC: ' + (bic || '—'),
      'Bank: ' + bank,
      '',
      'Mitteilung: ' + (nachricht || '—'),
      'Eingegangen: ' + new Date().toLocaleString('de-DE'),
    ].join('\n');

    var adminHtml = emailWrap(logoUrl, [
      '<h2 style="margin:0 0 4px;font-size:20px;color:#111;">Neuer Beitrittsantrag</h2>',
      '<p style="margin:0 0 24px;color:#666;font-size:14px;">Eingegangen am ' + new Date().toLocaleString('de-DE') + '</p>',
      emailSection('Persönliche Angaben', [
        emailRow('Name', name),
        emailRow('Adresse', strasse + ', ' + plz + ' ' + ort),
        emailRow('Geburtsdatum', geburtstag),
        emailRow('E-Mail', '<a href="mailto:' + email + '" style="color:#5a9e6f;">' + email + '</a>'),
        emailRow('Telefon', telefon || '—'),
        emailRow('Newsletter', newsletterLabel),
      ]),
      emailSection('Mitgliedsbeitrag', [
        emailRow('Modell', beitragLabel),
      ]),
      emailSection('SEPA-Lastschriftmandat', [
        emailRow('Kontoinhaber', kontoinhaber),
        emailRow('IBAN', '<code style="font-family:monospace;">' + iban + '</code>'),
        emailRow('BIC', bic || '—'),
        emailRow('Bank', bank),
      ]),
      nachricht ? emailSection('Mitteilung', ['<p style="margin:0;color:#333;font-size:14px;">' + nachricht + '</p>']) : '',
      '<p style="margin:16px 0 0;font-size:12px;color:#aaa;">Details auch im Google Sheet hinterlegt.</p>',
    ].join(''));

    GmailApp.sendEmail(
      NOTIFY_EMAIL,
      'Neuer Beitrittsantrag: ' + name,
      adminPlain,
      { replyTo: 'kontakt@vaidaisnotdead.de', htmlBody: adminHtml, attachments: attachments }
    );

    // Confirmation to applicant
    var applicantPlain = [
      'Hallo ' + name + ',',
      '',
      'vielen Dank! Wir haben deinen Beitrittsantrag erhalten und melden uns in Kürze.',
      '',
      'Deine Angaben:',
      'Name: ' + name,
      'Adresse: ' + strasse + ', ' + plz + ' ' + ort,
      'Geburtsdatum: ' + geburtstag,
      'Beitrag: ' + beitragLabel,
      'Newsletter: ' + newsletterLabel,
      '',
      'SEPA: ' + kontoinhaber + ' / ' + iban,
      '',
      'Du hast dem SEPA-Lastschriftmandat zugestimmt. Du kannst innerhalb von acht Wochen ab dem Belastungsdatum die Erstattung des Betrages verlangen.',
      '',
      'Bitte antworte nicht auf diese E-Mail.',
      'Bei Fragen: ' + NOTIFY_EMAIL,
      '',
      'Vaida is not dead e.V.',
    ].join('\n');

    var applicantHtml = emailWrap(logoUrl, [
      '<h2 style="margin:0 0 8px;font-size:20px;color:#111;">Willkommen, ' + name + '!</h2>',
      '<p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.6;">Vielen Dank für deinen Beitrittsantrag bei <strong>Vaida is not dead e.V.</strong> Wir haben alles erhalten und melden uns in Kürze.</p>',
      emailSection('Deine Angaben', [
        emailRow('Name', name),
        emailRow('Adresse', strasse + ', ' + plz + ' ' + ort),
        emailRow('Geburtsdatum', geburtstag),
        emailRow('E-Mail', email),
        emailRow('Telefon', telefon || '—'),
        emailRow('Beitrag', beitragLabel),
        emailRow('Newsletter', newsletterLabel),
      ]),
      emailSection('SEPA-Lastschriftmandat', [
        emailRow('Kontoinhaber', kontoinhaber),
        emailRow('IBAN', '<code style="font-family:monospace;">' + iban + '</code>'),
        emailRow('BIC', bic || '—'),
        emailRow('Bank', bank),
        '<tr><td colspan="2" style="padding:12px 0 0;font-size:13px;color:#888;border-top:1px solid #f0f0f0;">Du hast dem SEPA-Lastschriftmandat zugestimmt. Du kannst innerhalb von acht Wochen ab dem Belastungsdatum die Erstattung des Betrages verlangen.</td></tr>',
      ]),
      '<p style="margin:24px 0 0;font-size:13px;color:#aaa;">Bitte antworte nicht auf diese E-Mail. Bei Fragen schreib uns direkt an <a href="mailto:' + NOTIFY_EMAIL + '" style="color:#5a9e6f;">' + NOTIFY_EMAIL + '</a>.</p>',
    ].join(''));

    GmailApp.sendEmail(
      email,
      'Dein Beitrittsantrag – Vaida is not dead e.V.',
      applicantPlain,
      { replyTo: 'kontakt@vaidaisnotdead.de', htmlBody: applicantHtml, attachments: attachments }
    );

    Logger.log('Emails sent successfully.');

    // Append row to Sheet (after emails so a sheet error never blocks delivery)
    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
      sheet.appendRow([
        new Date(), name, strasse, plz, ort, geburtstag,
        email, telefon, newsletterLabel, beitragLabel,
        kontoinhaber, iban, bic, bank, nachricht
      ]);
      Logger.log('Sheet row appended.');
    } catch (sheetErr) {
      Logger.log('Sheet error (emails already sent): ' + sheetErr.message);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('ERROR: ' + err.message);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Fills a Google Doc template and returns a PDF Blob.
// Returns null if DOC_TEMPLATE_ID is not configured.
function createFilledPDF(props, data, beitragLabel) {
  var templateId = props.getProperty('DOC_TEMPLATE_ID');
  if (!templateId) return null;

  var beitragText = data.beitrag === 'monatlich_5'
    ? 'Monatlich (5 € / Monat)'
    : 'Jährlich (50 €)';

  var copy = DriveApp.getFileById(templateId).makeCopy(
    'Beitrittsantrag_' + data.name + '_' + new Date().toISOString().slice(0, 10)
  );
  var doc  = DocumentApp.openById(copy.getId());
  var body = doc.getBody();

  body.replaceText('{{vorname_name}}', data.name         || '');
  body.replaceText('{{geburtstag}}',   data.geburtstag   || '');
  body.replaceText('{{adresse}}',      (data.strasse || '') + ', ' + (data.plz || '') + ' ' + (data.ort || ''));
  body.replaceText('{{email}}',        data.email        || '');
  body.replaceText('{{handy}}',        data.telefon      || '—');
  body.replaceText('{{datum}}',                new Date().toLocaleDateString('de-DE'));
  body.replaceText('{{kontoinhaber}}',        data.kontoinhaber || '');
  body.replaceText('{{iban}}',               data.iban         || '');
  body.replaceText('{{bic}}',               data.bic          || '—');
  body.replaceText('{{bank}}',              data.bank         || '');
  body.replaceText('{{beitrag_check_jaehrlich}}', data.beitrag === 'monatlich_5' ? '☐' : '☑');
  body.replaceText('{{beitrag_check_monatlich}}', data.beitrag === 'monatlich_5' ? '☑' : '☐');

  doc.saveAndClose();
  var pdf = copy.getAs('application/pdf');
  copy.setTrashed(true);
  return pdf;
}

function emailRow(label, value) {
  return '<tr>'
    + '<td style="padding:8px 12px 8px 0;font-size:13px;color:#888;white-space:nowrap;vertical-align:top;">' + label + '</td>'
    + '<td style="padding:8px 0;font-size:14px;color:#222;vertical-align:top;">' + value + '</td>'
    + '</tr>';
}

function emailSection(title, rows) {
  return '<h3 style="margin:24px 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#aaa;">' + title + '</h3>'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">'
    + rows.join('')
    + '</table>';
}

function emailWrap(logoUrl, content) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
    + '<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">'
    + '<tr><td align="center">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">'
    + '<tr><td style="background:#111111;padding:24px 32px;">'
    + '<p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Vaida is not dead e.V.</p>'
    + '</td></tr>'
    + '<tr><td style="padding:32px;">'
    + content
    + '</td></tr>'
    + '<tr><td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eeeeee;">'
    + '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
    + '<td style="vertical-align:middle;">'
    + '<p style="margin:0;color:#aaa;font-size:12px;">Vaida is not dead e.V. &middot; <a href="mailto:kontakt@vaidaisnotdead.de" style="color:#5a9e6f;text-decoration:none;">kontakt@vaidaisnotdead.de</a></p>'
    + '<p style="margin:2px 0 0;color:#ccc;font-size:11px;"><a href="https://vaidaisnotdead.de" style="color:#ccc;text-decoration:none;">vaidaisnotdead.de</a></p>'
    + '</td>'
    + '<td align="right" style="vertical-align:middle;">'
    + '<img src="' + logoUrl + '" width="40" height="40" alt="VIND" style="border-radius:50%;display:block;">'
    + '</td>'
    + '</tr></table>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr></table>'
    + '</body></html>';
}

function testEmail() {
  var logoUrl = 'https://vaidaisnotdead.de/assets/images/logo.png';
  var html = emailWrap(logoUrl, [
    '<h2 style="margin:0 0 8px;font-size:20px;color:#111;">Testmail</h2>',
    '<p style="color:#555;font-size:15px;line-height:1.6;">Wenn du diese E-Mail siehst, funktioniert der HTML-E-Mail-Versand korrekt.</p>',
    emailSection('Details', [
      emailRow('Sender', 'Google Apps Script'),
      emailRow('Status', '&#10003; OK'),
    ]),
  ].join(''));
  GmailApp.sendEmail(
    'jonasbauerwi@gmail.com',
    'Apps Script Testmail',
    'Wenn du diese E-Mail siehst, funktioniert der E-Mail-Versand korrekt.',
    { replyTo: 'kontakt@vaidaisnotdead.de', htmlBody: html }
  );
  Logger.log('E-Mail gesendet.');
}

// Run once manually in the Apps Script editor to set Sheet column headers.
function setupHeaders() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();
  sheet.getRange(1, 1, 1, 15).setValues([[
    'Timestamp', 'Name', 'Straße', 'PLZ', 'Ort', 'Geburtsdatum',
    'E-Mail', 'Telefon', 'Newsletter', 'Beitrag',
    'Kontoinhaber', 'IBAN', 'BIC', 'Bank', 'Nachricht'
  ]]);
}
