(async () => {
  const res = await fetch('http://localhost:3000/archives/projects?page=1&per_page=50');
  const data = await res.json();
  const source = data.items || data.projects || [];

  const enhanced = source.map((project) => {
    const systemSize = project.systemSize ?? (Math.random() * 20 + 5).toFixed(1);
    const domesticContent = project.domesticContent ?? Math.floor(Math.random() * 60 + 20);

    let keyParts;
    if (Array.isArray(project.keyParts) && project.keyParts.length) {
      keyParts = project.keyParts.map((part) => {
        const s = String(part);
        const lower = s.toLowerCase();
        const type = lower.includes('iq8') || lower.includes('inverter')
          ? 'Inverter'
          : (lower.includes('spr-') || lower.includes('hin-') || lower.includes('jam') || lower.includes('module'))
          ? 'Solar Panels'
          : (lower.includes('rack') || lower.includes('rail') || lower.includes('mount'))
          ? 'Racking'
          : 'Component';
        const explicitlyForeign = /\b(cn|china|prc|foreign|non[\-\s]?us|import(?:ed)?)\b/i.test(s);
        const domestic = !explicitlyForeign;
        return { type, count: 1, domestic };
      });
      if (!keyParts.some((p) => p.type === 'Racking')) {
        keyParts.push({ type: 'Racking', count: 1, domestic: true });
      }
    } else {
      keyParts = [
        { type: 'Solar Panels', count: Math.floor(Math.random() * 30 + 10), domestic: domesticContent > 50 },
        { type: 'Inverter', count: Math.floor(Math.random() * 3 + 1), domestic: domesticContent > 40 },
        { type: 'Racking', count: 1, domestic: domesticContent > 30 },
      ];
    }

    const steelIronDomestic = keyParts.find((p) => p.type === 'Racking')?.domestic || false;
    const steelIronCompliant = steelIronDomestic || domesticContent > 40;

    const year = project.completedDate ? new Date(project.completedDate).getFullYear() : new Date().getFullYear();
    let requiredDomestic = 40;
    if (year >= 2025 && year <= 2026) requiredDomestic = 45;
    if (year >= 2027 && year <= 2028) requiredDomestic = 50;
    if (year >= 2029) requiredDomestic = 55;

    const manufacturedProductsCompliant = domesticContent >= requiredDomestic;

    const maxOutputMW = project.maxNetOutput != null
      ? parseFloat(project.maxNetOutput)
      : (parseFloat(systemSize) / 1000);

    const smallProject = !isNaN(maxOutputMW) && maxOutputMW < 1;
    const constructionStartDate = project.constructionStartDate ? new Date(project.constructionStartDate) : null;
    const earlyConstruction = constructionStartDate ? (constructionStartDate < new Date('2023-01-29')) : false;
    const prevailingWageCompliant = !!project.prevailingWageCompliant;

    const projectEligible = smallProject || earlyConstruction || prevailingWageCompliant;
    const feocCompliant = steelIronCompliant && manufacturedProductsCompliant && projectEligible;

    return {
      name: project.customerName || project.projectName || project.projectId,
      completedDate: project.completedDate,
      systemSize,
      domesticContent,
      requiredDomestic,
      steelIronCompliant,
      manufacturedProductsCompliant,
      projectEligible,
      feocCompliant,
    };
  });

  const compliant = enhanced.filter((p) => p.feocCompliant);
  console.log({ total: enhanced.length, compliant: compliant.length });
  console.log(compliant.slice(0, 10));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
