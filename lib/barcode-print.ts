export interface BarcodePrintForm {
  companyName: string;
  productName: string;
  productCode?: string;
  logoUrl: string;
  date: string;
  shore: string;
  qtyPerPack: string;
  qtyUnit: string;
}

export interface BarcodeTemplateSettings {
  labelWidth: number;
  labelHeight: number;
  labelPadding: number;
  companyFontSize: number;
  productFontSize: number;
  productCodeFontSize: number;
  detailsFontSize: number;
  barcodeFontSize: number;
  dateFontSize: number;
  barcodeHeight: number;
}

export const DEFAULT_TEMPLATE: BarcodeTemplateSettings = {
  labelWidth: 100,
  labelHeight: 60,
  labelPadding: 3,
  companyFontSize: 7,
  productFontSize: 9,
  productCodeFontSize: 7,
  detailsFontSize: 6,
  barcodeFontSize: 6,
  dateFontSize: 6,
  barcodeHeight: 35,
};

export function buildPrintHtml(
  numbers: string[],
  form: BarcodePrintForm,
  settings: Partial<BarcodeTemplateSettings>
): string {
  const s: BarcodeTemplateSettings = { ...DEFAULT_TEMPLATE, ...settings };
  const W = s.labelWidth;
  const H = s.labelHeight;
  const P = s.labelPadding;

  const labelsHtml = numbers.map((num, i) => {
    const isLast = i === numbers.length - 1;
    const details = [
      form.shore ? `Shore: ${form.shore}` : '',
      `${form.qtyPerPack} ${form.qtyUnit}`,
    ].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;');

    return `
<div class="label" style="page-break-after:${isLast ? 'avoid' : 'always'}">
  ${form.logoUrl ? `<img src="${form.logoUrl}" class="logo" alt="" />` : ''}
  <div class="company">${form.companyName}</div>
  ${form.productCode ? `<div class="product-code">${form.productCode}</div>` : ''}
  <div class="product">${form.productName}</div>
  ${details ? `<div class="details">${details}</div>` : ''}
  <svg class="barcode" id="bc${i}"></svg>
  <div class="barcode-num">${num}</div>
  <div class="date">${form.date}</div>
</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Barkod Etiket</title>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
<style>
@page { size: ${W}mm ${H}mm; margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; background: #fff; }
.label {
  width: ${W}mm;
  height: ${H}mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: ${P}mm;
  overflow: hidden;
}
.logo { max-height: 12mm; max-width: ${W * 0.4}mm; object-fit: contain; }
.company { font-size: ${s.companyFontSize}pt; font-weight: bold; text-align: center; }
.product { font-size: ${s.productFontSize}pt; font-weight: bold; text-align: center; }
.product-code { font-size: ${s.productCodeFontSize}pt; font-weight: bold; text-align: center; }
.details { font-size: ${s.detailsFontSize}pt; text-align: center; color: #333; }
.barcode { max-width: ${W - P * 2}mm; }
.barcode-num { font-size: ${s.barcodeFontSize}pt; letter-spacing: 0.5px; font-family: monospace; }
.date { font-size: ${s.dateFontSize}pt; color: #666; }
</style>
</head>
<body>
${labelsHtml}
<script>
window.onload = function() {
  var nums = ${JSON.stringify(numbers)};
  nums.forEach(function(n, i) {
    JsBarcode('#bc' + i, n, {
      format: 'CODE128',
      displayValue: false,
      width: 1.5,
      height: ${s.barcodeHeight},
      margin: 0
    });
  });
  setTimeout(function() { window.print(); }, 300);
};
</script>
</body>
</html>`;
}
