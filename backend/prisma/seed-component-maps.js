const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Common Aurora component names mapped to your SKUs
  const mappings = [
    // Hyundai panels - map various Hyundai models to your SKU
    { auroraName: "HiN-T440NF(BK)", manufacturer: "Hyundai Energy Solutions", partSku: "HYUND HiS-T435NF(BK)" },
    { auroraName: "HiS-T435NF(BK)", manufacturer: "Hyundai Energy Solutions", partSku: "HYUND HiS-T435NF(BK)" },
    { auroraName: "HIS-T435NF(BK)", manufacturer: "Hyundai", partSku: "HYUND HIS-T435NF(BK)" },
    
    // Enphase microinverters - map various IQ models
    { auroraName: "IQ8MC-72-M-US (240V)", manufacturer: "Enphase Energy Inc.", partSku: "ENPHA IQ8HC" },
    { auroraName: "IQ8MC-72-M-US", manufacturer: "Enphase Energy Inc.", partSku: "ENPHA IQ8HC" },
    { auroraName: "IQ8+ 72-M-US", manufacturer: "Enphase Energy Inc.", partSku: "ENPHA IQ8+ 72-M-US Data Sheet" },
    { auroraName: "IQ7HS-66-M-US", manufacturer: "Enphase Energy Inc.", partSku: "ENPHA IQ7HS-66-M-US" },
    { auroraName: "IQ8HC", manufacturer: "Enphase Energy Inc.", partSku: "ENPHA IQ8HC" },
    { auroraName: "IQ8X", manufacturer: "Enphase Energy Inc.", partSku: "ENPHA IQ8X" },
    
    // QCell panels
    { auroraName: "Q.TRON BLK M-G2.H+ 430", manufacturer: "QCell", partSku: "QCELL Q.TRON BLK M-G2.H+ 430_435" },
    { auroraName: "Q.TRON BLK M-G2.H+ 435", manufacturer: "QCell", partSku: "QCELL Q.TRON BLK M-G2.H+ 430_435" },
    { auroraName: "Q.PEAK DUO BLK ML-G10+ 415", manufacturer: "QCell", partSku: "QCELL Q.PEAK DUO BLK ML-G10+ 415" },
    
    // Canadian Solar
    { auroraName: "CS6R-395MS-HL", manufacturer: "Canadian Solar", partSku: "CANAD CS6R-395MS-HL" },
    
    // JA Solar
    { auroraName: "JAM54S31", manufacturer: "JA Solar", partSku: "JASOL JAM54S31" },
    
    // Jinko
    { auroraName: "JKM425N-54HL4-B", manufacturer: "Jinko", partSku: "JINKO JKM425N-54HL4-B" },
    
    // IronRidge racking
    { auroraName: "Iron Ridge Racking", manufacturer: "IronRidge", partSku: "IRONR Iron Ridge Racking" },
    
    // Eaton breakers
    { auroraName: "BR220", manufacturer: "Eaton", partSku: "EATON BR220 - (20A)" },
  ];

  let created = 0, updated = 0, skipped = 0;

  for (const map of mappings) {
    try {
      // Check if part SKU exists
      const part = await prisma.part.findUnique({ where: { sku: map.partSku } });
      
      if (!part) {
        console.warn(`⚠️  Part not found: ${map.partSku} - skipping mapping for ${map.auroraName}`);
        skipped++;
        continue;
      }

      const existing = await prisma.componentMap.findUnique({
        where: {
          auroraName_manufacturer: {
            auroraName: map.auroraName,
            manufacturer: map.manufacturer || ""
          }
        }
      });

      await prisma.componentMap.upsert({
        where: {
          auroraName_manufacturer: {
            auroraName: map.auroraName,
            manufacturer: map.manufacturer || ""
          }
        },
        create: {
          auroraName: map.auroraName,
          manufacturer: map.manufacturer,
          partSku: map.partSku
        },
        update: {
          partSku: map.partSku
        }
      });

      existing ? updated++ : created++;
      console.log(`✓ Mapped: ${map.auroraName} (${map.manufacturer}) → ${map.partSku}`);
    } catch (e) {
      console.error(`✗ Failed to map ${map.auroraName}:`, e.message);
      skipped++;
    }
  }

  console.log(`\n✅ Component mapping complete:`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
