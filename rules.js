// כללי מס ורגולציה – כל כלל עם תאריך תחולה ומקור. אומדן כללי, לא ייעוץ מס. לעדכן כשהחוק משתנה.
window.FI_RULES = {
  reviewed: "2026-10-13",
  capGains: { rate: 0.25, label: "מס רווח הון 25% על רווח ריאלי (יחיד, ללא בעל מניות מהותי)", effective: "2012-01-01",
    source: "פקודת מס הכנסה, סעיף 91(ב)", url: "https://www.gov.il/he/departments/topics/capital-gains-tax" },
  surtax: { threshold: 721560, baseRate: 0.03, capitalExtra: 0.02, label: "מס יסף: 3% על הכנסה שנתית מעל הסף + 2% נוספים על הכנסות הוניות (סה\"כ 5% על רווחי הון ודיבידנדים מעל הסף)",
    effective: "2025-01-01", note: "הסף 721,560 ₪ לשנים 2025–2027 (הוקפא). מצרפים את כל ההכנסות בשנת המס, כולל משכורת.",
    source: "פקודת מס הכנסה, סעיף 121ב; חוק ההתייעלות הכלכלית 2025", url: "https://www.gov.il/he/departments/news/surtax" },
  usDivWht: { rate: 0.25, label: "ניכוי מס בארה\"ב על דיבידנדים לתושב ישראל עם טופס W-8BEN", effective: "1995-01-01",
    source: "אמנת המס ישראל–ארה\"ב, סעיף 12", url: "https://www.irs.gov/businesses/international-businesses/israel-tax-treaty-documents" },
  ieFundWht: { rate: 0.15, label: "קרן אירית (UCITS) משלמת 15% מס מקור על דיבידנדים אמריקאיים ברמת הקרן; אירלנד לא מנכה מהמשקיע הישראלי", effective: "1998-01-01",
    source: "אמנת המס אירלנד–ארה\"ב; מבנה קרנות UCITS", url: "https://www.irs.gov/businesses/international-businesses/ireland-tax-treaty-documents" },
  ilDiv: { rate: 0.25, label: "מס בישראל על דיבידנד זר 25% (בניכוי זיכוי על מס זר ששולם)", effective: "2012-01-01", source: "פקודת מס הכנסה, סעיפים 125ב, 199–210" },
  usEstate: { exemptionUSD: 60000, maxRate: 0.40, label: "מס עיזבון אמריקאי לזרים: פטור עד 60,000$ בנכסים אמריקאיים (כולל מניות ו־ETF אמריקאיים), מעליו שיעורים עד 40%. אין אמנת עיזבון בין ישראל לארה\"ב.",
    effective: "1976-01-01", source: "IRS – Estate tax for nonresidents not citizens of the US", url: "https://www.irs.gov/individuals/international-taxpayers/some-nonresidents-with-us-assets-must-file-estate-tax-returns" },
  disclaimer: "המידע כללי ומפושט, אינו ייעוץ השקעות או ייעוץ מס, ואינו מתחשב בנסיבות אישיות. לפני פעולה – לבדוק מול רו\"ח/יועץ מס."
};
