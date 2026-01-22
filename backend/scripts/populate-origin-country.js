// Script to populate origin_country in extracted_spec_components.csv
// Based on manufacturer-country-mapping.json

const fs = require('fs');
const path = require('path');

const MAPPING_FILE = path.join(__dirname, '../data/manufacturer-country-mapping.json');
const CSV_FILE = path.join(__dirname, '../data/extracted_spec_components.csv');
const OUTPUT_FILE = path.join(__dirname, '../data/extracted_spec_components_updated.csv');

// Load manufacturer mapping
const mappingData = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
const manufacturers = mappingData.manufacturers;

// Helper: Find manufacturer in mapping (case-insensitive, partial match)
function findManufacturerCountry(manufacturerName) {
  if (!manufacturerName) return { country: 'UNKNOWN', is_feoc: null };
  
  const name = manufacturerName.trim();
  
  // Exact match first
  if (manufacturers[name]) {
    return {
      country: manufacturers[name].country,
      is_feoc: manufacturers[name].is_feoc || false,
      is_domestic: manufacturers[name].is_domestic || false,
    };
  }
  
  // Case-insensitive match
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(manufacturers)) {
    if (key.toLowerCase() === lowerName) {
      return {
        country: value.country,
        is_feoc: value.is_feoc || false,
        is_domestic: value.is_domestic || false,
      };
    }
  }
  
  // Partial match (manufacturer name contains key or key contains manufacturer name)
  for (const [key, value] of Object.entries(manufacturers)) {
    const keyLower = key.toLowerCase();
    if (lowerName.includes(keyLower) || keyLower.includes(lowerName)) {
      return {
        country: value.country,
        is_feoc: value.is_feoc || false,
        is_domestic: value.is_domestic || false,
      };
    }
  }
  
  return { country: 'UNKNOWN', is_feoc: null, is_domestic: null };
}

// Read CSV
const csvContent = fs.readFileSync(CSV_FILE, 'utf8');
const lines = csvContent.split('\n');
const header = lines[0];

console.log('Original header:', header);
console.log('Total rows:', lines.length - 1);

// Process each row
const updatedLines = [header]; // Keep original header
let updatedCount = 0;
let unknownCount = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  // Parse CSV (simple - assumes no commas in quoted fields for this data)
  const parts = line.split(',');
  if (parts.length < 7) {
    updatedLines.push(line);
    continue;
  }
  
  const sku = parts[0];
  const manufacturer = parts[1];
  const model = parts[2];
  const componentType = parts[3];
  const isDomestic = parts[4];
  const originCountry = parts[5]; // Currently empty
  const wattage = parts[6];
  const filename = parts.slice(7).join(','); // Rest is filename
  
  // Find country for this manufacturer
  const result = findManufacturerCountry(manufacturer);
  
  // Update origin_country
  const newOriginCountry = result.country;
  
  // Update is_domestic if we have better data
  let newIsDomestic = isDomestic;
  if (result.is_domestic === true && !isDomestic) {
    newIsDomestic = 'Y';
  } else if (result.is_domestic === false && !isDomestic) {
    newIsDomestic = 'N';
  }
  
  // Reconstruct line
  const newLine = `${sku},${manufacturer},${model},${componentType},${newIsDomestic},${newOriginCountry},${wattage},${filename}`;
  updatedLines.push(newLine);
  
  if (newOriginCountry !== 'UNKNOWN') {
    updatedCount++;
    console.log(`✓ ${manufacturer} → ${newOriginCountry} ${result.is_feoc ? '(FEOC)' : ''}`);
  } else {
    unknownCount++;
    console.log(`? ${manufacturer} → UNKNOWN (needs manual mapping)`);
  }
}

// Write updated CSV
fs.writeFileSync(OUTPUT_FILE, updatedLines.join('\n'), 'utf8');

console.log('\n=== Summary ===');
console.log(`Total rows processed: ${lines.length - 1}`);
console.log(`✓ Updated with country: ${updatedCount}`);
console.log(`? Unknown manufacturers: ${unknownCount}`);
console.log(`Output file: ${OUTPUT_FILE}`);
console.log('\nNext steps:');
console.log('1. Review extracted_spec_components_updated.csv');
console.log('2. Manually map any UNKNOWN manufacturers');
console.log('3. Replace extracted_spec_components.csv with the updated file');
console.log('4. Run database seed script to import updated data');
