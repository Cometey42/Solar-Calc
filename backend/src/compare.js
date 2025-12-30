// src/compare.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { lookupMaterial } = require('./materialsCatalog');
const { classifyFeocBucket } = require('./feoc');

function isKnownOrigin(originCountry) {
    if (originCountry == null) return false;
    const s = String(originCountry).trim().toUpperCase();
    return s !== '' && s !== 'UNKNOWN';
}

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

        // Prefer catalog domestic flag when present; otherwise treat DB isDomestic as reliable
        // only if originCountry is not UNKNOWN (schema defaults can otherwise misclassify).
        const partDomestic = part && isKnownOrigin(part.originCountry) ? part.isDomestic : null;
        const isDomestic = (material?.isDomestic ?? partDomestic) ?? null;
        const originCountry = material?.originCountry ?? (isKnownOrigin(part?.originCountry) ? part.originCountry : null);

        out.push({
            name: r.name,
            manufacturer: r.manufacturer_name,
            type: r.component_type,
            quantity: qty,
            matched_sku: part?.sku ?? material?.sku ?? null,
            unit_price: unitPrice,
            is_domestic: isDomestic,
            origin_country: originCountry,
            line_total: lineTotal,
            feoc_bucket: classifyFeocBucket({ name: r.name, type: r.component_type }),
        });
    }

    const sum = (arr, pred) =>
        arr.reduce((acc, x) => (pred(x) && x.line_total ? acc + x.line_total : acc), 0);

    return {
        items: out,
        summary: {
            domestic_total: sum(out, (x) => x.is_domestic === true),
            non_domestic_total: sum(out, (x) => x.is_domestic === false),
            unknown_total: sum(out, (x) => x.is_domestic == null),
        },
    };
}

module.exports = { buildComparison };
