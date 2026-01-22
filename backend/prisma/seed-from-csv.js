const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });
    rows.push(row);
  }
  
  return rows;
}

function parseBoolDomestic(val) {
  if (!val) return null;
  const s = String(val).trim().toUpperCase();
  if (['D', 'DOMESTIC', 'YES', 'Y', 'US', 'USA', 'TRUE', 'T'].includes(s)) return true;
  if (['ND', 'NON-DOMESTIC', 'NO', 'N', 'NON DOMESTIC', 'FALSE', 'F'].includes(s)) return false;
  return null;
}

async function main() {
  const csvPath = path.join(process.cwd(), "data", "extracted_spec_components.csv");
  
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(content);

  let created = 0, updated = 0, skipped = 0;

  for (const row of rows) {
    const sku = row.sku?.trim();
    if (!sku || sku === 'sku') {
      skipped++;
      continue;
    }

    const manufacturer = row.manufacturer || 'Unknown';
    const model = row.model || '';
    const isDomestic = parseBoolDomestic(row.is_domestic) ?? false;
    const originCountry = isDomestic ? 'US' : row.origin_country || 'NONUS';
    
    // Create a better name from manufacturer and model
    const name = model || `${manufacturer} ${sku}`;

    const prev = await prisma.part.findUnique({ where: { sku } });
    
    await prisma.part.upsert({
      where: { sku },
      create: {
        sku,
        name,
        unitPrice: null, // Price not in CSV
        weightKg: null,
        originCountry,
        isDomestic
      },
      update: {
        name,
        originCountry,
        isDomestic
      },
    });

    prev ? updated++ : created++;
  }

  console.log(`✅ CSV import complete: created=${created}, updated=${updated}, skipped=${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
