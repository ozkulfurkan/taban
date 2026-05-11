export interface BarcodePrintForm {
  companyName: string;
  productName: string;
  logoUrl: string;
  date: string;
  shore: string;
  renk: string;
  qtyPerPack: string;
  qtyUnit: string;
}

export function buildPrintHtml(
  numbers: string[],
  form: BarcodePrintForm,
  settings: { labelWidth: number; labelHeight: number }
): string {
  const W = settings.labelWidth;
  const H = settings.labelHeight;

  const labelsHtml = numbers.map((num, i) => {
    const isLast = i === numbers.length - 1;
    const details = [
      form.renk ? `Renk: ${form.renk}` : '',
      form.shore ? `Shore: ${form.shore}` : '',
      `${form.qtyPerPack} ${form.qtyUnit}`,
    ].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;');

    return `
<div class="label" style="page-break-after:${isLast ? 'avoid' : 'always'}">
  ${form.logoUrl ? `<img src="${form.logoUrl}" class="logo" alt="" />` : ''}
  <div class="company">${form.companyName}</div>
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
  padding: 3mm;
  overflow: hidden;
}
.logo { max-height: 12mm; max-width: ${W * 0.4}mm; object-fit: contain; }
.company { font-size: 7pt; font-weight: bold; text-align: center; }
.product { font-size: 9pt; font-weight: bold; text-align: center; }
.details { font-size: 6.5pt; text-align: center; color: #333; }
.barcode { max-width: ${W - 8}mm; }
.barcode-num { font-size: 6.5pt; letter-spacing: 0.5px; font-family: monospace; }
.date { font-size: 6pt; color: #666; }
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
      height: 35,
      margin: 0
    });
  });
  setTimeout(function() { window.print(); }, 300);
};
</script>
</body>
</html>`;
}
