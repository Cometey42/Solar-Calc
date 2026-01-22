// src/compare.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { lookupMaterial } = require('./materialsCatalog');
// REMOVED: classifyFeocBucket import - company requested to drop domestic calculation function

// REMOVED: isKnownOrigin function - no longer needed without domestic tracking

/**
 * Merge Aurora pricing_by_component with your Parts + mapping table.
 * Accepts either { pricing: {...} } or the pricing object directly.
 */
async function buildComparison(pricingInput) {
    // Normalize shape
    const pricing = pricingInput && pricingInput.pricing ? pricingInput.pricing : pricingInput;

    const rows = Array.isArray(pricing?.pricing_by_component) ? pricing.pricing_by_component : [];

    // Load all mappings and index by "name|manufacturer"
    const maps = await prisma.componentMap.findMany();
    const key = (name, mfg) =>
        `${(name || "").trim().toLowerCase()}|${(mfg || "").trim().toLowerCase()}`;
    const idx = new Map(maps.map((m) => [key(m.auroraName, m.manufacturer), m.partSku]));

    const out = [];
    for (const r of rows) {
        const mappedSku = idx.get(key(r.name, r.manufacturer_name));
        let part = null;

        if (mappedSku) {
            part = await prisma.part.findUnique({ where: { sku: mappedSku } });
        } else if (r.name) {
            // Fallback: loose search by name
            part = await prisma.part.findFirst({
                where: { OR: [{ sku: { contains: r.name } }, { name: { contains: r.name } }] },
            });
        }

        const materialFromName = lookupMaterial(r.name);
        const materialFromMapped = mappedSku ? lookupMaterial(mappedSku) : null;
        const materialFromPartSku = part?.sku ? lookupMaterial(part.sku) : null;
        const material = materialFromMapped || materialFromPartSku || materialFromName;

        const unitPrice = part?.unitPrice ?? material?.unitPrice ?? null;
        const qty = r.quantity ?? null;
        const lineTotal = unitPrice != null && qty != null ? unitPrice * qty : null;

        // Company requested: Drop domestic calculation function as rules constantly change
        // Keeping pricing functionality only
        // Note: origin_country retained for FEOC compliance checking (2026+ requirement)
        
        out.push({
            name: r.name,
            manufacturer: r.manufacturer_name,
            type: r.component_type,
            quantity: qty,
            matched_sku: part?.sku ?? material?.sku ?? null,
            unit_price: unitPrice,
            line_total: lineTotal,
            origin_country: part?.originCountry ?? material?.originCountry ?? null,
        });
    }

    const sum = (arr) =>
        arr.reduce((acc, x) => (x.line_total ? acc + x.line_total : acc), 0);

    return {
        items: out,
        summary: {
            total: sum(out),
            // REMOVED: domestic_total, non_domestic_total, unknown_total per company request
        },
    };
}

module.exports = { buildComparison };
