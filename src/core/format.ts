const nf = new Intl.NumberFormat('pt-BR');

export function fmtInt(n: number): string {
  return nf.format(Math.floor(n));
}

export function fmtShort(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return (Math.round(n * 10) / 10).toLocaleString('pt-BR');
  const units = [['mi', 1e6], ['bi', 1e9], ['tri', 1e12]] as const;
  if (a < 1e6) return (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  for (let i = units.length - 1; i >= 0; i--) {
    if (a >= units[i][1]) return (n / units[i][1]).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' ' + units[i][0];
  }
  return fmtInt(n);
}

export function fmtMoney(n: number): string {
  return '$' + fmtShort(n);
}

export function fmtTime(sec: number): string {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function fmtPct(p: number): string {
  const d = p < 0.01 ? 4 : p < 1 ? 3 : 2;
  return p.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
}
